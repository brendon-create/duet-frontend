// 佩戴傾斜：作品掛起來時，靜止狀態重心一定在懸掛點正下方。
// 懸掛點跟重心有水平偏移時，作品會轉到重心垂下來為止——這就是實際戴起來會歪的角度。
// 只做顯示，mesh 自己的座標完全不動（存檔、後端座標、分享圖讀的都是 mesh 座標）。
import * as THREE from 'three';

export const TILT_MAX_DEG = 60;             // 顯示上限：懸掛點比重心還低等極端情況，真實物理會整個翻過來，畫面不翻

const RING_OUTER_R = 1.6;                   // 圓環外半徑（內半徑 1.0 + 管徑 0.3×2，同 ring-bail.js）

const _f = new THREE.Vector3(), _v = new THREE.Vector3(), _down = new THREE.Vector3(0, 0, -1), _tmp = new THREE.Vector3();
const _q = new THREE.Quaternion(), _qInv = new THREE.Quaternion(), _qId = new THREE.Quaternion();

// 圓環是焊在作品上的，師傅會把它焊成「掛起來時圓環垂直於地面」的角度。所以畫面上：
//   墜頭、圓環都保持直立不動；焊點 F = 圓環最低點（物件空間 ringPos − R_OUTER）在畫面上固定；
//   作品繞著 F 轉到重心落在 F 正下方（圓環垂直時掛點就在 F 正上方，重心在 F 正下方 = 在掛點正下方）。
// 做法：group（主體）套 q、以 F 為軸；ringHolder（圓環，是 group 的子物件）套 q⁻¹ 同樣以 F 為軸，
//   兩者相乘圓環在世界座標回到直立、焊點仍貼著作品。mesh 自己的座標一律不動。
// 回傳傾斜角度（度）。沒有圓環或重心就回到不傾斜。
export function applyPendantTilt(group, ringHolder, ringPos, centroid) {
    if (!group) return 0;
    const reset = () => {
        group.quaternion.identity(); group.position.set(0, 0, 0);
        if (ringHolder) { ringHolder.quaternion.identity(); ringHolder.position.set(0, 0, 0); }
    };
    if (!ringPos || !centroid) { reset(); return 0; }
    _f.set(ringPos.x, ringPos.y, ringPos.z - RING_OUTER_R);
    _v.set(centroid.x, centroid.y, centroid.z).sub(_f);
    const len = _v.length();
    if (len < 1e-6) { reset(); return 0; }
    _v.divideScalar(len);
    _q.setFromUnitVectors(_v, _down);
    let angle = 2 * Math.acos(Math.min(1, Math.abs(_q.w)));
    const maxRad = THREE.MathUtils.degToRad(TILT_MAX_DEG);
    if (angle > maxRad) { _q.slerpQuaternions(_qId, _q, maxRad / angle); angle = maxRad; }
    group.quaternion.copy(_q);
    group.position.copy(_f).sub(_tmp.copy(_f).applyQuaternion(_q));          // 以 F 為軸：pos = F − q·F
    if (ringHolder) {
        _qInv.copy(_q).invert();
        ringHolder.quaternion.copy(_qInv);
        ringHolder.position.copy(_f).sub(_tmp.copy(_f).applyQuaternion(_qInv)); // 圓環反轉回直立，同樣以 F 為軸
    }
    return THREE.MathUtils.radToDeg(angle);
}
