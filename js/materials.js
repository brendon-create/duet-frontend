/**
 * materials.js - 材質系統
 *
 * 導出 MATERIALS, PLATING_COLORS, getMaterial()
 */

import * as THREE from 'three';

// 材質定義
export const MATERIALS = {
    gold18k: { color: 0xFFD700, metalness: 1.0, roughness: { glossy: 0.0, matte: 0.6 }, density: 15.3 },
    whitegold18k: { color: 0xE5E5E5, metalness: 1.0, roughness: { glossy: 0.0, matte: 0.6 }, density: 15.3 },
    rosegold18k: { color: 0xC9A386, metalness: 1.0, roughness: { glossy: 0.0, matte: 0.6 }, density: 15.0 },
    silver925: { color: 0xC0C0C0, metalness: 1.0, roughness: { glossy: 0.0, matte: 0.6 }, density: 10.3 },
    brass: { color: 0xB5A642, metalness: 0.9, roughness: { glossy: 0.0, matte: 0.6 }, density: 8.5 },
    platinum: { color: 0xE5E5E5, metalness: 1.0, roughness: { glossy: 0.0, matte: 0.6 }, density: 21.4 }
};

// 電鍍顏色定義
export const PLATING_COLORS = {
    none: null,  // 無電鍍，使用基礎材質顏色
    gold18k: 0xFFD700,      // 18K 金色
    whitegold18k: 0xE5E5E5, // 18K 白K金色
    rosegold18k: 0xC9A386   // 18K 玫瑰金色（溫暖粉金）
};

/**
 * 建立 THREE.MeshStandardMaterial
 * @param {string} materialType - 材質類型 (gold18k, silver925, etc.)
 * @param {string} finish - 表面處理 (glossy, matte)
 * @param {string} plating - 電鍍類型 (none, gold18k, whitegold18k, rosegold18k)
 * @returns {THREE.MeshStandardMaterial}
 */
export function getMaterial(materialType, finish, plating = 'none') {
    const mat = MATERIALS[materialType];
    const roughness = mat.roughness[finish];

    // 決定最終顏色：如果有電鍍，使用電鍍顏色；否則使用基礎材質顏色
    const finalColor = PLATING_COLORS[plating] !== null
        ? PLATING_COLORS[plating]
        : mat.color;

    const materialConfig = {
        color: finalColor,
        metalness: mat.metalness,
        roughness: roughness,
        envMapIntensity: finish === 'glossy' ? 3.0 : 1.5
    };

    // 從 window.envMap 讀取（由 3d-scene.js 設定）
    if (window.envMap) {
        materialConfig.envMap = window.envMap;
    }

    return new THREE.MeshStandardMaterial(materialConfig);
}
