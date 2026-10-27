// 交接縫倒圓角的著色模擬（design-studio 用）
//
// 後端訂單 STL 會用距離場平滑交集把兩個字母壁面相交的「縫」倒成約 0.18mm 的圓角（見 backend 的 SDF 管線）。
// 前端不走 STL（慢、面狀），改成幾何不動、只改法向量：在縫兩側 SEAM_RADIUS_MM 內把法向量從本面漸變到
// 兩面的角平分線，畫出來就是圓角的高光帶。半徑 0.18mm 在 10mm 作品上輪廓看不出差別，看得到的只有高光。
//
// 縫的判斷不靠角度猜：CSG 時兩個 brush 用不同材質，結果 geometry.groups 會標每個面來自字母 A（0）或 B（1），
// 一條邊兩側的面來自不同字母才是縫；字母自己的轉角（兩側同字母）不會被誤圓。
// 沒有 groups 的幾何（例如清理分離部件後換進來的後端 STL）退而用法向量判斷：A 的壁面法向量沒有 y 分量、
// B 的沒有 x 分量；兩者都沒有（朝 ±z 的水平壁）分不出來，就不在那些邊上倒圓。
import * as THREE from 'three';

export const SEAM_RADIUS_MM = 0.18;

// 所有已編譯著色器的半徑 uniform，讓 setSeamRadius 可以即時改（驗證/調參用）
const _radiusUniforms = new Set();
let _currentRadius = SEAM_RADIUS_MM;
export function setSeamRadius(r) {
    _currentRadius = r;
    for (const u of _radiusUniforms) u.value = r;
}
export function getSeamRadius() { return _currentRadius; }
// console 可用：DUET_setSeamRadius(0.6) 看明顯效果、DUET_setSeamRadius(0) 關掉、DUET_setSeamRadius(0.18) 回預設
if (typeof window !== 'undefined') window.DUET_setSeamRadius = setSeamRadius;

// 在 non-indexed geometry 上建立著色器需要的屬性。每個三角形的三個頂點存同一組資料：
//   aBary   頂點的重心座標 (1,0,0)/(0,1,0)/(0,0,1)
//   aSeamN0/1/2  第 j 條邊（頂點 j 對面那條）另一側面的法向量（物件空間）；不是縫則為 0
//   aSeamH  頂點 j 到第 j 條邊的距離（mm）；不是縫則為 0 → 片段著色器用 bary_j × h_j 得到到該邊的實際距離
// 回傳縫邊的數量；geometry 不符合（indexed、無位置）回傳 -1。
export function buildSeamAttributes(geometry) {
    const posAttr = geometry.attributes.position;
    if (!posAttr || geometry.index) return -1;
    const P = posAttr.array, nVert = posAttr.count, nTri = nVert / 3;

    // 每個面來自哪個字母
    const src = new Int8Array(nTri).fill(-1);
    const groups = geometry.groups || [];
    const useGroups = groups.length >= 2;
    const fn = new Float32Array(nTri * 3);
    const EPS = 1e-3;
    for (let t = 0; t < nTri; t++) {
        const i = t * 9;
        const ax = P[i], ay = P[i + 1], az = P[i + 2], bx = P[i + 3], by = P[i + 4], bz = P[i + 5], cx = P[i + 6], cy = P[i + 7], cz = P[i + 8];
        const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const len = Math.hypot(nx, ny, nz);
        if (len < 1e-12) continue;
        nx /= len; ny /= len; nz /= len;
        fn[t * 3] = nx; fn[t * 3 + 1] = ny; fn[t * 3 + 2] = nz;
        if (!useGroups) {
            if (Math.abs(ny) < EPS && Math.abs(nx) > EPS) src[t] = 0;
            else if (Math.abs(nx) < EPS && Math.abs(ny) > EPS) src[t] = 1;
        }
    }
    if (useGroups) {
        for (const g of groups) {
            const t0 = g.start / 3, t1 = (g.start + g.count) / 3;
            for (let t = t0; t < t1; t++) src[t] = g.materialIndex === 0 ? 0 : 1;
        }
    }

    // 邊 → 用到它的面。頂點以 1e-4mm 量化（要在 0.001 法向偏移之前呼叫，偏移後縫兩側頂點會分開）
    const Q = 1e4;
    const vkey = (v) => `${Math.round(P[v * 3] * Q)},${Math.round(P[v * 3 + 1] * Q)},${Math.round(P[v * 3 + 2] * Q)}`;
    const edgeMap = new Map();
    for (let t = 0; t < nTri; t++) {
        const k = [vkey(t * 3), vkey(t * 3 + 1), vkey(t * 3 + 2)];
        for (let j = 0; j < 3; j++) {           // 第 j 條邊 = 頂點 (j+1)%3 與 (j+2)%3
            const a = k[(j + 1) % 3], b = k[(j + 2) % 3];
            const ek = a < b ? a + '|' + b : b + '|' + a;
            let list = edgeMap.get(ek);
            if (!list) { list = []; edgeMap.set(ek, list); }
            list.push(t * 3 + j);
        }
    }

    const bary = new Float32Array(nVert * 3), seamH = new Float32Array(nVert * 3);
    const seamN = [new Float32Array(nVert * 3), new Float32Array(nVert * 3), new Float32Array(nVert * 3)];
    const COS_MIN_ANGLE = Math.cos(THREE.MathUtils.degToRad(8)); // 兩面幾乎共面就不算縫
    let seamCount = 0;
    for (let t = 0; t < nTri; t++) {
        for (let v = 0; v < 3; v++) bary[(t * 3 + v) * 3 + v] = 1;
        if (src[t] < 0) continue;
        const k = [vkey(t * 3), vkey(t * 3 + 1), vkey(t * 3 + 2)];
        for (let j = 0; j < 3; j++) {
            const a = k[(j + 1) % 3], b = k[(j + 2) % 3];
            const list = edgeMap.get(a < b ? a + '|' + b : b + '|' + a);
            let nb = -1;
            for (const e of list) {
                const tt = (e - e % 3) / 3;
                if (tt === t || src[tt] < 0 || src[tt] === src[t]) continue;
                const dot = fn[t * 3] * fn[tt * 3] + fn[t * 3 + 1] * fn[tt * 3 + 1] + fn[t * 3 + 2] * fn[tt * 3 + 2];
                if (dot > COS_MIN_ANGLE || dot < -0.999) continue;
                nb = tt; break;
            }
            if (nb < 0) continue;
            // 頂點 j 到第 j 條邊的距離 = 2×面積 / 邊長
            const pj = t * 3 + j, p1 = t * 3 + (j + 1) % 3, p2 = t * 3 + (j + 2) % 3;
            const ex = P[p2 * 3] - P[p1 * 3], ey = P[p2 * 3 + 1] - P[p1 * 3 + 1], ez = P[p2 * 3 + 2] - P[p1 * 3 + 2];
            const wx = P[pj * 3] - P[p1 * 3], wy = P[pj * 3 + 1] - P[p1 * 3 + 1], wz = P[pj * 3 + 2] - P[p1 * 3 + 2];
            const crx = ey * wz - ez * wy, cry = ez * wx - ex * wz, crz = ex * wy - ey * wx;
            const elen = Math.hypot(ex, ey, ez);
            if (elen < 1e-9) continue;
            const h = Math.hypot(crx, cry, crz) / elen;
            for (let v = 0; v < 3; v++) {
                const o = (t * 3 + v) * 3;
                seamH[o + j] = h;
                seamN[j][o] = fn[nb * 3]; seamN[j][o + 1] = fn[nb * 3 + 1]; seamN[j][o + 2] = fn[nb * 3 + 2];
            }
            seamCount++;
        }
    }
    geometry.setAttribute('aBary', new THREE.BufferAttribute(bary, 3));
    geometry.setAttribute('aSeamH', new THREE.BufferAttribute(seamH, 3));
    geometry.setAttribute('aSeamN0', new THREE.BufferAttribute(seamN[0], 3));
    geometry.setAttribute('aSeamN1', new THREE.BufferAttribute(seamN[1], 3));
    geometry.setAttribute('aSeamN2', new THREE.BufferAttribute(seamN[2], 3));
    return seamCount;
}

// 把倒圓角著色接進 MeshStandardMaterial。沒有上述屬性的幾何（圓環、墜頭）屬性值全為 0，著色不受影響。
// clone() 也會帶著這個著色（three 的 Material.copy 不複製 onBeforeCompile，這裡自己接）。
export function applySeamRounding(material, radius = SEAM_RADIUS_MM) {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uSeamR = { value: _currentRadius };
        _radiusUniforms.add(shader.uniforms.uSeamR);
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', `#include <common>
attribute vec3 aBary; attribute vec3 aSeamH; attribute vec3 aSeamN0; attribute vec3 aSeamN1; attribute vec3 aSeamN2;
varying vec3 vBary; varying vec3 vSeamH; varying vec3 vSeamN0; varying vec3 vSeamN1; varying vec3 vSeamN2;`)
            .replace('#include <begin_vertex>', `#include <begin_vertex>
vBary = aBary; vSeamH = aSeamH;
vSeamN0 = normalMatrix * aSeamN0; vSeamN1 = normalMatrix * aSeamN1; vSeamN2 = normalMatrix * aSeamN2;`);
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>
uniform float uSeamR;
varying vec3 vBary; varying vec3 vSeamH; varying vec3 vSeamN0; varying vec3 vSeamN1; varying vec3 vSeamN2;
vec3 duetSeamBlend(vec3 n, vec3 n0, float bary, float h, vec3 nb) {
    if (h <= 0.0 || dot(nb, nb) < 0.25) return n;
    float t = clamp(1.0 - (bary * h) / uSeamR, 0.0, 1.0);   // 離縫越近越偏向角平分線
    vec3 bis = normalize(n0 + normalize(nb));
    return n + t * (bis - n0);
}`)
            .replace('#include <normal_fragment_maps>', `{
    vec3 n0 = normal;
    vec3 nN = n0;
    nN = duetSeamBlend(nN, n0, vBary.x, vSeamH.x, vSeamN0);
    nN = duetSeamBlend(nN, n0, vBary.y, vSeamH.y, vSeamN1);
    nN = duetSeamBlend(nN, n0, vBary.z, vSeamH.z, vSeamN2);
    normal = normalize(nN);
    nonPerturbedNormal = normal;
}
#include <normal_fragment_maps>`);
    };
    material.customProgramCacheKey = () => 'duet-seam-rounding';
    material.clone = function () {
        const c = THREE.MeshStandardMaterial.prototype.clone.call(this);
        applySeamRounding(c, radius);
        return c;
    };
    return material;
}
