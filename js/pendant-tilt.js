// 佩戴傾斜：作品掛在圓環上時，靜止狀態重心一定在懸掛點正下方。
// 懸掛點跟重心有水平偏移時，整件會轉到重心垂下來為止——這就是實際戴起來會歪的角度。
//
// 只做顯示：主體、圓環、墜頭都掛在一個 Group 底下，傾斜只加在 Group 上，三個 mesh 自己的
// 座標完全不動（存檔、後端座標、分享圖讀的都是 mesh 座標）。旋轉以懸掛點為軸心，所以懸掛點
// 在畫面上不會動，作品繞著它擺正。
import * as THREE from 'three';

export const TILT_MAX_DEG = 60;             // 顯示上限：懸掛點比重心還低等極端情況，真實物理會整個翻過來，畫面不翻

const RING_INNER_R = 1.0;                   // 圓環內半徑（ring-bail.js 的 innerRadius）

const _anchor = new THREE.Vector3(), _contact = new THREE.Vector3(), _v = new THREE.Vector3(), _down = new THREE.Vector3(0, 0, -1);
const _q = new THREE.Quaternion(), _qInv = new THREE.Quaternion(), _qId = new THREE.Quaternion();
const _u = new THREE.Vector3(), _w = new THREE.Vector3(0, 0, 1), _upObj = new THREE.Vector3(), _dir = new THREE.Vector3();

// 把 group 轉成「懸掛點在重心正上方」的姿態。
//   ringPos：圓環中心（物件空間）；ringRotZ：圓環繞 z 的旋轉（弧度，圓環平面方向）；centroid：主體重心（物件空間）。
// 墜頭掛在鏈子上永遠直立、不進 group；它的下緣停在固定的錨點 A = 圓環中心正上方 RING_INNER_R。
// 作品歪的時候，圓環跟墜頭的接觸點是「轉完之後圓環內圈的最高點」，會沿著圓環滑，所以：
//   1. 用目前的接觸點算平衡旋轉 q（接觸點→重心 轉成垂直向下）
//   2. 用 q 找圓環轉完後的最高點當新的接觸點，回到 1 再算一次（兩三次就收斂）
//   3. 平移整組，讓接觸點落在錨點 A
// 沒有圓環或重心就回到不傾斜。回傳傾斜角度（度）。
export function applyPendantTilt(group, ringPos, ringRotZ, centroid) {
    if (!group) return 0;
    if (!ringPos || !centroid) {
        group.quaternion.identity(); group.position.set(0, 0, 0);
        return 0;
    }
    _anchor.set(ringPos.x, ringPos.y, ringPos.z + RING_INNER_R);
    _u.set(Math.cos(ringRotZ || 0), Math.sin(ringRotZ || 0), 0); // 圓環平面的水平軸
    _contact.copy(_anchor);
    let angle = 0;
    for (let it = 0; it < 4; it++) {
        _v.set(centroid.x, centroid.y, centroid.z).sub(_contact);
        const len = _v.length();
        if (len < 1e-6) { group.quaternion.identity(); group.position.set(0, 0, 0); return 0; }
        _v.divideScalar(len);
        _q.setFromUnitVectors(_v, _down);
        angle = 2 * Math.acos(Math.min(1, Math.abs(_q.w)));
        const maxRad = THREE.MathUtils.degToRad(TILT_MAX_DEG);
        if (angle > maxRad) { _q.slerpQuaternions(_qId, _q, maxRad / angle); angle = maxRad; }
        // 轉完後圓環內圈的最高點：世界「上」換回物件空間，投影到圓環平面（u, w 張成）取方向
        _qInv.copy(_q).invert();
        _upObj.set(0, 0, 1).applyQuaternion(_qInv);
        _dir.copy(_u).multiplyScalar(_upObj.dot(_u)).addScaledVector(_w, _upObj.dot(_w));
        if (_dir.lengthSq() < 1e-12) _dir.copy(_w); else _dir.normalize();
        _contact.set(ringPos.x, ringPos.y, ringPos.z).addScaledVector(_dir, RING_INNER_R);
    }
    group.quaternion.copy(_q);
    // 接觸點轉完要落在錨點：position = A − q·contact
    group.position.copy(_anchor).sub(_contact.applyQuaternion(_q));
    return THREE.MathUtils.radToDeg(angle);
}
