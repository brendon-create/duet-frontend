// 佩戴傾斜：作品掛起來時，靜止狀態重心一定在懸掛點正下方。
// 懸掛點跟重心有水平偏移時，作品會轉到重心垂下來為止——這就是實際戴起來會歪的角度。
// 只做顯示，mesh 自己的座標完全不動（存檔、後端座標、分享圖讀的都是 mesh 座標）。
import * as THREE from 'three';

const RING_INNER_R = 1.0;                   // 圓環內半徑（同 ring-bail.js）：墜頭勾在圓環內圈頂端

const _f = new THREE.Vector3(), _v = new THREE.Vector3(), _down = new THREE.Vector3(0, 0, -1), _tmp = new THREE.Vector3();
const _q = new THREE.Quaternion();

// 圓環跟作品焊成一體（後端 STL 就是照擺正時的相對位置焊的），擺正時選好的相對關係傾斜時不變（2026-10-29 使用者決定）。
// 支點 F = 墜頭勾住圓環的地方 = 圓環內圈頂端（ringPos + 內半徑）；墜頭保持直立不動，
// 作品連同圓環繞 F 轉到重心落在 F 正下方。圓環套在封閉筆畫裡（沒焊）也照同一套規則處理（使用者選，規則一致、畫面不跳）。
// 做法：group（主體 + ringHolder 裡的圓環）套 q、以 F 為軸；ringHolder 保持單位（不反轉）。mesh 自己的座標一律不動。
// 只算目標姿勢不套用：回傳 { q, f }（q = 旋轉、f = 支點），沒有圓環或重心回傳 null（= 直立）
export function computePendantTilt(ringPos, centroid) {
    if (!ringPos || !centroid) return null;
    const f = new THREE.Vector3(ringPos.x, ringPos.y, ringPos.z + RING_INNER_R);
    _v.set(centroid.x, centroid.y, centroid.z).sub(f);
    const len = _v.length();
    if (len < 1e-6) return null;
    _v.divideScalar(len);
    // 不設角度上限：支點比重心低時真實戴起來就是倒掛，畫面照實顯示（2026-10-28 使用者決定）
    return { q: new THREE.Quaternion().setFromUnitVectors(_v, _down), f };
}

// 把主體（含圓環）套上旋轉 q，以 f 為軸。q 為單位四元數時 f 不影響結果。
export function setPendantPose(group, ringHolder, q, f) {
    if (!group) return;
    group.quaternion.copy(q);
    group.position.copy(f).sub(_tmp.copy(f).applyQuaternion(q));          // 以 F 為軸：pos = F − q·F
    if (ringHolder) { ringHolder.quaternion.identity(); ringHolder.position.set(0, 0, 0); } // 圓環跟著作品一起轉
}

// 立即套用（沒有過渡）。回傳傾斜角度（度）；沒有圓環或重心就回到不傾斜。
export function applyPendantTilt(group, ringHolder, ringPos, centroid) {
    if (!group) return 0;
    const t = computePendantTilt(ringPos, centroid);
    if (!t) { setPendantPose(group, ringHolder, _q.identity(), _f.set(0, 0, 0)); return 0; }
    setPendantPose(group, ringHolder, t.q, t.f);
    return THREE.MathUtils.radToDeg(2 * Math.acos(Math.min(1, Math.abs(t.q.w))));
}
