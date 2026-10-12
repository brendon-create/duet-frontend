/**
 * caliper-stl.js - 字體卡尺「訂單 STL 模式」：讀取主體 STL，投影出兩個字母的正面輪廓，並沿深度方向實測截面
 *
 * 座標（與正式建模相同）：字母 1 在 XZ 平面（沿 Y 擠出），字母 2 在 YZ 平面（沿 X 擠出），Z＝高度。
 * 成品＝兩個擠出體的交集，所以沿 Y 的投影＝字母 1 實際存在於成品中的部分，沿 X 的投影＝字母 2 的部分，
 * 卡尺的筆畫寬度直接在投影上量。截面則用射線穿過 STL 網格實測（含後端清掉分離碎片後的真實狀態）。
 * ClipperLib 由呼叫端傳入（瀏覽器 window.ClipperLib / Node require('clipper-lib')）。
 */

// 讀二進位 STL → { tri: Float32Array（每 9 個數一個三角形）, count }，並以外框中心置中
export function parseStl(arrayBuffer) {
    const dv = new DataView(arrayBuffer);
    const count = dv.getUint32(80, true);
    if (84 + count * 50 !== arrayBuffer.byteLength) throw new Error('不是二進位 STL 檔案');
    const tri = new Float32Array(count * 9);
    for (let i = 0; i < count; i++) for (let k = 0; k < 9; k++) tri[i * 9 + k] = dv.getFloat32(84 + i * 50 + 12 + k * 4, true);
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < tri.length; i += 3) for (let a = 0; a < 3; a++) {
        if (tri[i + a] < mn[a]) mn[a] = tri[i + a];
        if (tri[i + a] > mx[a]) mx[a] = tri[i + a];
    }
    const c = mn.map((v, a) => (v + mx[a]) / 2);
    for (let i = 0; i < tri.length; i += 3) for (let a = 0; a < 3; a++) tri[i + a] -= c[a];
    return { tri, count, size: mx.map((v, a) => v - mn[a]), center: c };  // center：置中前的外框中心（原始座標）
}

const S = 10000;  // Clipper 整數座標：1mm = 10000

/**
 * 投影輪廓：把所有三角形投影到 (h, v) 平面後聯集。h/v 為座標軸索引（0=X, 1=Y, 2=Z）。
 * 三角形之間的浮點縫隙會讓聯集留下極細的縫與碎片：外擴 0.002mm 再內縮 0.002mm 補縫，丟掉 < 0.001mm² 的碎片。
 * 回傳 contours（mm），可直接給 caliper-geometry 的 buildShape
 */
export function silhouette(ClipperLib, tri, h, v) {
    const paths = [];
    for (let i = 0; i < tri.length; i += 9) {
        const p = [0, 1, 2].map(k => ({ X: Math.round(tri[i + k * 3 + h] * S), Y: Math.round(tri[i + k * 3 + v] * S) }));
        const area = (p[1].X - p[0].X) * (p[2].Y - p[0].Y) - (p[2].X - p[0].X) * (p[1].Y - p[0].Y);
        if (area === 0) continue;                  // 垂直於投影面的三角形投影成線
        paths.push(area > 0 ? p : p.reverse());     // 統一方向後用 nonzero 聯集
    }
    const cl = new ClipperLib.Clipper();
    cl.AddPaths(paths, ClipperLib.PolyType.ptSubject, true);
    const union = new ClipperLib.Paths();
    cl.Execute(ClipperLib.ClipType.ctUnion, union, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
    const offset = (src, d) => {
        const co = new ClipperLib.ClipperOffset();
        co.AddPaths(src, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
        const out = new ClipperLib.Paths();
        co.Execute(out, d * S);
        return out;
    };
    return offset(offset(union, 0.002), -0.002)
        .filter(q => Math.abs(ClipperLib.Clipper.Area(q)) / S / S >= 0.001)
        .map(q => q.map(p => [p.X / S, p.Y / S]));
}

/**
 * 沿深度軸 d 的射線索引：射線位置由 (h, v) 兩軸座標決定（例：字母 1 的截面，射線沿 Y，位置是 (X, Z)）。
 * 三角形依 (h, v) 投影放進 0.25mm 網格，查詢時只檢查同一格的三角形。
 * intervals(hv, vv) 回傳射線在網格內的實體區間 [[d0, d1], ...]（由小到大）
 */
export function buildRayIndex(tri, h, v, d) {
    const cell = 0.25, grid = new Map();
    const key = (i, j) => i * 100003 + j;
    for (let t = 0; t < tri.length; t += 9) {
        let h0 = Infinity, h1 = -Infinity, v0 = Infinity, v1 = -Infinity;
        for (let k = 0; k < 3; k++) {
            const a = tri[t + k * 3 + h], b = tri[t + k * 3 + v];
            if (a < h0) h0 = a; if (a > h1) h1 = a; if (b < v0) v0 = b; if (b > v1) v1 = b;
        }
        for (let i = Math.floor(h0 / cell); i <= Math.floor(h1 / cell); i++)
            for (let j = Math.floor(v0 / cell); j <= Math.floor(v1 / cell); j++) {
                const k = key(i, j);
                (grid.get(k) || grid.set(k, []).get(k)).push(t);
            }
    }
    return {
        intervals(ph, pv) {
            const list = grid.get(key(Math.floor(ph / cell), Math.floor(pv / cell))) || [];
            const hits = [];
            for (const t of list) {
                const ax = tri[t + h], ay = tri[t + v], bx = tri[t + 3 + h], by = tri[t + 3 + v], cx = tri[t + 6 + h], cy = tri[t + 6 + v];
                const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
                if (Math.abs(den) < 1e-12) continue;   // 平行於射線的三角形
                const w1 = ((by - cy) * (ph - cx) + (cx - bx) * (pv - cy)) / den;
                const w2 = ((cy - ay) * (ph - cx) + (ax - cx) * (pv - cy)) / den;
                const w3 = 1 - w1 - w2;
                if (w1 < -1e-9 || w2 < -1e-9 || w3 < -1e-9) continue;
                hits.push(w1 * tri[t + d] + w2 * tri[t + 3 + d] + w3 * tri[t + 6 + d]);
            }
            hits.sort((a, b) => a - b);
            // 射線剛好經過共用邊/頂點時同一個交點會被算多次：合併距離 < 1e-5mm 的交點
            const uniq = [];
            for (const x of hits) if (!uniq.length || x - uniq[uniq.length - 1] > 1e-5) uniq.push(x);
            if (uniq.length % 2) return null;          // 奇數個交點（剛好擦過邊緣）：交給呼叫端改用投影輪廓
            const out = [];
            for (let i = 0; i < uniq.length; i += 2) out.push([uniq[i], uniq[i + 1]]);
            return out;
        }
    };
}
