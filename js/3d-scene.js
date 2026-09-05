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

let _sceneShown = false;
let _sceneReadyResolve;
export const sceneReadyPromise = new Promise(r => { _sceneReadyResolve = r; });

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
    renderer.toneMappingExposure = 1.6;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const viewportEl = document.getElementById('viewport');
    viewportEl.appendChild(renderer.domElement);
    renderer.domElement.style.pointerEvents = 'none'; // 讓事件穿透到 viewport div
    viewportEl.style.touchAction = 'none'; // 防止 Safari 在 custom domain 上攔截 wheel 事件

    // 暴露給全域
    window.scene = scene;
    window.camera = camera;
    window.renderer = renderer;
    // 主相機的初始距離：Slot 預覽縮放同步要用同一個基準，不能各自用「存檔當下」的距離，
    // 否則兩個 slot 在不同縮放程度下存檔，事後同樣物件會顯示成不同大小
    window.initialCameraDist = camera.position.length();

    // 必須在 new OrbitControls() 之前註冊，stopImmediatePropagation 才能攔截它的 wheel handler

    // Safari gesturechange → 捏合縮放（Chrome 不觸發 gesturechange，改走 wheel+ctrlKey）
    let _gestureScale = 1;
    let _inGesture = false;
    viewportEl.addEventListener('gesturestart', (e) => {
        e.preventDefault();
        _gestureScale = 1;
        _inGesture = true;
    }, { passive: false });
    viewportEl.addEventListener('gesturechange', (e) => {
        e.preventDefault();
        const s = e.scale / _gestureScale;
        _gestureScale = e.scale;
        if (s > 1) controls._dollyIn(1 / s);   // 擴大 → 拉近
        else       controls._dollyOut(s);       // 捏合 → 推遠
        controls.update();
    }, { passive: false });
    viewportEl.addEventListener('gestureend', (e) => {
        e.preventDefault();
        _inGesture = false;
    }, { passive: false });

    viewportEl.addEventListener('wheel', (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        const height = viewportEl.clientHeight;
        if (e.ctrlKey && !_inGesture) {
            // Chrome on Mac：捏合 → wheel + ctrlKey（Safari 已由 gesturechange 處理）
            const s = Math.pow(0.95, controls.zoomSpeed * Math.abs(e.deltaY) / (100 * (window.devicePixelRatio || 1)));
            e.deltaY > 0 ? controls._dollyOut(s) : controls._dollyIn(s);
        } else if (!e.ctrlKey && Math.abs(e.deltaX) > 2) {
            // 觸控板兩指斜向/橫向滑動（deltaX 明顯）→ 旋轉
            controls._rotateLeft(-2 * Math.PI * e.deltaX / height * controls.rotateSpeed);
            controls._rotateUp(-2 * Math.PI * e.deltaY / height * controls.rotateSpeed);
        } else {
            // 滑鼠滾輪（僅 deltaY）或觸控板純直向滑動 → 縮放
            const delta = e.deltaMode !== 0 ? e.deltaY * 10 : e.deltaY;
            const s = Math.pow(0.95, controls.zoomSpeed * Math.abs(delta) / 100);
            e.deltaY > 0 ? controls._dollyOut(s) : controls._dollyIn(s);
        }
        controls.update();
    }, { passive: false });

    controls = new OrbitControls(camera, viewportEl);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0, 0);
    controls.zoomSpeed = 0.8;
    controls.minDistance = 5;
    controls.maxDistance = 500;
    window.controls = controls;

    // 光照
    const ambientLight = new THREE.AmbientLight(0xffffff, 3.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 4.0);
    directionalLight.position.set(5, 5, 10);
    scene.add(directionalLight);

    // HDR 從 Supabase Storage 讀取，不要再用 raw.githubusercontent.com/jsdelivr——
    // GitHub 官方不允許把 raw.githubusercontent.com 當網站的 CDN/資產主機用，即使流量不大也會被判定成這種用法而限流（429），
    // 2026-08 正式環境就因此整個 3D 預覽全黑（詳見 CHANGELOG 或 git log 這行的異動說明）
    const hdrUrls = [
        'https://nwaylnzaminszyuvcrng.supabase.co/storage/v1/object/public/gallery/1786979227_ede4cab3.hdr'
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
        const sourceName = hdrUrl?.includes('supabase.co') ? 'Supabase Storage' : (hdrUrl?.includes('raw.githubusercontent') ? 'GitHub Raw' : 'jsdelivr CDN');
        console.log(`🔄 嘗試載入 HDR (${sourceName}):`, hdrUrl);

        hdrLoadTimeout = setTimeout(() => {
            console.warn(`⏱️ HDR 載入超時 (${sourceName})，切換備援...`);
            currentHdrIndex++;
            loadHDRWithFallback();
        }, 25000);

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
    // 相機方向沿用主畫面相機（orbit target 固定在原點），置中目標改用該作品自己的外框中心（slot1Target），
    // 避免固定看向原點時作品因為 Bail/尺寸不同而偏移；縮放距離則是「作品自己算出的基準距離（slot1Dist）」
    // 乘上「主相機現在的距離 ÷ 主相機的初始距離（window.initialCameraDist，跟哪個 slot 無關的共同基準）」，
    // 讓縮圖的縮放跟著主畫面滾輪縮放同步變化。兩個 slot 一定要共用同一個基準距離，
    // 不能各自用「存檔當下」主相機的距離，否則兩個 slot 在不同縮放程度下存檔，事後同樣物件會顯示成不同大小
    if (window.slot1Camera && window.slot1Renderer && window.slot1Scene && window.slot1Target) {
        const dir1 = camera.position.clone().normalize();
        const zoomRatio1 = camera.position.length() / window.initialCameraDist;
        window.slot1Camera.position.copy(window.slot1Target).addScaledVector(dir1, window.slot1Dist * zoomRatio1);
        window.slot1Camera.lookAt(window.slot1Target);
        window.slot1Renderer.render(window.slot1Scene, window.slot1Camera);
    }
    if (window.slot2Camera && window.slot2Renderer && window.slot2Scene && window.slot2Target) {
        const dir2 = camera.position.clone().normalize();
        const zoomRatio2 = camera.position.length() / window.initialCameraDist;
        window.slot2Camera.position.copy(window.slot2Target).addScaledVector(dir2, window.slot2Dist * zoomRatio2);
        window.slot2Camera.lookAt(window.slot2Target);
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
    if (_sceneShown) return;
    _sceneShown = true;

    // 清理任何已存在的球體（防禦性清理）
    removeAllPlaceholderSpheres();

    const geometry = new THREE.SphereGeometry(5, 64, 64);
    const material = new THREE.MeshStandardMaterial({ color: 0xC0C0C0, metalness: 1.0, roughness: 0.0 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'placeholderSphere';
    scene.add(mesh);
    window.mainMesh = mesh;
    console.log('✅ showInitialSphere: 顯示初始球體');
    _sceneReadyResolve();
}
