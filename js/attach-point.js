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
// 做法：從正上方把每個三角形「投影」到 0.1mm 網格上，得到頂面高度圖，然後在每個位置「模擬把圓環放下去」：
//   1. 放下：圓環垂直往下，降到圓環外緣（半徑 R_OUT）第一次碰到作品為止。平頂碰在正下方、尖頂碰在尖端、
//      谷底或兩筆之間會同時碰到左右兩邊（m 中央、襯線 H 頂部都是這種）。
//   2. 熔接：碰到後再下沉 FUSE，讓圓環跟作品接牢。FUSE 由 RING_CENTER_ABOVE_ATTACH 換算（平頂時掛點 = 頂面，與舊公式一致）。
//   3. 站得住：接觸點要在圓環正下方 SUPPORT_HALF 以內（容許坡度：下坡側懸空 ≤ SUPPORT_SLACK，約 35°），
//      或左右兩側都碰到且間距 ≤ GAP_MAX（跨接）。擋掉的是圓環掛在筆畫邊緣外、中心懸空，以及太陡的斜坡。
//   4. 不穿洞：從正面看，沒有任何筆畫伸進圓環的洞（避免圓環看起來被金屬穿過）。
//   5. 不埋太深：掛點不低於作品最高點往下 BAND。
// 挑選（作品擺正優先）：在合格候選裡選離重心垂直線最近的；幾乎同距離才用「右邊」與高度決勝。
//   作品會不會歪只看掛點與重心的水平距離，跟高度無關，高度只當上限（BAND）。
// 網格對齊 0.1mm 的整數倍，回傳的 x、y 可以直接當滑桿值（滑桿 step 0.1）。
// 回傳 { x, y, z, rot }，rot 為弧度（0 或 π/2）。geometry 需已 computeBoundingBox()。

export const RING_CENTER_ABOVE_ATTACH = 1.2;
export const AUTO_TURN_WIDTH_RATIO = 1.4; // 字母 B 寬度 > 字母 A × 1.4 才自動轉向

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
    // 圓環＋墜頭轉向較寬的字母（作品本體不轉）：鏈子會讓圓環平面朝前，窄字母當正面時戴起來會被帶著轉 90°
    // 字母 B 明顯較寬（寬 40% 以上）才轉 → 圓環平面平行字母 B；寬度差不多就維持預設方向（2026-10-28 使用者定 40%）
    const rotB = (bb.max.y - bb.min.y) > (bb.max.x - bb.min.x) * AUTO_TURN_WIDTH_RATIO;
    const cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2; // 作品正中央
    // 以 (u, v) 存取高度圖：u 沿圓環平面、v 沿管徑方向
    const nu = rotB ? ny : nx, nv = rotB ? nx : ny;
    const H = rotB ? (u, v) => hm[v * ny + u] : (u, v) => hm[u * ny + v];
    // 從正面看，每個 u 位置上整件作品的最高點（不分前後深度）
    const faceMax = new Float32Array(nu).fill(-Infinity);
    for (let u = 0; u < nu; u++) for (let v = 0; v < nv; v++) { const h = H(u, v); if (h > faceMax[u]) faceMax[u] = h; }

    const R_IN = 1.0, TUBE = 0.3, R_OUT = R_IN + 2 * TUBE;       // 圓環內半徑、管半徑、外半徑（同 ring-bail.js）
    const FUSE = R_OUT - RING_CENTER_ABOVE_ATTACH;               // 0.4：碰到後再下沉的熔接深度（碰到時中心離表面 R_OUT，最後離掛點 1.2）
    const BAND = 1.0, TIE = 0.3, GAP_MAX = 2.0, CONTACT = 0.05, SUPPORT_HALF = 0.3, SUPPORT_SLACK = FUSE, SEAT_DROP = 1.0;
    const RI = Math.round(R_IN / STEP), RO = Math.round(R_OUT / STEP), RB = Math.round(TUBE / STEP), SH = Math.round(SUPPORT_HALF / STEP);
    // 每個 u 位置在管徑範圍（v ±TUBE）內的最高點：圓環管子碰到的就是這個
    const cm = new Float32Array(nu * nv).fill(-Infinity);
    for (let u = 0; u < nu; u++) for (let v = 0; v < nv; v++) {
        let h = -Infinity;
        for (let b = -RB; b <= RB; b++) { const vv = v + b; if (vv < 0 || vv >= nv) continue; const t = H(u, vv); if (t > h) h = t; }
        cm[u * nv + v] = h;
    }
    const off = []; for (let a = -RO; a <= RO; a++) off[a + RO] = Math.sqrt(Math.max(0, R_OUT * R_OUT - (a * STEP) ** 2)); // 外緣在水平偏移 a 處離中心的垂直距離
    const round1 = n => Math.round(n * 10) / 10;
    const cands = [];
    for (let u = 0; u < nu; u++) {
        for (let v = 0; v < nv; v++) {
            // 1. 放下：圓環中心能降到的最低高度 = 各欄「表面高度 + 外緣垂直距離」的最大值
            let zc = -Infinity;
            for (let a = -RO; a <= RO; a++) {
                const uu = u + a; if (uu < 0 || uu >= nu) continue;
                const h = cm[uu * nv + v]; if (h === -Infinity) continue;
                const z = h + off[a + RO]; if (z > zc) zc = z;
            }
            if (zc === -Infinity) continue;
            // 3. 站得住：正下方 ±SUPPORT_HALF 內有實體貼著（容許 SUPPORT_SLACK 的縫，熔接會填掉），或左右兩側都碰到
            let supported = false, aL = -Infinity, aR = Infinity;
            for (let a = -RO; a <= RO; a++) {
                const uu = u + a; if (uu < 0 || uu >= nu) continue;
                const h = cm[uu * nv + v]; if (h === -Infinity) continue;
                const gap = zc - off[a + RO] - h; // 圓環外緣在這欄離表面的距離
                if (Math.abs(a) <= SH && gap <= SUPPORT_SLACK) supported = true;
                // 跨接：記兩側「最靠近中心」的接觸欄；容差用熔接深度（碰到高的一側後再下沉 FUSE，差 FUSE 以內的另一側也會焊到，Amatic SC U 左右臂差 0.2 要掛中央）
                if (gap <= SUPPORT_SLACK) { if (a < 0 && a > aL) aL = a; if (a > 0 && a < aR) aR = a; }
            }
            if (!supported) {
                const bridged = aL > -Infinity && aR < Infinity && aL < -SH && aR > SH && (aR - aL) * STEP <= GAP_MAX + 1e-6;
                if (!bridged) continue;
            }
            // 2. 熔接：下沉 FUSE → 掛點 = 圓環中心 − RING_CENTER_ABOVE_ATTACH
            const z = zc - FUSE - RING_CENTER_ABOVE_ATTACH;
            // 5. 不埋太深
            if (z < bb.max.z - BAND) continue;
            // 6. 前後不被夾住：圓環平面前後（管徑外 0.4～1.3mm）若有比掛點高 0.5mm 以上的壁，圓環等於陷在兩筆之間的縫裡（V×V 的凹口）
            let pinched = false;
            for (let b = RB + 1; b <= RB + 10 && !pinched; b++) for (const sgn of [-1, 1]) {
                const vv = v + sgn * b; if (vv < 0 || vv >= nv) continue;
                if (H(u, vv) > z + 0.5) { pinched = true; break; }
            }
            if (pinched) continue;
            // 4. 不穿洞：洞的下緣在水平偏移 d 處的高度 = 中心 − √(R_IN² − d²)
            let pierce = false;
            for (let a = -RI + 1; a <= RI - 1 && !pierce; a++) {
                const uu = u + a; if (uu < 0 || uu >= nu) continue;
                const d = a * STEP;
                if (faceMax[uu] > z + RING_CENTER_ABOVE_ATTACH - Math.sqrt(R_IN * R_IN - d * d) + CONTACT) pierce = true;
            }
            if (pierce) continue;
            // 7. 管子要坐實：接觸欄在前後 ±TUBE 內若有比接觸面低 SEAT_DROP 以上的格子（沒作品也算），管子就有半邊懸空，不算候選。
            //    凹口邊緣（V×V、M×M 字母 2 的凹口）和筆畫外緣一視同仁；V 會落在臂尖最寬處
            let cliff = false;
            for (let a = -RO; a <= RO && !cliff; a++) {
                const uu = u + a; if (uu < 0 || uu >= nu) continue;
                const h = cm[uu * nv + v]; if (h === -Infinity) continue;
                if (zc - off[a + RO] - h > CONTACT) continue;      // 只看真的碰到的欄
                for (let b = -RB; b <= RB; b++) { const vv = v + b; const t = (vv < 0 || vv >= nv) ? -Infinity : H(uu, vv); if (h - t > SEAT_DROP) { cliff = true; break; } }
            }
            if (cliff) continue;
            const i = rotB ? v : u, j = rotB ? u : v, x = x0 + i * STEP, y = y0 + j * STEP;
            // du：正面看與重心的左右偏移（字母 A 朝前時沿 x；字母 B 朝前時沿 y，B 是由 A 繞 Z 轉 90° 而來，從 +X 看時右手邊是 +y）
            // dc：正面看與作品正中央的距離；dv：前後與重心的距離
            const du = rotB ? y - my : x - mx, dc = Math.abs(rotB ? y - cy : x - cx), dcy = Math.abs(rotB ? x - cx : y - cy), dv = Math.abs(rotB ? x - mx : y - my);
            cands.push({ x, y, z, du: Math.abs(du), dc, dcy, dv, zTop: bb.max.z - z, right: du > 0 });
        }
    }
    if (!cands.length) return { x: 0, y: 0, z: bb.max.z, rot: rotB ? Math.PI / 2 : 0 };
    // 逐關過濾：每一關只留下「跟最佳值差 TIE 以內」的候選，再進下一關
    let pool = cands;
    // 挑選：作品擺正優先——在合格候選（站得住、不穿洞、不埋太深、坐實）裡直接選離重心垂直線最近的（左右、前後一起算），
    // 作品掛起來才不會歪。I、B、D 這類字會剛好落在重心正上方；V×V 中央是凹口（太深/懸空）就自然往外到臂尖。
    // 幾乎同距離（0.05 內）才用「右邊」（掛點在重心右邊，作品逆時針成仰角，像往上寫）與高度決勝。
    let best = null, bestD = Infinity;
    for (const c of cands) {
        const d = Math.hypot(c.du, c.dv);
        if (d < bestD - 0.05) { best = c; bestD = d; continue; }
        if (Math.abs(d - bestD) <= 0.05 && best && (c.right !== best.right ? c.right : c.z > best.z)) { best = c; bestD = Math.min(bestD, d); }
    }
    return { x: round1(best.x), y: round1(best.y), z: best.z, rot: rotB ? Math.PI / 2 : 0 };
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

// ─────────────────────────────────────────────────────────────────────────────
// 使用者拉 X/Y 滑桿時的「跟著放下」：同一套放下模擬，但只在指定位置算一次。
// buildRingHeightMap 每個作品算一次高度圖（與 findAttachPoint 相同的投影，之後可共用重構），
// dropRingAt 在 (x, y)、圓環平面角 rot 處把圓環放下，回傳 { z: 掛點高度, supported: 站不站得住, contact: 接觸點偏移mm }。
// 站不住（斜面太陡、中心懸空）時呼叫端應保留原本的 Z。沒有任何表面可碰時回傳 null。
export function buildRingHeightMap(geometry) {
    if (geometry.index) geometry = geometry.toNonIndexed();
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const STEP = 0.1, bb = geometry.boundingBox, p = geometry.attributes.position.array;
    const x0 = Math.floor(bb.min.x / STEP) * STEP, y0 = Math.floor(bb.min.y / STEP) * STEP;
    const nx = Math.ceil((bb.max.x - x0) / STEP) + 1, ny = Math.ceil((bb.max.y - y0) / STEP) + 1;
    const hm = new Float32Array(nx * ny).fill(-Infinity);
    for (let t = 0; t < p.length; t += 9) {
        const ax = p[t], ay = p[t + 1], az = p[t + 2], bx = p[t + 3], by = p[t + 4], bz = p[t + 5], qx = p[t + 6], qy = p[t + 7], qz = p[t + 8];
        const d = (by - qy) * (ax - qx) + (qx - bx) * (ay - qy);
        if (Math.abs(d) < 1e-12) continue;
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
    return { hm, x0, y0, nx, ny, step: STEP };
}

export function dropRingAt(map, x, y, rot = 0) {
    const { hm, x0, y0, nx, ny, step: STEP } = map;
    const R_IN = 1.0, TUBE = 0.3, R_OUT = R_IN + 2 * TUBE;
    const FUSE = R_OUT - RING_CENTER_ABOVE_ATTACH, CONTACT = 0.05, SUPPORT_HALF = 0.3, SUPPORT_SLACK = FUSE, GAP_MAX = 2.0;
    const RO = Math.round(R_OUT / STEP), RB = Math.round(TUBE / STEP), SH = Math.round(SUPPORT_HALF / STEP);
    const cu = Math.cos(rot), su = Math.sin(rot);          // u：圓環平面的水平軸；v：管徑方向
    const sample = (px, py) => {
        const i = Math.round((px - x0) / STEP), j = Math.round((py - y0) / STEP);
        return (i < 0 || i >= nx || j < 0 || j >= ny) ? -Infinity : hm[i * ny + j];
    };
    // 每個 u 偏移在管徑範圍內的最高點
    const col = new Float32Array(2 * RO + 1).fill(-Infinity);
    for (let a = -RO; a <= RO; a++) {
        let h = -Infinity;
        for (let b = -RB; b <= RB; b++) {
            const t = sample(x + (a * cu - b * su) * STEP, y + (a * su + b * cu) * STEP);
            if (t > h) h = t;
        }
        col[a + RO] = h;
    }
    let zc = -Infinity;
    for (let a = -RO; a <= RO; a++) {
        const h = col[a + RO]; if (h === -Infinity) continue;
        const z = h + Math.sqrt(Math.max(0, R_OUT * R_OUT - (a * STEP) ** 2)); if (z > zc) zc = z;
    }
    if (zc === -Infinity) return null;
    let supported = false, aL = -Infinity, aR = Infinity, contact = 0, best = Infinity;
    for (let a = -RO; a <= RO; a++) {
        const h = col[a + RO]; if (h === -Infinity) continue;
        const gap = zc - Math.sqrt(Math.max(0, R_OUT * R_OUT - (a * STEP) ** 2)) - h;
        if (Math.abs(a) <= SH && gap <= SUPPORT_SLACK) supported = true;
        if (gap <= SUPPORT_SLACK) { if (a < 0 && a > aL) aL = a; if (a > 0 && a < aR) aR = a; } // 跨接：兩側最靠近中心的接觸欄，容差同 findAttachPoint
        if (gap < best) { best = gap; contact = a * STEP; }
    }
    if (!supported && aL > -Infinity && aR < Infinity && aL < -SH && aR > SH && (aR - aL) * STEP <= GAP_MAX + 1e-6) supported = true; // 跨接兩筆
    const z = zc - FUSE - RING_CENTER_ABOVE_ATTACH;
    // 坑深：圓環周圍 2.5mm（各方向）內的最高點比掛點高多少。掉進 U 的杯底、貼在高牆旁邊時會很大；m 左右弧的高低差不到 2mm
    let pit = 0; const PR = Math.round(2.5 / STEP);
    for (let a = -PR; a <= PR; a++) for (let b = -PR; b <= PR; b++) {
        if (a * a + b * b > PR * PR) continue;
        const h = sample(x + a * STEP, y + b * STEP); if (h - z > pit) pit = h - z;
    }
    return { z, supported, contact, pit };
}
