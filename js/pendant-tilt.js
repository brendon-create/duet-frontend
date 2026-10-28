// 佩戴傾斜：作品掛起來時，靜止狀態重心一定在懸掛點正下方。
// 懸掛點跟重心有水平偏移時，作品會轉到重心垂下來為止——這就是實際戴起來會歪的角度。
// 只做顯示，mesh 自己的座標完全不動（存檔、後端座標、分享圖讀的都是 mesh 座標）。
import * as THREE from 'three';

const RING_INNER_R = 1.0;                   // 圓環內半徑（同 ring-bail.js）

const _up = new THREE.Vector3(0, 0, 1), _down = new THREE.Vector3(0, 0, -1);
const _u = new THREE.Vector3(), _v = new THREE.Vector3(), _p = new THREE.Vector3(), _k = new THREE.Vector3();
const _qInv = new THREE.Quaternion();

// 圓環跟作品焊成一體（後端 STL 就是照擺正時的相對位置焊的），擺正時選好的相對關係傾斜時不變；墜頭保持直立不動。
// 圓環在墜頭上「滾動」：不管轉到哪個角度，都是圓環內圈「當下」的最高點貼在墜頭下方內側（2026-10-29 使用者指正：
// 不能固定繞擺正時的接觸點轉，那樣轉了之後那一點已經不是最高點，圓環會像釘在墜頭上一樣斜翻過去）。
// 墜頭下方內側的位置 K = 擺正時圓環內圈頂端 = 圓環中心 + (0,0,內半徑)，在畫面上固定。
// 套在封閉筆畫裡（沒焊）也照同一套規則（使用者選）。

// 圓環資訊：c = 圓環中心、n = 圓環平面法向量（物件座標；旋轉 0° 時平面是 XZ、法向量 +Y）
export function ringContact(ringPos, ringRotZ = 0) {
    return { c: new THREE.Vector3(ringPos.x, ringPos.y, ringPos.z), n: new THREE.Vector3(-Math.sin(ringRotZ), Math.cos(ringRotZ), 0) };
}

// 物件座標中「往上」的方向是 u 時，圓環內圈的最高點
function topInnerPoint(contact, u, out) {
    _v.copy(u).addScaledVector(contact.n, -u.dot(contact.n));          // u 投影到圓環平面
    if (_v.lengthSq() < 1e-10) _v.copy(_up).addScaledVector(contact.n, -_up.dot(contact.n)); // 圓環平躺：退回擺正時的頂端
    return out.copy(contact.c).addScaledVector(_v.normalize(), RING_INNER_R);
}

// 只算目標姿勢不套用：回傳 { q, contact }（q = 旋轉），沒有圓環或重心回傳 null（= 直立）
// 接觸點會隨角度改變、角度又由接觸點決定：反覆計算到兩者一致（圓環半徑遠小於重心距離，幾次就收斂）
export function computePendantTilt(ringPos, centroid, ringRotZ = 0) {
    if (!ringPos || !centroid) return null;
    const contact = ringContact(ringPos, ringRotZ);
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
// 過渡動畫中每一幀都用當下的 q 重算接觸點，所以轉的過程中圓環也一直貼著墜頭滾動。
export function setPendantPose(group, ringHolder, q, contact) {
    if (!group) return;
    group.quaternion.copy(q);
    if (contact) {
        _u.copy(_up).applyQuaternion(_qInv.copy(q).invert());              // 物件座標的「上」
        topInnerPoint(contact, _u, _p);
        _k.copy(contact.c).addScaledVector(_up, RING_INNER_R);             // 墜頭下方內側（擺正時的內圈頂端）
        group.position.copy(_k).sub(_p.applyQuaternion(q));                // pos = K − q·p
    } else group.position.set(0, 0, 0);
    if (ringHolder) { ringHolder.quaternion.identity(); ringHolder.position.set(0, 0, 0); } // 圓環跟著作品一起轉
}
