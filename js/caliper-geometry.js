/**
 * caliper-geometry.js - 字體卡尺的 2D 幾何計算（純函式，無 DOM 依賴，可在 Node 測試）
 *
 * 座標：每個字母各自的 2D 平面，單位 mm。x = 水平，y = 垂直（兩個字母共用同一條垂直軸 = 成品高度方向）
 * shape = { contours: [[[x, y], ...], ...], edges: [[x1, y1, x2, y2], ...] }
 * 內外判斷用 even-odd：OpenSCAD 輸出的輪廓互不交叉，外框與洞以包含層數區分
 */

export function buildShape(contours) {
    const edges = [];
    for (const c of contours) {
        for (let i = 0; i < c.length; i++) {
            const a = c[i], b = c[(i + 1) % c.length];
            if (a[0] !== b[0] || a[1] !== b[1]) edges.push([a[0], a[1], b[0], b[1]]);
        }
    }
    let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
    for (const c of contours) for (const [x, y] of c) {
        if (x < xMin) xMin = x; if (x > xMax) xMax = x;
        if (y < yMin) yMin = y; if (y > yMax) yMax = y;
    }
    return { contours, edges, bbox: { xMin, yMin, xMax, yMax } };
}

export function pointInShape(shape, x, y) {
    let inside = false;
    for (const [x1, y1, x2, y2] of shape.edges) {
        if ((y1 > y) !== (y2 > y) && x < x1 + (y - y1) * (x2 - x1) / (y2 - y1)) inside = !inside;
    }
    return inside;
}

// 水平線 y 與形狀的交集區間（even-odd 配對），回傳 [[x0, x1], ...] 由左到右
export function chordsAtY(shape, y) {
    const xs = [];
    for (const [x1, y1, x2, y2] of shape.edges) {
        if ((y1 > y) !== (y2 > y)) xs.push(x1 + (y - y1) * (x2 - x1) / (y2 - y1));
    }
    xs.sort((a, b) => a - b);
    const out = [];
    for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1] - xs[i] > 1e-9) out.push([xs[i], xs[i + 1]]);
    return out;
}

// 從 (ox, oy) 沿 (dx, dy) 射出，回傳最近交點距離（>eps），沒有則 Infinity
function rayHit(shape, ox, oy, dx, dy) {
    let best = Infinity;
    for (const [x1, y1, x2, y2] of shape.edges) {
        const ex = x2 - x1, ey = y2 - y1;
        const den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-12) continue;
        const t = ((x1 - ox) * ey - (y1 - oy) * ex) / den;
        const u = ((x1 - ox) * dy - (y1 - oy) * dx) / den;
        if (t > 1e-9 && u >= 0 && u <= 1 && t < best) best = t;
    }
    return best;
}

/**
 * 游標卡尺：點 (x, y) 在筆畫內時，量「穿過該點的最短弦」＝局部筆畫寬度，方向自動垂直於筆畫。
 * 不用「最近輪廓邊的法線」：游標靠近筆畫末端時最近的是端點那條邊，會量成沿筆畫的長度（把細筆畫誤判成粗）。
 * 最短弦在尖角附近會偏小——那裡本來就是實體最細處，偏保守。
 * 回傳 { a, b, width, n }；不在筆畫內回傳 null。n = 量測方向單位向量（由 b 指向 a），n[1] 為垂直分量
 */
export function caliperAt(shape, x, y) {
    if (!pointInShape(shape, x, y)) return null;
    const chord = deg => {
        const r = deg * Math.PI / 180, dx = Math.cos(r), dy = Math.sin(r);
        return { deg, dx, dy, ta: rayHit(shape, x, y, dx, dy), tb: rayHit(shape, x, y, -dx, -dy) };
    };
    let best = null;
    const consider = c => { if (isFinite(c.ta) && isFinite(c.tb) && (!best || c.ta + c.tb < best.ta + best.tb)) best = c; };
    for (let d = 0; d < 180; d += 5) consider(chord(d));             // 粗掃
    if (!best) return null;
    const d0 = best.deg;
    for (let d = d0 - 5; d <= d0 + 5; d += 0.5) consider(chord(d));  // 細修（0.5° 誤差 < 0.001%）
    const { dx, dy, ta, tb } = best;
    return { p: [x, y], a: [x + dx * ta, y + dy * ta], b: [x - dx * tb, y - dy * tb], width: ta + tb, n: [dx, dy] };
}

/**
 * 成品截面：字母 self 上游標點 cal.p 的卡尺 cal（垂直於該筆畫），沿深度方向切穿另一個字母 other。
 * 切面 = 卡尺線段 × 深度方向；切面上每個高度的實體＝另一個字母在該高度的水平區間。
 * 區塊以「游標高度」上的實體區段定義：成品在游標這一點的實體，就是另一個字母在同一高度的那幾段筆畫，
 * 每段在游標高度量 w2（不能用區塊中某一列：區塊可能同時含橫槓與直筆畫，像 H，取哪一列就會量到不同筆畫）。
 * 回傳 blocks：每塊 { u0, u1, uMid, w2, cal2, angleDeg, area, strips }
 *   u = 另一個字母的水平座標（＝深度方向）；area 用 w1 × w2（保守估算，見 judge）
 *   strips = 該段在整條卡尺上連通的實體 [{ s, u0, u1 }]（s = 沿卡尺從 b 到 a 的距離），只用來畫截面形狀
 * intervalsAt(x, y)：選填，直接回傳切面上該點沿深度方向的實體區間（訂單 STL 模式用射線實測）；
 *   沒給或回傳 null 時，用另一個字母在該高度的水平區間推算
 */
export function sectionBlocks(cal, other, samples = 48, intervalsAt = null) {
    const [bx, by] = cal.b, dx = cal.a[0] - bx, dy = cal.a[1] - by;
    const at = (xv, yv) => (intervalsAt && intervalsAt(xv, yv)) || chordsAtY(other, yv);
    const sP = Math.hypot(cal.p[0] - bx, cal.p[1] - by);
    const rows = [];
    for (let i = 0; i <= samples; i++) {
        const t = i / samples, s = t * cal.width;
        rows.push({ s, chords: at(bx + t * dx, by + t * dy) });
    }
    const pRow = { s: sP, chords: at(cal.p[0], cal.p[1]), isP: true };
    rows.push(pRow);
    rows.sort((a, b) => a.s - b.s);
    // 相鄰兩列的區間有重疊就連通（union-find），H 的橫槓會把兩根直筆畫連成同一片
    const nodes = [];
    rows.forEach((row, r) => row.chords.forEach(([u0, u1]) => nodes.push({ r, s: row.s, u0, u1, parent: nodes.length })));
    const find = i => (nodes[i].parent === i ? i : (nodes[i].parent = find(nodes[i].parent)));
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        if (b.r === a.r + 1 && a.u0 <= b.u1 && b.u0 <= a.u1) nodes[find(i)].parent = find(j);
    }
    const pIndex = rows.indexOf(pRow), n1z = cal.n[1];
    return nodes.map((nd, i) => ({ nd, i })).filter(({ nd }) => nd.r === pIndex).map(({ nd, i }) => {
        const root = find(i);
        const strips = nodes.filter((m, j) => find(j) === root && !rows[m.r].isP).map(m => ({ s: m.s, u0: m.u0, u1: m.u1 }));
        const uMid = (nd.u0 + nd.u1) / 2;
        const c2 = caliperAt(other, uMid, cal.p[1]);
        const w2 = c2 ? c2.width : nd.u1 - nd.u0;
        // 兩個筆畫的 3D 法線：n1 = (n1x, 0, n1z)、n2 = (0, n2x, n2z)，夾角 cosφ = n1z·n2z
        const cos = Math.min(1, Math.abs(n1z * (c2 ? c2.n[1] : 0)));
        return { u0: nd.u0, u1: nd.u1, uMid, w2, cal2: c2, angleDeg: Math.acos(cos) * 180 / Math.PI, area: cal.width * w2, strips };
    });
}

// 另一個字母完全沒有實體的高度區間（＝不會產生交集），step mm
export function emptyBands(other, yMin, yMax, step = 0.02) {
    const bands = [];
    let start = null;
    for (let y = yMin; y <= yMax + 1e-9; y += step) {
        const empty = chordsAtY(other, y).length === 0;
        if (empty && start === null) start = y;
        if (!empty && start !== null) { bands.push([start, y]); start = null; }
    }
    if (start !== null) bands.push([start, yMax]);
    return bands;
}

/**
 * 判定：bad（紅）/ warn（黃）/ ok（綠）
 * rules = { sideBad: 0.5, sideWarn: 0.55, areaBad: 0.6, areaOk: 0.7 }
 * 截面積用 w1 × w2（矩形）：兩筆畫斜交時真實截面是平行四邊形、面積略大，矩形是保守估算
 */
export function judge(w1, w2, rules) {
    const side = Math.min(w1, w2), area = w1 * w2;
    if (side < rules.sideBad || area < rules.areaBad) return 'bad';
    if (side < rules.sideWarn || area < rules.areaOk) return 'warn';
    return 'ok';
}

// 只有單一字母 2D 寬度時的參考標色（沒有另一邊可算面積）
export function judgeSingle(w, rules) {
    if (w < rules.sideBad) return 'bad';
    if (w < 0.7) return 'warn';
    return 'ok';
}
