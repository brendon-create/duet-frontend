// 佩戴傾斜：作品掛在圓環上時，靜止狀態重心一定在懸掛點正下方。
// 懸掛點跟重心有水平偏移時，整件會轉到重心垂下來為止——這就是實際戴起來會歪的角度。
//
// 只做顯示：主體、圓環、墜頭都掛在一個 Group 底下，傾斜只加在 Group 上，三個 mesh 自己的
// 座標完全不動（存檔、後端座標、分享圖讀的都是 mesh 座標）。旋轉以懸掛點為軸心，所以懸掛點
// 在畫面上不會動，作品繞著它擺正。
import * as THREE from 'three';

export const PIVOT_ABOVE_RING_CENTER = 1.0; // 懸掛點 = 圓環內圈最高點（內半徑 1.0mm），墜頭勾住圓環的地方
export const TILT_MAX_DEG = 60;             // 顯示上限：懸掛點比重心還低等極端情況，真實物理會整個翻過來，畫面不翻

const _p = new THREE.Vector3(), _v = new THREE.Vector3(), _down = new THREE.Vector3(0, 0, -1);
const _q = new THREE.Quaternion(), _qId = new THREE.Quaternion();

// 把 group 轉成「懸掛點在重心正上方」的姿態。ringPos：圓環中心（物件空間）；centroid：主體重心（物件空間）。
// 沒有圓環或重心就回到不傾斜。
export function applyPendantTilt(group, ringPos, centroid) {
    if (!group) return 0;
    if (!ringPos || !centroid) {
        group.quaternion.identity(); group.position.set(0, 0, 0);
        return 0;
    }
    _p.set(ringPos.x, ringPos.y, ringPos.z + PIVOT_ABOVE_RING_CENTER);
    _v.set(centroid.x, centroid.y, centroid.z).sub(_p);
    const len = _v.length();
    if (len < 1e-6) {
        group.quaternion.identity(); group.position.set(0, 0, 0);
        return 0;
    }
    _v.divideScalar(len);
    _q.setFromUnitVectors(_v, _down);          // 把「懸掛點→重心」轉成垂直向下
    let angle = 2 * Math.acos(Math.min(1, Math.abs(_q.w)));
    const maxRad = THREE.MathUtils.degToRad(TILT_MAX_DEG);
    if (angle > maxRad) {
        _q.slerpQuaternions(_qId, _q, maxRad / angle);
        angle = maxRad;
    }
    group.quaternion.copy(_q);
    // 繞懸掛點旋轉：group 的位移 = p − q·p，讓 p 轉完還在原處
    group.position.copy(_p).sub(_p.clone().applyQuaternion(_q));
    return THREE.MathUtils.radToDeg(angle);
}
