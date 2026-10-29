// 圓環「套住」判斷（design-studio 用）
//
// 使用者手動把圓環移到作品的封閉迴圈裡（例如 A 的三角形洞）時，圓環沒有焊在作品上，而是像鑰匙圈
// 一樣勾住一根筆畫。這時佩戴傾斜要改成繞圓環內圈最低點轉。m 的弧線頂端那種一動就滑掉的不算。
//
// 判斷是拓樸的：圓環的「洞」是一個圓盤，把圓盤那一層從作品實心裡暫時挖掉，從圓盤一側的材料出發做
// 3D 填充，能繞到圓盤另一側就代表有一條封閉迴圈穿過圓環。
// 作品實心 = 字母 A 的 2D 遮罩 (x,z) × 字母 B 的 2D 遮罩 (y,z)，跟後端的交集定義一樣，
// 遮罩在 CSG 前用正交相機把兩個擠出幾何各拍一張得到（對 CSG 網格打射線的奇偶判斷不可靠）。
// 只支援圓環旋轉 0°（平面 XZ）與 90°（平面 YZ），中間角度取最接近的。
import * as THREE from 'three';

const MASK_STEP = 0.1;   // 遮罩解析度（mm）
const VOX_STEP = 0.2;    // 3D 填充用的體素（mm）
const R_IN = 1.0, TUBE = 0.3, R_OUT = R_IN + 2 * TUBE;

// 把一個擠出幾何沿擠出軸正交投影成遮罩。axis: 'y'（字母 A，看 x,z）或 'x'（字母 B，看 y,z）
function renderMask(renderer, geometry, axis) {
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox;
    const u0 = axis === 'y' ? bb.min.x : bb.min.y, u1 = axis === 'y' ? bb.max.x : bb.max.y;
    const v0 = bb.min.z, v1 = bb.max.z;
    const margin = 0.3;
    const nu = Math.ceil((u1 - u0 + 2 * margin) / MASK_STEP), nv = Math.ceil((v1 - v0 + 2 * margin) / MASK_STEP);
    const uStart = u0 - margin, vStart = v0 - margin;
    const cam = new THREE.OrthographicCamera(0, nu * MASK_STEP, nv * MASK_STEP, 0, 0.1, 500);
    // 相機框從 (uStart, vStart) 起算：把 left/right/top/bottom 設成相對於相機中心的偏移
    const cu = uStart + nu * MASK_STEP / 2, cv = vStart + nv * MASK_STEP / 2;
    cam.left = -nu * MASK_STEP / 2; cam.right = nu * MASK_STEP / 2; cam.top = nv * MASK_STEP / 2; cam.bottom = -nv * MASK_STEP / 2;
    cam.up.set(0, 0, 1);
    if (axis === 'y') { cam.position.set(cu, -200, cv); cam.lookAt(cu, 0, cv); }       // 看 +y：影像左→右 = +x
    else { cam.position.set(200, cu, cv); cam.lookAt(0, cu, cv); }                      // 看 −x：影像左→右 = +y
    cam.updateProjectionMatrix();
    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    scene.add(mesh);
    const rt = new THREE.WebGLRenderTarget(nu, nv);
    const prevTarget = renderer.getRenderTarget();
    const prevClear = new THREE.Color(); renderer.getClearColor(prevClear); const prevAlpha = renderer.getClearAlpha();
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, cam);
    const px = new Uint8Array(nu * nv * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, nu, nv, px);     // 列 0 = 影像下方 = v 最小
    renderer.setRenderTarget(prevTarget); renderer.setClearColor(prevClear, prevAlpha);
    rt.dispose(); mesh.material.dispose();
    const data = new Uint8Array(nu * nv);
    for (let v = 0; v < nv; v++) for (let u = 0; u < nu; u++) data[u * nv + v] = px[(v * nu + u) * 4] > 127 ? 1 : 0;
    return { data, nu, nv, uStart, vStart };
}

// 在 CSG 之前呼叫：geoA 在 XZ 平面沿 y 擠出、geoB 在 YZ 平面沿 x 擠出（design-studio 旋轉後的狀態）
export function captureLetterMasks(renderer, geoA, geoB) {
    return { A: renderMask(renderer, geoA, 'y'), B: renderMask(renderer, geoB, 'x'), step: MASK_STEP, offset: { x: 0, y: 0, z: 0 }, occ: null };
}

// CSG 結果平移到原點後，遮罩座標也要跟著平移（center 是被減掉的那個向量）
export function shiftMasks(masks, center) {
    masks.offset = { x: center.x, y: center.y, z: center.z };
    masks.occ = null;
}

function sampleMask(m, u, v) {
    const i = Math.round((u - m.uStart) / MASK_STEP), j = Math.round((v - m.vStart) / MASK_STEP);
    return (i < 0 || i >= m.nu || j < 0 || j >= m.nv) ? 0 : m.data[i * m.nv + j];
}

// 0.2mm 體素的實心（作品座標），第一次用到時建立
function getOccupancy(masks) {
    if (masks.occ) return masks.occ;
    const A = masks.A, B = masks.B, o = masks.offset, S = VOX_STEP;
    const x0 = A.uStart - o.x, y0 = B.uStart - o.y, z0 = Math.min(A.vStart, B.vStart) - o.z;
    const nx = Math.ceil(A.nu * MASK_STEP / S), ny = Math.ceil(B.nu * MASK_STEP / S);
    const nz = Math.ceil((Math.max(A.vStart + A.nv * MASK_STEP, B.vStart + B.nv * MASK_STEP) - Math.min(A.vStart, B.vStart)) / S);
    const occ = new Uint8Array(nx * ny * nz);
    for (let i = 0; i < nx; i++) {
        const x = x0 + (i + 0.5) * S;
        for (let k = 0; k < nz; k++) {
            const z = z0 + (k + 0.5) * S;
            if (!sampleMask(A, x + o.x, z + o.z)) continue;
            for (let j = 0; j < ny; j++) {
                const y = y0 + (j + 0.5) * S;
                if (sampleMask(B, y + o.y, z + o.z)) occ[(i * ny + j) * nz + k] = 1;
            }
        }
    }
    masks.occ = { occ, nx, ny, nz, x0, y0, z0, S };
    return masks.occ;
}

// 回傳 'touch'（圓環管子碰到作品 → 當焊接處理）、'threaded'（套住）、'none'（懸空）
export function ringLinkState(masks, ringPos, rotDeg) {
    if (!masks) return 'none';
    const g = getOccupancy(masks), { occ, nx, ny, nz, x0, y0, z0, S } = g;
    const rotB = Math.abs(((rotDeg % 180) + 180) % 180 - 90) < 45;   // 接近 90° → 圓環平面 YZ
    // 以 (u, v=層, w) 存取：u、w 是圓環平面內的兩軸，v 是法線方向的層
    const nu = rotB ? ny : nx, nvl = rotB ? nx : ny;
    const idx = rotB ? (u, v, w) => (v * ny + u) * nz + w : (u, v, w) => (u * ny + v) * nz + w;
    const cu = Math.round(((rotB ? ringPos.y - y0 : ringPos.x - x0) / S) - 0.5);
    const cv = Math.round(((rotB ? ringPos.x - x0 : ringPos.y - y0) / S) - 0.5);
    const cw = Math.round(((ringPos.z - z0) / S) - 0.5);
    if (cv < 0 || cv >= nvl) return 'none';
    const inPlane = (u, w) => u >= 0 && u < nu && w >= 0 && w < nz;
    const rIn = R_IN / S, rOut = R_OUT / S, tubeLayers = Math.max(1, Math.round(TUBE / S));
    // 1. 管子有沒有碰到作品：環帶 [R_IN, R_OUT] × 法線 ±TUBE
    let touch = false, holeHasMaterial = false;
    const span = Math.ceil(rOut) + 1;
    for (let du = -span; du <= span && !touch; du++) for (let dw = -span; dw <= span; dw++) {
        const u = cu + du, w = cw + dw; if (!inPlane(u, w)) continue;
        const r = Math.hypot(du, dw);
        if (r >= rIn && r <= rOut) {
            for (let dv = -tubeLayers; dv <= tubeLayers; dv++) { const v = cv + dv; if (v >= 0 && v < nvl && occ[idx(u, v, w)]) { touch = true; break; } }
            if (touch) break;
        } else if (r < rIn && occ[idx(u, cv, w)]) holeHasMaterial = true;
    }
    if (touch) return 'touch';
    if (!holeHasMaterial) return 'none';
    // 2. 挖掉圓盤那一層，從 +v 側的材料出發填充，看能不能到 −v 側
    const blocked = (u, v, w) => v === cv && Math.hypot(u - cu, w - cw) <= rIn + 1;
    const visited = new Uint8Array(occ.length);
    const queue = new Int32Array(occ.length); let qh = 0, qt = 0;
    const push = (u, v, w) => { const k = idx(u, v, w); if (!visited[k] && occ[k] && !blocked(u, v, w)) { visited[k] = 1; queue[qt++] = k; } };
    if (cv + 1 >= nvl || cv - 1 < 0) return 'none';
    for (let du = -Math.ceil(rIn); du <= Math.ceil(rIn); du++) for (let dw = -Math.ceil(rIn); dw <= Math.ceil(rIn); dw++) {
        const u = cu + du, w = cw + dw;
        if (inPlane(u, w) && Math.hypot(du, dw) <= rIn) push(u, cv + 1, w);
    }
    const decode = rotB
        ? (k) => { const w = k % nz, t = (k - w) / nz, u = t % ny, v = (t - u) / ny; return [u, v, w]; }
        : (k) => { const w = k % nz, t = (k - w) / nz, v = t % ny, u = (t - v) / ny; return [u, v, w]; };
    while (qh < qt) {
        const k = queue[qh++]; const [u, v, w] = decode(k);
        if (v === cv - 1 && Math.hypot(u - cu, w - cw) <= rIn) return 'threaded';
        if (u > 0) push(u - 1, v, w); if (u < nu - 1) push(u + 1, v, w);
        if (v > 0) push(u, v - 1, w); if (v < nvl - 1) push(u, v + 1, w);
        if (w > 0) push(u, v, w - 1); if (w < nz - 1) push(u, v, w + 1);
    }
    return 'none';
}

// 斜焊碰撞檢查（2026-10-29 使用者決定）：圓環側邊、下半圈碰到其他筆畫沒關係（多一點熔接），
// 但頂端是掛墜頭的地方，不能被筆畫擋住。禁區 = 頂端左右各 60° 的管子 + 洞的上半部 + 墜頭下緣會佔的空間。
// ringPos = 擺正時的圓環中心（焊接點在正下方 1.2mm），weld = 斜焊角度（弧度，繞圓環平面法向量轉）。
export function weldTopClear(masks, ringPos, rotDeg, weld) {
    if (!masks) return true;
    const g = getOccupancy(masks), { occ, nx, ny, nz, x0, y0, z0, S } = g;
    const rz = rotDeg * Math.PI / 180, cr = Math.cos(rz), sr = Math.sin(rz);
    const u = [cr, sr, 0], n = [-sr, cr, 0], cw = Math.cos(weld), sw = Math.sin(weld);
    const w = [sw * u[0], sw * u[1], cw], p = [cw * u[0], cw * u[1], -sw];   // w = 斜焊後的圓環軸線（往上）、p = 平面內與 w 垂直
    const ax = ringPos.x, ay = ringPos.y, az = ringPos.z - 1.2;
    const cx = ax + 1.2 * w[0], cy = ay + 1.2 * w[1], cz = az + 1.2 * w[2];
    const solid = (s, t, l) => {                                             // 圓環座標（沿 w、沿 p、沿 n）→ 作品實心？
        const x = cx + s * w[0] + t * p[0] + l * n[0], y = cy + s * w[1] + t * p[1] + l * n[1], z = cz + s * w[2] + t * p[2];
        const i = Math.floor((x - x0) / S), j = Math.floor((y - y0) / S), k = Math.floor((z - z0) / S);
        return i >= 0 && i < nx && j >= 0 && j < ny && k >= 0 && k < nz && occ[(i * ny + j) * nz + k] === 1;
    };
    const RC = R_IN + TUBE, H = 0.1;
    for (let a = -60; a <= 60; a += 5) {                                     // 頂端管子
        const ca = Math.cos(a * Math.PI / 180), sa = Math.sin(a * Math.PI / 180);
        for (let r = R_IN; r <= R_OUT + 1e-6; r += H) for (let l = -TUBE; l <= TUBE + 1e-6; l += H) {
            if ((r - RC) ** 2 + l * l > TUBE * TUBE + 1e-6) continue;
            if (solid(r * ca, r * sa, l)) return false;
        }
    }
    for (let s = 0; s < R_IN; s += H) for (let t = -R_IN; t <= R_IN; t += H)  // 洞的上半部
        if (s * s + t * t < R_IN * R_IN && solid(s, t, 0)) return false;
    for (let s = R_OUT; s <= 3.0; s += H) for (let t = -0.5; t <= 0.5 + 1e-6; t += H) for (let l = -1.0; l <= 1.0 + 1e-6; l += H)
        if (solid(s, t, l)) return false;                                    // 墜頭下緣
    return true;
}

// 斜焊角度碰到禁區時往直立方向縮小，直到頂端淨空（直立 = 舊焊法，已通過既有檢查，所以一定有解）
export function clampWeldTilt(masks, ringPos, rotDeg, weld) {
    for (let k = 20; k > 0; k--) { const w = weld * k / 20; if (weldTopClear(masks, ringPos, rotDeg, w)) return w; }
    return 0;
}
