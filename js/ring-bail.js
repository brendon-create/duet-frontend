/**
 * ring-bail.js - Ring & Bail 系統
 *
 * 導出 bailRelativeOffset, bailInitialized, ringMesh, bailMesh
 * 導出 createRing(), createBail(), updateRingPosition()
 */

import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

// Ring & Bail 狀態（使用 window.xxx 暴露供外部存取）
export let ringMesh = null;
export let bailMesh = null;
export let bailRelativeOffset = new THREE.Vector3();
export let bailInitialized = false;

function getMaterial(materialType, finish, plating) {
    const mat = window.MATERIALS[materialType];
    const roughness = mat.roughness[finish];
    const finalColor = window.PLATING_COLORS[plating] !== null
        ? window.PLATING_COLORS[plating]
        : mat.color;
    const materialConfig = {
        color: finalColor,
        metalness: mat.metalness,
        roughness: roughness,
        envMapIntensity: finish === 'glossy' ? 2.0 : 1.0
    };
    if (window.envMap) {
        materialConfig.envMap = window.envMap;
    }
    return new THREE.MeshStandardMaterial(materialConfig);
}

export function createRing() {
    // 先移除舊的 ringMesh
    if (ringMesh) {
        window.scene.remove(ringMesh);
        ringMesh.geometry?.dispose();
        ringMesh.material?.dispose();
        ringMesh = null;
        // 暴露給佩戴模擬（用於截取墜飾）
        window.ringMesh = null;
    }

    if (!window.mainMesh) return;

    const innerRadius = 1;     // 內半徑 1mm，內徑 2mm
    const tubeRadius = 0.3;     // 管半徑 0.3mm，直徑 0.6mm
    const ringRadius = innerRadius + tubeRadius;  // 外半徑 1.3mm
    const geometry = new THREE.TorusGeometry(ringRadius, tubeRadius, 16, 32);

    // 將 Torus 從 XY 平面轉到 XZ 平面 (站立)
    geometry.rotateX(Math.PI / 2);
    // 移除原本的 Z 軸 90 度旋轉，讓 ring 與 Letter 1 平行（垂直於 Letter 2）
    // geometry.rotateZ(Math.PI / 2);  // 註解掉：原本讓 ring 平行於 Letter 2

    const material = getMaterial(
        document.getElementById('material').value,
        document.getElementById('finish').value,
        document.getElementById('plating').value
    );
    ringMesh = new THREE.Mesh(geometry, material);
    window.scene.add(ringMesh);
    // 暴露給佩戴模擬（用於截取墜飾）
    window.ringMesh = ringMesh;

    updateRingPosition();
}

// ==========================================
// 🔧 建立 Bail（墜飾上方的環扣）
// ==========================================
export function createBail() {
    // 🔧 如果 bail 已存在且已初始化，只更新位置（不重新建立）
    if (bailMesh && bailInitialized && ringMesh) {
        // Bail 已初始化過，只更新位置（保持相對偏移）
        bailMesh.position.set(
            ringMesh.position.x + bailRelativeOffset.x,
            ringMesh.position.y + bailRelativeOffset.y,
            ringMesh.position.z + bailRelativeOffset.z
        );
        bailMesh.rotation.z = ringMesh.rotation.z;
        console.log(`🔗 Bail 位置已更新（保持偏移）: (${bailMesh.position.x.toFixed(2)}, ${bailMesh.position.y.toFixed(2)}, ${bailMesh.position.z.toFixed(2)})`);
        return;
    }

    // 先移除舊的 bailMesh（只有在第一次或需要重建時）
    if (bailMesh) {
        window.scene.remove(bailMesh);
        bailMesh.geometry?.dispose();
        bailMesh.material?.dispose();
        bailMesh = null;
        window.bailMesh = null;
    }

    if (!window.mainMesh) return;

    const bailUrl = `https://raw.githubusercontent.com/brendon-create/duet-frontend/develop/assets/models/bail.stl`;
    console.log('🔽 載入 Bail STL:', bailUrl);

    const loader = new STLLoader();
    loader.load(
        bailUrl,
        (geometry) => {
            console.log('✅ Bail STL 載入成功');

            // 計算 geometry 的中心
            geometry.computeBoundingBox();
            const bbox = geometry.boundingBox;
            const center = bbox.getCenter(new THREE.Vector3());

            // 移動到原點（以幾何中心為準）
            geometry.translate(-center.x, -center.y, -center.z);

            // 確保法向量正確（STL 載入後必須重新計算）
            geometry.computeVertexNormals();

            // 分析 bail 的方向：比較 X 和 Y 方向的範圍
            const sizeX = bbox.max.x - bbox.min.x;
            const sizeY = bbox.max.y - bbox.min.y;
            const sizeZ = bbox.max.z - bbox.min.z;

            console.log(`📐 Bail 尺寸: X=${sizeX.toFixed(2)}, Y=${sizeY.toFixed(2)}, Z=${sizeZ.toFixed(2)}`);

            // 套用材質
            const material = getMaterial(
                document.getElementById('material').value,
                document.getElementById('finish').value,
                document.getElementById('plating').value
            );

            bailMesh = new THREE.Mesh(geometry, material);

            // 🔧 Bail 縮放調整：根據 targetBailWidth 等比例縮放
            const targetBailWidth = 4; // 目標寬度 4mm
            const scaleFactor = targetBailWidth / Math.max(sizeX, sizeY);
            geometry.scale(scaleFactor, scaleFactor, scaleFactor);

            console.log(`🔧 Bail 縮放: scaleFactor=${scaleFactor.toFixed(3)}（等比例，寬度=${targetBailWidth}mm）`);

            // 重新計算縮放後的 BBox
            geometry.computeBoundingBox();
            const scaledBbox = geometry.boundingBox;
            const scaledSizeX = scaledBbox.max.x - scaledBbox.min.x;
            const scaledSizeY = scaledBbox.max.y - scaledBbox.min.y;
            const scaledSizeZ = scaledBbox.max.z - scaledBbox.min.z;
            console.log(`📐 Bail 縮放後尺寸: X=${scaledSizeX.toFixed(2)}, Y=${scaledSizeY.toFixed(2)}, Z=${scaledSizeZ.toFixed(2)}`);

            // 定位：Bail 中心點在 modelTopZ + 1.2 + bail高度的一半
            // X、Y 跟 Ring 一樣，Z 在 Ring 上方

            if (ringMesh) {
                const bailCenterZ = window.modelTopZ + 1.2 + scaledSizeZ / 2;
                bailMesh.position.set(
                    ringMesh.position.x,
                    ringMesh.position.y,
                    bailCenterZ
                );

                // 🔧 儲存 Bail 與 Ring 的相對位移偏移量（用於聯動）
                bailRelativeOffset.set(
                    bailMesh.position.x - ringMesh.position.x,
                    bailMesh.position.y - ringMesh.position.y,
                    bailMesh.position.z - ringMesh.position.z
                );
                console.log(`🔗 Bail-Ring 相對偏移已儲存: (${bailRelativeOffset.x.toFixed(2)}, ${bailRelativeOffset.y.toFixed(2)}, ${bailRelativeOffset.z.toFixed(2)})`);

                // 🔄 旋轉讓 bail 垂直於 ring
                // 測試後發现代码已经是垂直的，如果需要调整可以修改这里
                // bailMesh.rotation.x = Math.PI / 2; // X 軸旋轉 90 度

                console.log(`🔍 Ring 位置: (${ringMesh.position.x.toFixed(2)}, ${ringMesh.position.y.toFixed(2)}, ${ringMesh.position.z.toFixed(2)})`);
                console.log(`🔍 Bail 位置（中心在ring上方 ${1.2 + scaledSizeZ/2}mm）: (${bailMesh.position.x.toFixed(2)}, ${bailMesh.position.y.toFixed(2)}, ${bailMesh.position.z.toFixed(2)})`);
            } else {
                bailMesh.position.set(window.modelCenter.x, window.modelCenter.y + 5, window.modelCenter.z);
            }

            // 🔍 Debug: 檢查 bail 狀態
            console.log(`🔍 Bail 可見性: ${bailMesh.visible}, position: (${bailMesh.position.x.toFixed(2)}, ${bailMesh.position.y.toFixed(2)}, ${bailMesh.position.z.toFixed(2)})`);

            // 🔧 標記 Bail 已初始化（之後不再重新建立，只更新位置）
            bailInitialized = true;
            console.log('✅ Bail 已初始化，之後將保持相對偏移');

            window.scene.add(bailMesh);
            window.bailMesh = bailMesh;

            console.log('✅ Bail 已添加到場景');

            // 更新佩戴模擬
            if (typeof window.updateWearingPreview === 'function') {
                window.updateWearingPreview();
            }
        },
        (progress) => {
            console.log(`⏳ Bail 載入進度: ${(progress.loaded / progress.total * 100).toFixed(0)}%`);
        },
        (error) => {
            console.error('❌ Bail STL 載入失敗:', error);
            console.log('⚠️ 繼續使用，不使用 Bail');
        }
    );
}

export function updateRingPosition() {
    if (!ringMesh) return;
    const x = parseFloat(document.getElementById('ringX').value);
    // ringY 對應 UI 的 Position Y (Depth)
    const y_depth_adj = parseFloat(document.getElementById('ringY').value);
    // ringZ 對應 UI 的 Position Z (Height)
    const z_height_adj = parseFloat(document.getElementById('ringZ').value);
    const rotation = parseFloat(document.getElementById('ringRotation').value);

    const baseZ = window.modelTopZ + 1.2; // 在 Z (高度) 軸上定位

    // 調整：X 不變, Y 軸為 modelCenter.y + 深度調整, Z 軸為 baseZ + 高度調整
    ringMesh.position.set(window.modelCenter.x + x, window.modelCenter.y + y_depth_adj, baseZ + z_height_adj);

    // 旋轉以 Z 軸為軸心
    ringMesh.rotation.z = (rotation * Math.PI) / 180;

    // 🔗 Bail 聯動：跟隨 Ring 移動（保持相對偏移）
    if (bailMesh && bailRelativeOffset) {
        bailMesh.position.set(
            ringMesh.position.x + bailRelativeOffset.x,
            ringMesh.position.y + bailRelativeOffset.y,
            ringMesh.position.z + bailRelativeOffset.z
        );
        // Bail 跟隨 Ring 旋轉
        bailMesh.rotation.z = ringMesh.rotation.z;
        console.log(`🔗 Bail 已聯動至新位置: (${bailMesh.position.x.toFixed(2)}, ${bailMesh.position.y.toFixed(2)}, ${bailMesh.position.z.toFixed(2)})`);
    }

    // 🔍 Debug: 圓環位置
    console.log('🔍 圓環絕對位置:', {
        x: ringMesh.position.x.toFixed(3),
        y: ringMesh.position.y.toFixed(3),
        z: ringMesh.position.z.toFixed(3),
        rotation: rotation + '°'
    });
    console.log('🔍 模型中心:', {
        x: window.modelCenter.x.toFixed(3),
        y: window.modelCenter.y.toFixed(3),
        z: window.modelCenter.z.toFixed(3)
    });
    console.log('🔍 模型頂部 Z:', window.modelTopZ.toFixed(3));
    console.log('═══════════════════════════════════════');
}