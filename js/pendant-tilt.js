// 佩戴傾斜：作品掛起來時，靜止狀態重心一定在懸掛點正下方。
// 懸掛點跟重心有水平偏移時，作品會轉到重心垂下來為止——這就是實際戴起來會歪的角度。
// 只做顯示，mesh 自己的座標完全不動（存檔、後端座標、分享圖讀的都是 mesh 座標）。
import * as THREE from 'three';

const RING_INNER_R = 1.0;                   // 圓環內半徑（同 ring-bail.js）
const RING_ABOVE_ATTACH = 1.2;              // 圓環中心在焊接點上方（同 attach-point.js RING_CENTER_ABOVE_ATTACH）

const _up = new THREE.Vector3(0, 0, 1), _down = new THREE.Vector3(0, 0, -1);
const _u = new THREE.Vector3(), _v = new THREE.Vector3(), _p = new THREE.Vector3(), _k = new THREE.Vector3();
const _qInv = new THREE.Quaternion(), _qW = new THREE.Quaternion();

// 圓環跟作品焊成一體，墜頭保持直立不動。
// 斜焊（2026-10-29 使用者決定）：圓環實際焊接時，以焊接點為圓心、在圓環平面內轉到「重心 → 焊接點」的方向，
// 戴起來重心在焊接點正下方，圓環剛好垂直。擺正畫面一律把圓環畫成直的（拉滑桿時圓環才不會晃，使用者覺得直覺）；
// 只有傾斜畫面圓環才照斜焊角度跟作品連在一起。理想情況下切換時圓環、墜頭不動，只有作品繞焊接點擺過去。
// 圓環在墜頭上「滾動」：不管轉到哪個角度，都是圓環內圈「當下」的最高點貼在墜頭下方內側（2026-10-29 使用者指正：
// 不能固定繞擺正時的接觸點轉）。斜焊角度被碰撞限制縮小、圓環前後偏離重心、或過渡動畫途中，接觸點都不在正頂端，靠這個處理。
// 墜頭下方內側的位置 K = 擺正時圓環內圈頂端 = 擺正時圓環中心 + (0,0,內半徑)，在畫面上固定。
// 套在封閉筆畫裡（沒焊）也照同一套規則（使用者選），斜焊角度為 0。

// 圓環資訊（物件座標）：a = 焊接點、n = 圓環平面法向量（旋轉 0° 時平面是 XZ、法向量 +Y）、
// k = 墜頭下方內側（擺正時圓環內圈頂端）、weld = 斜焊角度（弧度，繞 n 轉）、c = 斜焊後的圓環中心
export function ringContact(ringPos, ringRotZ = 0, weld = 0) {
    const n = new THREE.Vector3(-Math.sin(ringRotZ), Math.cos(ringRotZ), 0);
    const a = new THREE.Vector3(ringPos.x, ringPos.y, ringPos.z - RING_ABOVE_ATTACH);
    return { a, n, weld, k: new THREE.Vector3(ringPos.x, ringPos.y, ringPos.z + RING_INNER_R), c: weldedCenter(a, n, weld, new THREE.Vector3()) };
}

// 繞 n 轉 weld：把 +Z 轉向 u = (cos rz, sin rz, 0)（圓環平面的水平軸），所以 weld = atan2(往 u 的分量, 往上的分量)
function weldedCenter(a, n, weld, out) {
    _qW.setFromAxisAngle(n, weld);
    return out.set(0, 0, RING_ABOVE_ATTACH).applyQuaternion(_qW).add(a);
}

// 斜焊角度（弧度）：圓環軸線對準「重心 → 焊接點」在圓環平面內的方向。前後（法向量方向）的偏移斜焊修不了，留給傾斜計算
export function weldTiltAngle(ringPos, centroid, ringRotZ = 0) {
    if (!ringPos || !centroid) return 0;
    const dx = ringPos.x - centroid.x, dy = ringPos.y - centroid.y, dz = ringPos.z - RING_ABOVE_ATTACH - centroid.z;
    const du = dx * Math.cos(ringRotZ) + dy * Math.sin(ringRotZ);
    if (Math.hypot(du, dz) < 1e-6) return 0;
    return Math.atan2(du, dz);
}

// 物件座標中「往上」的方向是 u 時，圓環內圈的最高點
function topInnerPoint(contact, u, out) {
    _v.copy(u).addScaledVector(contact.n, -u.dot(contact.n));          // u 投影到圓環平面
    if (_v.lengthSq() < 1e-10) _v.copy(_up).addScaledVector(contact.n, -_up.dot(contact.n)); // 圓環平躺：退回擺正時的頂端
    return out.copy(contact.c).addScaledVector(_v.normalize(), RING_INNER_R);
}

// 只算目標姿勢不套用：回傳 { q, contact }（q = 旋轉），沒有圓環或重心回傳 null（= 直立）
// weld = 斜焊角度（弧度，weldTiltAngle 算、呼叫端可再因碰撞縮小；套住沒焊時給 0）
// 接觸點會隨角度改變、角度又由接觸點決定：反覆計算到兩者一致（圓環半徑遠小於重心距離，幾次就收斂）
export function computePendantTilt(ringPos, centroid, ringRotZ = 0, weld = 0) {
    if (!ringPos || !centroid) return null;
    const contact = ringContact(ringPos, ringRotZ, weld);
    const g = new THREE.Vector3(centroid.x, centroid.y, centroid.z);
    const d = new THREE.Vector3();
    _u.copy(_up);
    for (let i = 0; i < 12; i++) {
        topInnerPoint(contact, _u, _p);
        d.copy(g).sub(_p);
        if (d.lengthSq() < 1e-12) return null;
        d.normalize();
        // 重心在接觸點正下方 → 物件座標的「上」= 重心指向接觸點的方向
        const du = _u.distanceToSquared(_v.copy(d).negate());
        _u.copy(_v);
        if (du < 1e-12) break;
    }
    // 不設角度上限：接觸點比重心低時真實戴起來就是倒掛，畫面照實顯示（2026-10-28 使用者決定）
    return { q: new THREE.Quaternion().setFromUnitVectors(d, _down), contact };
}

// 套用旋轉 q：圓環內圈當下的最高點對齊墜頭下方內側 K。contact 為 null 時（從沒算過）只能是直立。
// weld = 圓環此刻相對作品的斜焊角度（擺正 0、傾斜 contact.weld，過渡動畫中間值），圓環繞焊接點轉。
// 過渡動畫中每一幀都用當下的 q、weld 重算接觸點，所以轉的過程中圓環也一直貼著墜頭滾動。
const _c = new THREE.Vector3();
export function setPendantPose(group, ringHolder, q, contact, weld = contact ? contact.weld : 0) {
    if (!group) return;
    group.quaternion.copy(q);
    if (contact) {
        _u.copy(_up).applyQuaternion(_qInv.copy(q).invert());              // 物件座標的「上」
        topInnerPoint({ c: weldedCenter(contact.a, contact.n, weld, _c), n: contact.n }, _u, _p);
        group.position.copy(contact.k).sub(_p.applyQuaternion(q));         // pos = K − q·p
    } else group.position.set(0, 0, 0);
    if (ringHolder) {                                                      // 圓環跟著作品轉，再繞焊接點斜 weld
        if (contact && weld) {
            ringHolder.quaternion.setFromAxisAngle(contact.n, weld);
            ringHolder.position.copy(contact.a).sub(_k.copy(contact.a).applyQuaternion(ringHolder.quaternion)); // 以焊接點為圓心：a − R·a
        } else { ringHolder.quaternion.identity(); ringHolder.position.set(0, 0, 0); }
    }
}

// ── 「看配戴時的傾斜／擺正」切換的過渡動畫（design-studio、design-revision 共用） ──
// 每個要傾斜的對象一個 anim：newTiltAnim(group, holder)；animateTilt(anim, target) 從目前姿勢 0.6 秒轉到 target（null = 直立），不擺盪
export const TILT_ANIM_MS = 600;
export function newTiltAnim(group, holder) {
    return { group, holder, from: new THREE.Quaternion(), to: new THREE.Quaternion(), contact: null, start: 0, fromW: 0, toW: 0, w: 0 };
}
const _running = new Set();
let _raf = 0;
const _animQ = new THREE.Quaternion();
function _step(now) {
    for (const a of _running) {
        const t = Math.min(1, (now - a.start) / TILT_ANIM_MS);
        const e = 1 - Math.pow(1 - t, 3); // ease-out
        _animQ.slerpQuaternions(a.from, a.to, e);
        a.w = a.fromW + (a.toW - a.fromW) * e;                // 斜焊角度跟著同步轉：理想情況下圓環在畫面上一直是直的
        setPendantPose(a.group, a.holder, _animQ, a.contact, a.w);
        if (t >= 1) _running.delete(a);
    }
    _raf = _running.size ? requestAnimationFrame(_step) : 0;
}
export function animateTilt(a, target, instant = false) {
    if (!a.group) return;
    a.from.copy(a.group.quaternion); a.fromW = a.w;
    if (target) { a.to.copy(target.q); a.contact = target.contact; a.toW = target.contact.weld; } else { a.to.identity(); a.toW = 0; } // 回直立時沿用上一次的圓環資訊，過程中照樣貼著墜頭滾
    if (instant || (a.from.angleTo(a.to) < 1e-4 && Math.abs(a.toW - a.fromW) < 1e-4)) { _running.delete(a); a.w = a.toW; setPendantPose(a.group, a.holder, a.to, a.contact, a.w); return; }
    a.start = performance.now();
    _running.add(a);
    if (!_raf) _raf = requestAnimationFrame(_step);
}
// 不再需要的對象（例如版位被取代）停止動畫
export function stopTiltAnim(a) { if (a) _running.delete(a); }
