/**
 * 3d-scene.js - 3D 場景初始化
 *
 * 導出 scene, camera, renderer, controls, envMap
 * 導出 initScene(), animate(), onResize()
 * 導出 showInitialSphere(), removeAllPlaceholderSpheres()
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

// Slot 預覽變數（使用 window.xxx 暴露，供 saveToSlot() 寫入，animate() 讀取）
export let slot1Scene = null, slot2Scene = null;
export let slot1Renderer = null, slot2Renderer = null;
export let slot1Camera = null, slot2Camera = null;

let scene, camera, renderer, controls, envMap;

export function getScene() { return scene; }
export function getCamera() { return camera; }
export function getRenderer() { return renderer; }
export function getControls() { return controls; }

export function initScene() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.up.set(0, 0, 1); // Z-up 系統
    camera.position.set(40, -57, 12);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.getElementById('viewport').appendChild(renderer.domElement);

    // 暴露給全域
    window.scene = scene;
    window.camera = camera;
    window.renderer = renderer;

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0, 0);
    controls.zoomSpeed = 0.8;
    controls.minDistance = 5;
    controls.maxDistance = 500;
    window.controls = controls;

    // Safari macOS 會在 trackpad pinch 時同時觸發 gesturechange 和 wheel，
    // 導致頁面縮放和 3D 縮放疊加暴衝，攔截 gesture 事件避免頁面層級縮放
    const canvasEl = renderer.domElement;
    const blockGesture = (e) => e.preventDefault();
    canvasEl.addEventListener('gesturestart',  blockGesture, { passive: false });
    canvasEl.addEventListener('gesturechange', blockGesture, { passive: false });
    canvasEl.addEventListener('gestureend',    blockGesture, { passive: false });

    // 光照
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 3.0);
    directionalLight.position.set(5, 5, 10);
    scene.add(directionalLight);

    // HDR 載入備援機制
    const hdrUrls = [
        'https://raw.githubusercontent.com/brendon-create/duet-frontend/develop/assets/images/hdr/studio_kontrast_04_4kc.hdr',
        'https://cdn.jsdelivr.net/gh/brendon-create/duet-frontend@develop/assets/images/hdr/studio_kontrast_04_4kc.hdr'
    ];

    let currentHdrIndex = 0;
    let hdrLoadTimeout = null;
    const rgbeLoader = new RGBELoader();

    function loadHDRWithFallback() {
        if (currentHdrIndex >= hdrUrls.length) {
            console.error('❌ 所有 HDR 來源都失敗，使用無 HDR 模式');
            envMap = null;
            window.envMap = null;
            showInitialSphere();
            return;
        }

        const hdrUrl = hdrUrls[currentHdrIndex];
        const sourceName = currentHdrIndex === 0 ? 'GitHub Raw' : 'jsdelivr CDN';
        console.log(`🔄 嘗試載入 HDR (${sourceName}):`, hdrUrl);

        hdrLoadTimeout = setTimeout(() => {
            console.warn(`⏱️ HDR 載入超時 (${sourceName})，切換備援...`);
            currentHdrIndex++;
            loadHDRWithFallback();
        }, 5000);

        rgbeLoader.load(
            hdrUrl,
            (texture) => {
                clearTimeout(hdrLoadTimeout);
                texture.mapping = THREE.EquirectangularReflectionMapping;
                envMap = texture;
                scene.environment = envMap;
                window.envMap = envMap;  // 暴露給其他模組
                console.log(`✅ HDR 載入成功 (${sourceName})`);
                showInitialSphere();
            },
            undefined,
            (error) => {
                clearTimeout(hdrLoadTimeout);
                console.error(`❌ HDR 載入失敗 (${sourceName}):`, error);
                currentHdrIndex++;
                loadHDRWithFallback();
            }
        );
    }

    loadHDRWithFallback();

    window.addEventListener('resize', onResize);

    // 初始化產品攝影模組
    if (window.ProductPhotoStudio && typeof window.ProductPhotoStudio.init === 'function') {
        window.ProductPhotoStudio.init(scene, camera, renderer, controls);
    }
}


export function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

export function animate() {
    requestAnimationFrame(animate);
    controls.update();

    // 同步 Slot 預覽 - 讀取 window.slot1Camera 等（由 saveToSlot 在 design-studio.html 中寫入）
    if (window.slot1Camera && window.slot1Renderer && window.slot1Scene) {
        window.slot1Camera.position.copy(camera.position).multiplyScalar(0.5);
        window.slot1Camera.lookAt(0, 0, 0);
        window.slot1Renderer.render(window.slot1Scene, window.slot1Camera);
    }
    if (window.slot2Camera && window.slot2Renderer && window.slot2Scene) {
        window.slot2Camera.position.copy(camera.position).multiplyScalar(0.5);
        window.slot2Camera.lookAt(0, 0, 0);
        window.slot2Renderer.render(window.slot2Scene, window.slot2Camera);
    }

    renderer.render(scene, camera);
}

export function removeAllPlaceholderSpheres() {
    const sphereName = 'placeholderSphere';
    let removedCount = 0;

    // 遍歷 scene 中所有物件
    for (let i = scene.children.length - 1; i >= 0; i--) {
        const child = scene.children[i];
        if (child.name === sphereName) {
            scene.remove(child);
            child.geometry?.dispose();
            child.material?.dispose();
            removedCount++;
            console.log(`🧹 已清理殘留球體: ${child.uuid}`);
        }
    }

    if (removedCount > 0) {
        console.log(`🧹 共清理 ${removedCount} 個殘留球體`);
    }
    return removedCount;
}

export function showInitialSphere() {
    // 清理任何已存在的球體（防禦性清理）
    removeAllPlaceholderSpheres();

    const geometry = new THREE.SphereGeometry(5, 64, 64);
    const material = new THREE.MeshStandardMaterial({ color: 0xC0C0C0, metalness: 1.0, roughness: 0.0 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'placeholderSphere';
    scene.add(mesh);
    window.mainMesh = mesh;
    console.log('✅ showInitialSphere: 顯示初始球體');
    document.getElementById('loader').classList.add('fade-out');
}
