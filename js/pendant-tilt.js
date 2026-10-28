// 佩戴傾斜：作品掛起來時，靜止狀態重心一定在懸掛點正下方。
// 懸掛點跟重心有水平偏移時，作品會轉到重心垂下來為止——這就是實際戴起來會歪的角度。
// 只做顯示，mesh 自己的座標完全不動（存檔、後端座標、分享圖讀的都是 mesh 座標）。
import * as THREE from 'three';

const RING_OUTER_R = 1.6;                   // 圓環外半徑（內半徑 1.0 + 管徑 0.3×2，同 ring-bail.js）

const _f = new THREE.Vector3(), _v = new THREE.Vector3(), _down = new THREE.Vector3(0, 0, -1), _tmp = new THREE.Vector3();
const _q = new THREE.Quaternion(), _qInv = new THREE.Quaternion();

// 圓環是焊在作品上的，師傅會把它焊成「掛起來時圓環垂直於地面」的角度。所以畫面上：
//   墜頭、圓環都保持直立不動；焊點 F = 圓環最低點（物件空間 ringPos − R_OUTER）在畫面上固定；
//   作品繞著 F 轉到重心落在 F 正下方（圓環垂直時掛點就在 F 正上方，重心在 F 正下方 = 在掛點正下方）。
// 做法：group（主體）套 q、以 F 為軸；ringHolder（圓環，是 group 的子物件）套 q⁻¹ 同樣以 F 為軸，
//   兩者相乘圓環在世界座標回到直立、焊點仍貼著作品。mesh 自己的座標一律不動。
// pivotBelow：轉軸在圓環中心下方多少。焊接 = R_OUTER（焊點）；套住 = 1.0（內圈最低點，筆畫靠在那裡）
// 只算目標姿勢不套用：回傳 { q, f }（q = 主體旋轉、f = 轉軸），沒有圓環或重心回傳 null（= 直立）
export function computePendantTilt(ringPos, centroid, pivotBelow = RING_OUTER_R) {
    if (!ringPos || !centroid) return null;
    const f = new THREE.Vector3(ringPos.x, ringPos.y, ringPos.z - pivotBelow);
    _v.set(centroid.x, centroid.y, centroid.z).sub(f);
    const len = _v.length();
    if (len < 1e-6) return null;
    _v.divideScalar(len);
    // 不設角度上限：掛點比重心低時真實戴起來就是倒掛，畫面照實顯示（2026-10-28 使用者決定）
    return { q: new THREE.Quaternion().setFromUnitVectors(_v, _down), f };
}

// 把主體套上旋轉 q（以 f 為軸），圓環反轉回直立。q 為單位四元數時 f 不影響結果。
export function setPendantPose(group, ringHolder, q, f) {
    if (!group) return;
    group.quaternion.copy(q);
    group.position.copy(f).sub(_tmp.copy(f).applyQuaternion(q));          // 以 F 為軸：pos = F − q·F
    if (ringHolder) {
        _qInv.copy(q).invert();
        ringHolder.quaternion.copy(_qInv);
        ringHolder.position.copy(f).sub(_tmp.copy(f).applyQuaternion(_qInv)); // 圓環反轉回直立，同樣以 F 為軸
    }
}

// 立即套用（沒有過渡）。回傳傾斜角度（度）；沒有圓環或重心就回到不傾斜。
export function applyPendantTilt(group, ringHolder, ringPos, centroid, pivotBelow = RING_OUTER_R) {
    if (!group) return 0;
    const t = computePendantTilt(ringPos, centroid, pivotBelow);
    if (!t) { setPendantPose(group, ringHolder, _q.identity(), _f.set(0, 0, 0)); return 0; }
    setPendantPose(group, ringHolder, t.q, t.f);
    return THREE.MathUtils.radToDeg(2 * Math.acos(Math.min(1, Math.abs(t.q.w))));
}
