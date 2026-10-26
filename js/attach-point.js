// 自動找圓環掛點（design-studio 與 social-video-studio 共用）
//
// 掛點 = 作品頂面上、圓環正下方的一個點；圓環中心放在掛點正上方 RING_CENTER_ABOVE_ATTACH。
// 這個距離以 design-studio 的 ring-bail.js（modelTopZ + 1.2）為準，所有工具都要一致。
//
// 方向：較寬的字母當佩戴正面。作品本體不轉，只轉圓環＋墜頭：字母 A 在 XZ 平面（從 −Y 看）、
//   字母 B 在 YZ 平面（從 X 看），B 較寬時圓環＋墜頭轉 90°（rot），圓環平面改成與 B 平行。
//   鏈子穿過墜頭的洞、與圓環平面垂直，戴起來圓環平面會朝前 → 較寬的字母成為正面；
//   反過來的話作品會被鏈子強制帶著轉 90°，佩戴不順。
//   以下 u = 圓環所在平面的水平軸、v = 圓環管徑方向的軸。
// 做法：從正上方把每個三角形「投影」到 0.1mm 網格上，得到頂面高度圖，再挑掛點。
// 可掛條件：圓環底部（u ±0.4、v ±0.3mm）整片有實體、高低差 < 0.6mm；
//   且從正面看，沒有任何筆畫伸進圓環的洞（避免圓環看起來被金屬穿過）。
//   掛點高度取這片範圍內的最低點，保證圓環底部不會有一邊懸空。
// 筆畫靠近但中間空（如襯線 H 頂部）：圓環往下放能同時卡住左右兩筆、間距 ≤ GAP_MAX 時，也列為掛點（見 bridgeZ）。
// 挑選（靠近重心優先，高度只當上限）：候選限制在作品最高點往下 BAND 以內；選離重心垂直線最近的；
//   距離差 TIE 以內算平手，平手選重心「右邊」那個（掛點在重心右邊，作品會逆時針轉成仰角，像往上寫；
//   掛左邊則像垂下去）；同一邊再比高度。
//   作品會不會歪只看掛點與重心的水平距離，跟高度無關，所以不再拿高度計分。
// 網格對齊 0.1mm 的整數倍，回傳的 x、y 可以直接當滑桿值（滑桿 step 0.1）。
// 回傳 { x, y, z, rot }，rot 為弧度（0 或 π/2）。geometry 需已 computeBoundingBox()。

export const RING_CENTER_ABOVE_ATTACH = 1.2;

export function findAttachPoint(geometry) {
    if (geometry.index) geometry = geometry.toNonIndexed();
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const STEP = 0.1, bb = geometry.boundingBox, p = geometry.attributes.position.array;
    const x0 = Math.floor(bb.min.x / STEP) * STEP, y0 = Math.floor(bb.min.y / STEP) * STEP;
    const nx = Math.ceil((bb.max.x - x0) / STEP) + 1, ny = Math.ceil((bb.max.y - y0) / STEP) + 1;
    const hm = new Float32Array(nx * ny).fill(-Infinity);
    let vol = 0, mx = 0, my = 0;
    for (let t = 0; t < p.length; t += 9) {
        const ax = p[t], ay = p[t + 1], az = p[t + 2], bx = p[t + 3], by = p[t + 4], bz = p[t + 5], qx = p[t + 6], qy = p[t + 7], qz = p[t + 8];
        // 重心：以原點為頂點的帶號四面體體積加權
        const v = (ax * (by * qz - bz * qy) - ay * (bx * qz - bz * qx) + az * (bx * qy - by * qx)) / 6;
        vol += v; mx += v * (ax + bx + qx) / 4; my += v * (ay + by + qy) / 4;
        const d = (by - qy) * (ax - qx) + (qx - bx) * (ay - qy);
        if (Math.abs(d) < 1e-12) continue; // 垂直面，從上面看不到
        const i0 = Math.max(0, Math.ceil((Math.min(ax, bx, qx) - x0) / STEP)), i1 = Math.min(nx - 1, Math.floor((Math.max(ax, bx, qx) - x0) / STEP));
        const j0 = Math.max(0, Math.ceil((Math.min(ay, by, qy) - y0) / STEP)), j1 = Math.min(ny - 1, Math.floor((Math.max(ay, by, qy) - y0) / STEP));
        for (let i = i0; i <= i1; i++) {
            const px = x0 + i * STEP;
            for (let j = j0; j <= j1; j++) {
                const py = y0 + j * STEP;
                const l1 = ((by - qy) * (px - qx) + (qx - bx) * (py - qy)) / d;
                const l2 = ((qy - ay) * (px - qx) + (ax - qx) * (py - qy)) / d;
                const l3 = 1 - l1 - l2;
                if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
                const z = l1 * az + l2 * bz + l3 * qz, k = i * ny + j;
                if (z > hm[k]) hm[k] = z;
            }
        }
    }
    if (Math.abs(vol) > 1e-9) { mx /= vol; my /= vol; } else { mx = 0; my = 0; }
    const rotB = (bb.max.y - bb.min.y) > (bb.max.x - bb.min.x); // 字母 B 較寬 → B 朝前
    // 以 (u, v) 存取高度圖：u 沿圓環平面、v 沿管徑方向
    const nu = rotB ? ny : nx, nv = rotB ? nx : ny;
    const H = rotB ? (u, v) => hm[v * ny + u] : (u, v) => hm[u * ny + v];
    // 從正面看，每個 u 位置上整件作品的最高點（不分前後深度）
    const faceMax = new Float32Array(nu).fill(-Infinity);
    for (let u = 0; u < nu; u++) for (let v = 0; v < nv; v++) { const h = H(u, v); if (h > faceMax[u]) faceMax[u] = h; }
    const R_IN = 1.0, RI = Math.round(R_IN / STEP), BAND = 3.0, TIE = 0.3;
    // 跨接：把圓環外圈（半徑 R_OUT）從上方放下，左右兩側都碰到筆畫、且正中間是空的（或明顯較低）才算卡住；
    //   卡住後比照平面情況再下沉 R_OUT − RING_CENTER_ABOVE_ATTACH − R_IN（0.4mm）讓圓環與筆畫熔接。
    //   支撐的筆畫在管徑方向（v）必須整段有實體，避免圓環前後懸空。
    //   兩側接觸點的間距要 ≤ GAP_MAX（平頂兩筆相距 2mm 時圓環只下沉約 0.35mm；襯線、斜頂接觸點較低時下沉較多，由 BAND 限制）。
    //   回傳等效掛點高度（圓環中心 − RING_CENTER_ABOVE_ATTACH），沒有卡住則回傳 null。
    const R_OUT = 1.6, RO = Math.round(R_OUT / STEP), CONTACT = 0.05, GAP_MAX = 2.0;
    function bridgeZ(u, v, fv) {
        const col = uu => { // 這一欄在管徑範圍內整段有實體時回傳最高點，否則 −∞
            let lo = Infinity, hi = -Infinity;
            for (let b = -fv; b <= fv; b++) { const h = H(uu, v + b); if (h < lo) lo = h; if (h > hi) hi = h; }
            return lo === -Infinity ? -Infinity : hi;
        };
        let zl = -Infinity, zr = -Infinity, al = 0, ar = 0;
        for (let a = -RO; a <= RO; a++) {
            const uu = u + a; if (a === 0 || uu < 0 || uu >= nu) continue;
            const h = col(uu); if (h === -Infinity) continue;
            const zc = h + Math.sqrt(Math.max(0, R_OUT * R_OUT - (a * STEP) ** 2));
            if (a < 0) { if (zc > zl) { zl = zc; al = a; } } else if (zc > zr) { zr = zc; ar = a; }
        }
        const zc = Math.max(zl, zr);
        if (zc === -Infinity || zl < zc - CONTACT || zr < zc - CONTACT) return null;
        if ((ar - al) * STEP > GAP_MAX + 1e-6) return null;
        // 正中間要是空隙：中心點正下方的最高處放上圓環後，必須明顯低於兩側卡住的高度
        let hc = -Infinity; for (let b = -fv; b <= fv; b++) { const h = H(u, v + b); if (h > hc) hc = h; }
        if (hc + R_OUT > zc - CONTACT) return null;
        return zc - R_OUT;
    }
    const round1 = n => Math.round(n * 10) / 10;
    // 先用完整圓環底部尺寸找；筆畫太細找不到時退一步只要求單點有實體
    for (const [fu, fv, maxDiff] of [[4, 3, 0.6], [1, 1, 1.0]]) {
        const cands = [];
        for (let u = fu; u < nu - fu; u++) {
            for (let v = fv; v < nv - fv; v++) {
                let hmin = Infinity, hmax = -Infinity;
                for (let a = -fu; a <= fu && hmin > -Infinity; a++) for (let b = -fv; b <= fv; b++) {
                    const h = H(u + a, v + b); if (h < hmin) hmin = h; if (h > hmax) hmax = h;
                }
                if (hmin === -Infinity || hmax - hmin > maxDiff) {
                    // 正下方不是整片實體：看圓環往下放時會不會同時卡在左右兩個筆畫上（如襯線 H 頂部兩筆很靠近）
                    if (fu !== 4) continue;
                    const zb = bridgeZ(u, v, fv);
                    if (zb === null) continue;
                    hmin = zb;
                }
                // 圓環中心在 hmin + RING_CENTER_ABOVE_ATTACH → 洞的下緣在水平偏移 d 處的高度 = 中心 − √(R_IN² − d²)
                let pierce = false;
                for (let a = -RI + 1; a <= RI - 1 && !pierce; a++) {
                    const uu = u + a; if (uu < 0 || uu >= nu) continue;
                    const d = a * STEP;
                    if (faceMax[uu] > hmin + RING_CENTER_ABOVE_ATTACH - Math.sqrt(R_IN * R_IN - d * d) + 0.05) pierce = true;
                }
                if (pierce) continue;
                if (hmin < bb.max.z - BAND) continue;
                const i = rotB ? v : u, j = rotB ? u : v, x = x0 + i * STEP, y = y0 + j * STEP;
                // right：掛點在重心右邊（字母 A 朝前時 +x；字母 B 朝前時 +y，B 是由 A 繞 Z 轉 90° 而來，從 +X 看時右手邊是 +y）
                cands.push({ x, y, z: hmin, d: Math.hypot(x - mx, y - my), right: (rotB ? y - my : x - mx) > 0 });
            }
        }
        if (!cands.length) continue;
        const dMin = Math.min(...cands.map(c => c.d));
        let best = null;
        for (const c of cands) {
            if (c.d > dMin + TIE) continue;
            if (!best || (c.right !== best.right ? c.right : c.z > best.z)) best = c;
        }
        return { x: round1(best.x), y: round1(best.y), z: best.z, rot: rotB ? Math.PI / 2 : 0 };
    }
    return { x: 0, y: 0, z: bb.max.z, rot: rotB ? Math.PI / 2 : 0 };
}

// 體積重心（物件空間）：以原點為頂點的帶號四面體體積加權，跟 findAttachPoint 內部的 2D 重心同一個算法。
// geometry 需為 non-indexed（indexed 會先轉）。體積趨近 0 時回傳 BBox 中心。
export function computeCentroid(geometry) {
    if (geometry.index) geometry = geometry.toNonIndexed();
    const p = geometry.attributes.position.array;
    let vol = 0, cx = 0, cy = 0, cz = 0;
    for (let t = 0; t < p.length; t += 9) {
        const ax = p[t], ay = p[t + 1], az = p[t + 2], bx = p[t + 3], by = p[t + 4], bz = p[t + 5], qx = p[t + 6], qy = p[t + 7], qz = p[t + 8];
        const v = (ax * (by * qz - bz * qy) - ay * (bx * qz - bz * qx) + az * (bx * qy - by * qx)) / 6;
        vol += v; cx += v * (ax + bx + qx) / 4; cy += v * (ay + by + qy) / 4; cz += v * (az + bz + qz) / 4;
    }
    if (Math.abs(vol) < 1e-9) {
        if (!geometry.boundingBox) geometry.computeBoundingBox();
        const c = geometry.boundingBox.getCenter(new (geometry.boundingBox.min.constructor)());
        return { x: c.x, y: c.y, z: c.z };
    }
    return { x: cx / vol, y: cy / vol, z: cz / vol };
}
