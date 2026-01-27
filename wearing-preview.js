/**
 * DUET 佩戴模擬預覽 - Gemini AI 版本
 * 使用 Gemini 2.5 Flash Image Preview API 進行物理級渲染
 */

(function () {
    'use strict';

    // 用於確認「站上是否載到最新檔案」
    const WEARING_PREVIEW_BUILD = '2026-01-27-tryon-proxy-v5-ready-guard';
    // 讓你能在 Console 直接確認是否為最新版本
    window.WEARING_PREVIEW_BUILD = WEARING_PREVIEW_BUILD;
    console.log('WEARING_PREVIEW_BUILD:', WEARING_PREVIEW_BUILD);

    // 配置
    const CONFIG = {
        // 後端代理端點（由 Render 後端呼叫 Gemini，前端不持有 API Key）
        TRYON_ENDPOINT: '/api/tryon',

        // 預設模型圖片
        models: [
            {
                name: '女性 - 短髮',
                src: 'assets/models/model_f1.png',
                // 以目前圖檔構圖估算：鎖骨中心大約在 0.62~0.64
                clavicleY: 0.63
            },
            {
                name: '女性 - 中長髮',
                src: 'assets/models/model_f2.png',
                clavicleY: 0.63
            },
            {
                name: '女性 - 長髮',
                src: 'assets/models/model_f3.png',
                clavicleY: 0.63
            },
            {
                name: '男性 - 短髮',
                src: 'assets/models/model_m1.png',
                clavicleY: 0.68
            },
            {
                name: '男性 - 中長髮',
                src: 'assets/models/model_m2.png',
                clavicleY: 0.68
            }
        ],

        // AI 提示詞模板（加強：必須生成鏈子，且墜飾要可見）
        prompt: `TASK: Professional Jewelry Portrait Synthesis - Luxury necklace try-on.

REQUIREMENTS:
1. ANALYZE: Identify the person's neck, collarbone, and shoulder anatomy in the Model Image.
2. CHAIN (MUST): Generate a photorealistic metallic chain (Silver/Platinum) that wraps around the neck naturally (gravity + body contours).
   - The chain MUST be visible and continuous. Do NOT omit it.
   - The chain MUST connect to the pendant's bail.
3. PENDANT (MUST): Place the Pendant Image naturally at the center of the collarbone/chest area. Keep realistic scale.
4. LIGHTING & MATERIAL:
   - Match metal reflections to the environment lighting in the photo
   - Add soft, realistic shadow on skin beneath pendant
   - No harsh edges, no stickers, no cartoon look
5. PRESERVATION: Keep the person's face, hair, clothing, and background exactly the same.
6. OUTPUT QUALITY: High-end fashion magazine quality. No artifacts.

OUTPUT: Single composite image. If the chain or pendant is missing, the output is invalid.`
    };

    function getBackendUrl() {
        if (window.BACKEND_URL) return window.BACKEND_URL;
        return '';
    }

    function parseDataURL(dataURL) {
        // data:image/png;base64,xxxx
        if (!dataURL || typeof dataURL !== 'string') return { mimeType: null, b64: null };
        const comma = dataURL.indexOf(',');
        if (!dataURL.startsWith('data:') || comma === -1) return { mimeType: null, b64: null };
        const meta = dataURL.slice(5, comma); // "image/png;base64"
        const b64 = dataURL.slice(comma + 1);
        const semi = meta.indexOf(';');
        const mimeType = semi === -1 ? meta : meta.slice(0, semi);
        return { mimeType: mimeType || null, b64: b64 || null };
    }

    class WearingPreview {
        constructor(containerId) {
            console.log('🎨 初始化 AI 佩戴模擬...', WEARING_PREVIEW_BUILD);
            this.container = document.getElementById(containerId);
            if (!this.container) {
                console.error('❌ 找不到 container:', containerId);
                return;
            }

            // 狀態
            this.currentModelIndex = 0;
            this.modelImages = [];
            this.modelB64Cache = [];     // 與 models 同 index
            this.modelMimeCache = [];    // 與 models 同 index
            this.modelsReadyPromise = null;
            this.uploadedImage = null;
            this.uploadedB64 = null;
            this.uploadedMimeType = null;
            this.pendantImage = null;
            this.pendantB64 = null;
            this.pendantMimeType = 'image/png';
            this.resultImage = null;
            this.loading = false;
            this.lastTryOnAt = 0;
            this.errorToast = null;
            this.currentZoomLevel = 0; // 0: 半身, 1: 鎖骨, 2: 特寫

            // 初始化
            this.init();
        }

        async init() {
            console.log('🔧 創建 UI...');
            this.createUI();
            this.setupEventListeners();

            console.log('📦 預載入模型圖片...');
            this.modelsReadyPromise = this.preloadModels();
            await this.modelsReadyPromise;

            console.log('✅ 初始化完成');
        }

        createUI() {
            this.container.innerHTML = `
                <!-- 標題 -->
                <div style="
                    position: absolute;
                    top: 16px;
                    left: 20px;
                    font-size: 9px;
                    font-weight: 600;
                    letter-spacing: 0.15em;
                    color: rgba(255, 255, 255, 0.35);
                    text-transform: uppercase;
                    z-index: 10;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                ">
                    <span style="width: 5px; height: 5px; background: #D4AF37; border-radius: 50%; box-shadow: 0 0 10px rgba(212, 175, 55, 0.5);"></span>
                    AI Virtual Try-On
                </div>

                <!-- 預覽區域 -->
                <div id="preview-area" style="
                    position: relative;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                ">
                    <canvas id="preview-canvas" style="width: 100%; height: 100%; object-fit: cover;"></canvas>

                    <!-- 錯誤提示（低調，不遮擋主畫面） -->
                    <div id="tryon-error" style="
                        position: absolute;
                        left: 14px;
                        right: 14px;
                        top: 44px;
                        padding: 10px 12px;
                        border-radius: 12px;
                        background: rgba(0,0,0,0.55);
                        border: 1px solid rgba(255,255,255,0.10);
                        color: rgba(255,255,255,0.78);
                        font-size: 10px;
                        line-height: 1.4;
                        display: none;
                        z-index: 120;
                        backdrop-filter: blur(10px);
                    "></div>
                    
                    <!-- 等待提示 -->
                    <div id="waiting-hint" style="
                        position: absolute;
                        inset: 0;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        color: rgba(255, 255, 255, 0.3);
                        text-align: center;
                        padding: 40px;
                        pointer-events: none;
                    ">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom: 16px; opacity: 0.5;">
                            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                            <path d="M2 17l10 5 10-5"/>
                            <path d="M2 12l10 5 10-5"/>
                        </svg>
                        <div style="font-size: 11px; font-weight: 500; margin-bottom: 8px;">等待商品生成</div>
                        <div style="font-size: 9px; opacity: 0.6;">完成設計後將自動顯示佩戴效果</div>
                    </div>

                    <!-- 載入動畫 -->
                    <div id="loading-overlay" style="
                        position: absolute;
                        inset: 0;
                        background: rgba(0, 0, 0, 0.85);
                        backdrop-filter: blur(20px);
                        display: none;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        z-index: 100;
                    ">
                        <div style="
                            width: 48px;
                            height: 48px;
                            border: 2px solid rgba(212, 175, 55, 0.2);
                            border-top-color: #D4AF37;
                            border-radius: 50%;
                            animation: spin 1s linear infinite;
                            margin-bottom: 16px;
                        "></div>
                        <div style="
                            font-size: 11px;
                            font-weight: 600;
                            color: #D4AF37;
                            letter-spacing: 0.2em;
                            text-transform: uppercase;
                            margin-bottom: 8px;
                        ">AI Processing</div>
                        <div style="
                            font-size: 9px;
                            color: rgba(255, 255, 255, 0.4);
                            text-align: center;
                            line-height: 1.4;
                        ">
                            <div>正在分析人體結構...</div>
                            <div style="opacity: 0.6; margin-top: 4px;">模擬金屬光影與重力效果</div>
                        </div>
                    </div>
                </div>

                <!-- 底部控制列 -->
                <div style="
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    padding: 12px 16px;
                    background: linear-gradient(to top, rgba(0, 0, 0, 0.5), transparent);
                    display: flex;
                    gap: 8px;
                    z-index: 10;
                ">
                    <!-- 模型切換按鈕 -->
                    <button id="prev-model" class="control-btn" title="上一個模特">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                    </button>
                    <button id="next-model" class="control-btn" title="下一個模特">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </button>
                    
                    <div style="flex: 1;"></div>

                    <!-- 視角切換 -->
                    <button id="zoom-half" class="zoom-btn active" title="半身照">半身</button>
                    <button id="zoom-clavicle" class="zoom-btn" title="鎖骨周邊">鎖骨</button>
                    <button id="zoom-close" class="zoom-btn" title="墜飾特寫">特寫</button>

                    <div style="flex: 1;"></div>

                    <!-- 上傳按鈕 -->
                    <button id="upload-photo" class="control-btn" title="上傳照片">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                    </button>
                    <input type="file" id="photo-input" accept="image/*" style="display: none;">
                </div>

                <style>
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }

                    .control-btn, .zoom-btn {
                        background: rgba(255, 255, 255, 0.05);
                        backdrop-filter: blur(10px);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        border-radius: 8px;
                        color: rgba(255, 255, 255, 0.6);
                        cursor: pointer;
                        transition: all 0.2s;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }

                    .control-btn {
                        width: 36px;
                        height: 36px;
                        padding: 0;
                    }

                    .zoom-btn {
                        padding: 8px 12px;
                        font-size: 10px;
                        font-weight: 500;
                        letter-spacing: 0.05em;
                    }

                    .control-btn:hover, .zoom-btn:hover {
                        background: rgba(255, 255, 255, 0.1);
                        border-color: rgba(212, 175, 55, 0.3);
                        color: rgba(255, 255, 255, 0.9);
                    }

                    .zoom-btn.active {
                        background: rgba(212, 175, 55, 0.15);
                        border-color: rgba(212, 175, 55, 0.4);
                        color: #D4AF37;
                    }
                </style>
            `;

            this.canvas = document.getElementById('preview-canvas');
            this.ctx = this.canvas.getContext('2d');
            this.loadingOverlay = document.getElementById('loading-overlay');
            this.waitingHint = document.getElementById('waiting-hint');
            this.errorToast = document.getElementById('tryon-error');
        }

        getJewelryObjects() {
            const objs = [];
            if (window.mainMesh) objs.push(window.mainMesh);
            // index.html 內的 bailMesh 預設是區域變數；我們在 index.html 已暴露 window.bailMesh
            if (window.bailMesh) objs.push(window.bailMesh);
            return objs;
        }

        /**
         * 產生「透明背景(去背)」的墜飾 PNG（包含 bail），再縮放到合理尺寸供 AI 使用。
         * 這不是單純裁切：先用 alpha=0 清空背景，確保輸入是真正去背 PNG。
         */
        captureJewelryTransparentDataURL(options = {}) {
            const size = options.size || 1024;
            const maxSide = options.maxSide || 520;
            const alphaThreshold = options.alphaThreshold ?? 6;

            if (!window.THREE || !window.renderer || !window.scene || !window.camera) return null;
            const THREE = window.THREE;
            const renderer = window.renderer;
            const scene = window.scene;
            const camera = window.camera;

            const jewelry = this.getJewelryObjects();
            if (!jewelry.length) return null;

            const oldTarget = renderer.getRenderTarget();
            const oldBg = scene.background;
            const oldClear = renderer.getClearColor(new THREE.Color());
            const oldClearAlpha = renderer.getClearAlpha();
            const oldSize = renderer.getSize(new THREE.Vector2());
            const oldPixelRatio = renderer.getPixelRatio();

            const oldCam = {
                aspect: camera.aspect,
                near: camera.near,
                far: camera.far,
                position: camera.position.clone(),
                quaternion: camera.quaternion.clone(),
            };

            // 隱藏非墜飾 mesh（避免把場景其他物件/背景一起 render 進來）
            const keep = new Set();
            for (const obj of jewelry) obj.traverse(o => keep.add(o));

            const visBackup = [];
            scene.traverse((o) => {
                if (o && o.isMesh && !keep.has(o)) {
                    visBackup.push([o, o.visible]);
                    o.visible = false;
                }
            });

            try {
                const box = new THREE.Box3();
                for (const obj of jewelry) box.expandByObject(obj);
                const sphere = new THREE.Sphere();
                box.getBoundingSphere(sphere);

                // 保持原視角方向，將相機拉近以填滿畫面
                const dir = oldCam.position.clone().sub(sphere.center).normalize();
                const fov = THREE.MathUtils.degToRad(camera.fov || 50);
                const dist = (sphere.radius / Math.tan(fov / 2)) * 1.35;

                camera.position.copy(sphere.center.clone().add(dir.multiplyScalar(dist)));
                camera.lookAt(sphere.center);
                camera.near = Math.max(0.01, dist / 100);
                camera.far = Math.max(camera.near + 10, dist * 100);
                camera.aspect = 1;
                camera.updateProjectionMatrix();

                // 透明去背
                scene.background = null;
                renderer.setClearColor(0x000000, 0);

                const rt = new THREE.WebGLRenderTarget(size, size, {
                    format: THREE.RGBAFormat,
                    type: THREE.UnsignedByteType,
                    depthBuffer: true,
                    stencilBuffer: false,
                });

                renderer.setPixelRatio(1);
                renderer.setSize(size, size, false);
                renderer.setRenderTarget(rt);
                renderer.clear(true, true, true);
                renderer.render(scene, camera);

                const pixels = new Uint8Array(size * size * 4);
                renderer.readRenderTargetPixels(rt, 0, 0, size, size, pixels);

                const c = document.createElement('canvas');
                c.width = size;
                c.height = size;
                const ctx = c.getContext('2d');
                const imgData = ctx.createImageData(size, size);

                // readRenderTargetPixels 是左下原點，需要翻轉
                for (let y = 0; y < size; y++) {
                    for (let x = 0; x < size; x++) {
                        const src = ((size - 1 - y) * size + x) * 4;
                        const dst = (y * size + x) * 4;
                        imgData.data[dst] = pixels[src];
                        imgData.data[dst + 1] = pixels[src + 1];
                        imgData.data[dst + 2] = pixels[src + 2];
                        imgData.data[dst + 3] = pixels[src + 3];
                    }
                }
                ctx.putImageData(imgData, 0, 0);

                // 縮緊透明邊界（背景仍是透明，只是移除空白）
                let minX = size, minY = size, maxX = 0, maxY = 0;
                let found = false;
                for (let y = 0; y < size; y++) {
                    for (let x = 0; x < size; x++) {
                        const a = imgData.data[(y * size + x) * 4 + 3];
                        if (a > alphaThreshold) {
                            found = true;
                            minX = Math.min(minX, x);
                            minY = Math.min(minY, y);
                            maxX = Math.max(maxX, x);
                            maxY = Math.max(maxY, y);
                        }
                    }
                }

                if (!found) return c.toDataURL('image/png');

                const pad = Math.round(Math.max(size * 0.015, 10));
                minX = this.clamp(minX - pad, 0, size - 1);
                minY = this.clamp(minY - pad, 0, size - 1);
                maxX = this.clamp(maxX + pad, 0, size - 1);
                maxY = this.clamp(maxY + pad, 0, size - 1);

                const cropW = Math.max(1, maxX - minX + 1);
                const cropH = Math.max(1, maxY - minY + 1);

                const scale = Math.min(1, maxSide / Math.max(cropW, cropH));
                const outW = Math.max(1, Math.round(cropW * scale));
                const outH = Math.max(1, Math.round(cropH * scale));

                const out = document.createElement('canvas');
                out.width = outW;
                out.height = outH;
                const octx = out.getContext('2d');
                octx.imageSmoothingEnabled = true;
                octx.imageSmoothingQuality = 'high';
                octx.drawImage(c, minX, minY, cropW, cropH, 0, 0, outW, outH);

                return out.toDataURL('image/png');
            } catch (e) {
                console.warn('⚠️ 無法生成透明墜飾 PNG:', e);
                return null;
            } finally {
                // 還原
                for (const [o, v] of visBackup) o.visible = v;
                scene.background = oldBg;
                renderer.setClearColor(oldClear, oldClearAlpha);
                renderer.setRenderTarget(oldTarget);
                renderer.setPixelRatio(oldPixelRatio);
                renderer.setSize(oldSize.x, oldSize.y, false);

                camera.position.copy(oldCam.position);
                camera.quaternion.copy(oldCam.quaternion);
                camera.near = oldCam.near;
                camera.far = oldCam.far;
                camera.aspect = oldCam.aspect;
                camera.updateProjectionMatrix();
            }
        }

        getBaseClavicleY() {
            // 上傳照片目前沒有自動鎖骨偵測：先用合理預設值（偏向鎖骨區域）
            if (this.uploadedImage) return 0.64;
            const model = CONFIG.models[this.currentModelIndex];
            return (model && typeof model.clavicleY === 'number') ? model.clavicleY : 0.64;
        }

        clamp(n, min, max) {
            return Math.max(min, Math.min(max, n));
        }

        setupEventListeners() {
            // 模型切換
            document.getElementById('prev-model').addEventListener('click', () => this.switchModel(-1));
            document.getElementById('next-model').addEventListener('click', () => this.switchModel(1));

            // 視角切換
            document.getElementById('zoom-half').addEventListener('click', () => this.setZoom(0));
            document.getElementById('zoom-clavicle').addEventListener('click', () => this.setZoom(1));
            document.getElementById('zoom-close').addEventListener('click', () => this.setZoom(2));

            // 上傳照片
            document.getElementById('upload-photo').addEventListener('click', () => {
                document.getElementById('photo-input').click();
            });
            document.getElementById('photo-input').addEventListener('change', (e) => this.handlePhotoUpload(e));

            // 窗口調整
            window.addEventListener('resize', () => this.updateCanvas());
        }

        async preloadModels() {
            const promises = CONFIG.models.map(model => {
                return new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => {
                        console.log('✅ 載入模型:', model.name);
                        resolve(img);
                    };
                    img.onerror = () => {
                        console.warn('⚠️ 載入失敗:', model.name);
                        resolve(null);
                    };
                    img.src = model.src;
                });
            });

            this.modelImages = await Promise.all(promises);
            console.log('📦 模型載入完成:', this.modelImages.filter(img => img).length, '/', CONFIG.models.length);

            // 預先快取 base64（避免某些時機 imageToBase64 取到 null）
            this.modelB64Cache = [];
            this.modelMimeCache = [];
            for (let i = 0; i < this.modelImages.length; i++) {
                const img = this.modelImages[i];
                if (!img) {
                    this.modelB64Cache[i] = null;
                    this.modelMimeCache[i] = null;
                    continue;
                }
                const b64 = await this.imageToBase64(img);
                this.modelB64Cache[i] = b64;
                // assets/models 目前都是 png
                this.modelMimeCache[i] = 'image/png';
            }

            this.updateCanvas();
        }

        switchModel(direction) {
            this.currentModelIndex = (this.currentModelIndex + direction + CONFIG.models.length) % CONFIG.models.length;
            this.uploadedImage = null;
            this.resultImage = null;
            console.log('🔄 切換至模型:', CONFIG.models[this.currentModelIndex].name);
            this.updateCanvas();
            this.tryGenerateWearing();
        }

        setZoom(level) {
            this.currentZoomLevel = level;

            // 更新按鈕樣式
            document.querySelectorAll('.zoom-btn').forEach(btn => btn.classList.remove('active'));
            const buttons = ['zoom-half', 'zoom-clavicle', 'zoom-close'];
            document.getElementById(buttons[level]).classList.add('active');

            console.log('🔍 視角切換:', ['半身照', '鎖骨周邊', '墜飾特寫'][level]);
            this.updateCanvas();
        }

        handlePhotoUpload(e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const dataURL = event.target.result;
                const parsed = parseDataURL(dataURL);
                this.uploadedB64 = parsed.b64;
                this.uploadedMimeType = parsed.mimeType || file.type || 'image/jpeg';

                const img = new Image();
                img.onload = () => {
                    this.uploadedImage = img;
                    this.resultImage = null;
                    console.log('📸 上傳照片:', img.width, 'x', img.height);
                    this.updateCanvas();
                    this.tryGenerateWearing();
                };
                img.src = dataURL;
            };
            reader.readAsDataURL(file);
        }

        updateCanvas() {
            if (!this.canvas) return;

            const container = this.canvas.parentElement;
            const rect = container.getBoundingClientRect();

            this.canvas.width = rect.width;
            this.canvas.height = rect.height;

            this.render();
        }

        render() {
            const ctx = this.ctx;
            const w = this.canvas.width;
            const h = this.canvas.height;

            ctx.clearRect(0, 0, w, h);

            // 顯示結果圖（AI 合成後）或原始模型圖
            const displayImage = this.resultImage || this.uploadedImage || this.modelImages[this.currentModelIndex];

            if (!displayImage) {
                this.waitingHint.style.display = 'flex';
                return;
            }

            this.waitingHint.style.display = 'none';

            // 根據視角調整顯示
            const zoomLevels = [1.0, 1.9, 2.8];
            const zoom = zoomLevels[this.currentZoomLevel];

            // 聚焦點改為以「鎖骨」為主（避免變成人臉特寫）
            const baseClavicleY = this.getBaseClavicleY();
            const focusY = (zoom === 1.0)
                ? 0.55
                : this.clamp(baseClavicleY + (this.currentZoomLevel === 2 ? 0.06 : 0.00), 0.05, 0.95);

            const imgAspect = displayImage.width / displayImage.height;
            const canvasAspect = w / h;

            let drawW, drawH, drawX, drawY;

            if (zoom === 1.0) {
                // 半身照：完整顯示
                if (imgAspect > canvasAspect) {
                    drawH = h;
                    drawW = h * imgAspect;
                    drawX = -(drawW - w) / 2;
                    drawY = 0;
                } else {
                    drawW = w;
                    drawH = w / imgAspect;
                    drawX = 0;
                    drawY = -(drawH - h) / 2;
                }
            } else {
                // 放大視角：聚焦特定區域
                const scaledW = w * zoom;
                const scaledH = h * zoom;
                const focusPixelY = displayImage.height * focusY;

                if (imgAspect > canvasAspect) {
                    drawH = scaledH;
                    drawW = drawH * imgAspect;
                } else {
                    drawW = scaledW;
                    drawH = drawW / imgAspect;
                }

                // 在原圖座標中，畫面高度相當於 (image.height / zoom)
                const viewSrcH = displayImage.height / zoom;
                const cropStartY = this.clamp(
                    focusPixelY - viewSrcH / 2,
                    0,
                    Math.max(0, displayImage.height - viewSrcH)
                );
                drawX = -(drawW - w) / 2;
                drawY = -(cropStartY * (drawH / displayImage.height));
            }

            ctx.drawImage(displayImage, drawX, drawY, drawW, drawH);
        }

        async tryGenerateWearing() {
            // 檢查是否有墜子圖片
            if (!this.pendantB64) {
                console.log('ℹ️ 等待商品生成...');
                return;
            }

            await this.generateWearing();
        }

        async ensureModelB64Ready() {
            if (this.uploadedB64 && this.uploadedB64.length > 64) return true;

            // 先看 cache
            const cached = this.modelB64Cache?.[this.currentModelIndex];
            if (cached && cached.length > 64) return true;

            // 等待模型預載入完成（避免在 init 還沒跑完就觸發）
            if (this.modelsReadyPromise) {
                try {
                    await this.modelsReadyPromise;
                } catch (_) {}
            }

            const cached2 = this.modelB64Cache?.[this.currentModelIndex];
            if (cached2 && cached2.length > 64) return true;

            // 最後退化：用目前的 Image 再轉一次
            const img = this.modelImages?.[this.currentModelIndex];
            if (img) {
                const b64 = await this.imageToBase64(img);
                if (b64 && b64.length > 64) {
                    this.modelB64Cache[this.currentModelIndex] = b64;
                    this.modelMimeCache[this.currentModelIndex] = 'image/png';
                    return true;
                }
            }

            return false;
        }

        async generateWearing() {
            // 防止連點/重複觸發造成大量 API 呼叫
            const now = Date.now();
            if (this.loading) return;
            if (now - this.lastTryOnAt < 1500) return;
            this.lastTryOnAt = now;

            this.loading = true;
            this.loadingOverlay.style.display = 'flex';
            console.log('🤖 開始 AI 合成...');

            try {
                const backendUrl = getBackendUrl();
                if (!backendUrl) {
                    console.error('❌ 找不到 BACKEND_URL，無法呼叫後端 tryon 服務');
                    this.showError('後端未設定，無法生成佩戴圖');
                    return;
                }
                if (this.errorToast) this.errorToast.style.display = 'none';

                // 準備圖片（全部走快取，避免 null）
                const modelReady = await this.ensureModelB64Ready();
                if (!modelReady) {
                    console.warn('⚠️ modelImageB64 尚未就緒（等待模型預載入/上傳照片）');
                    this.showError('模型圖片尚未就緒，請稍後再試');
                    return;
                }

                const modelB64 = this.uploadedB64 || this.modelB64Cache[this.currentModelIndex] || null;
                const modelMimeType = this.uploadedMimeType || this.modelMimeCache[this.currentModelIndex] || 'image/png';
                const pendantB64 = this.pendantB64 || null;
                const pendantMimeType = this.pendantMimeType || 'image/png';

                // 防呆：避免打到後端 400
                if (!modelB64 || modelB64.length < 64) {
                    console.warn('⚠️ modelImageB64 尚未就緒(長度不足)');
                    this.showError('模型圖片尚未就緒，請稍後再試');
                    return;
                }
                if (!pendantB64 || pendantB64.length < 64) {
                    console.warn('⚠️ pendantImageB64 尚未就緒');
                    this.showError('墜飾圖片尚未就緒，請先生成商品');
                    return;
                }

                // 呼叫後端代理（後端再呼叫 Gemini）
                const response = await fetch(`${backendUrl}${CONFIG.TRYON_ENDPOINT}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        modelImageB64: modelB64,
                        pendantImageB64: pendantB64,
                        prompt: CONFIG.prompt,
                        modelMimeType,
                        pendantMimeType
                    })
                });

                const result = await response.json().catch(() => null);
                console.log('📊 tryon 回應:', result);

                if (!response.ok || !result || !result.success) {
                    const baseMsg = result?.error || `tryon 失敗（HTTP ${response.status}）`;
                    const details = result?.details ? `（details: ${typeof result.details === 'string' ? result.details : JSON.stringify(result.details).slice(0, 300)}）` : '';
                    throw new Error(`${baseMsg}${details}`);
                }

                const outputB64 = result.imageB64;
                const mimeType = result.mimeType || 'image/png';
                if (!outputB64) throw new Error('tryon 未回傳影像');

                // 載入結果圖片
                const img = new Image();
                img.onload = () => {
                    this.resultImage = img;
                    this.updateCanvas();
                    console.log('✅ AI 合成完成:', img.width, 'x', img.height);
                };
                img.src = `data:${mimeType};base64,${outputB64}`;

            } catch (error) {
                console.error('❌ AI 合成失敗:', error);
                this.showError(`AI 模擬失敗：${error?.message || '請稍後再試'}`);
            } finally {
                this.loading = false;
                this.loadingOverlay.style.display = 'none';
            }
        }

        async imageToBase64(img) {
            // 如果是 Image 物件，需要轉換為 canvas 再提取
            if (img instanceof HTMLImageElement) {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const dataURL = canvas.toDataURL('image/png');
                return dataURL.split(',')[1];
            }
            return null;
        }

        showError(message) {
            // 低調提示：不覆蓋畫面、也不會被 render() 隱藏
            if (this.errorToast) {
                this.errorToast.textContent = message;
                this.errorToast.style.display = 'block';
                clearTimeout(this._errorToastTimer);
                this._errorToastTimer = setTimeout(() => {
                    if (this.errorToast) this.errorToast.style.display = 'none';
                }, 8000);
                return;
            }
            // 退化方案：用等待提示區
            const hint = this.waitingHint;
            hint.style.display = 'flex';
            hint.innerHTML = `<div style="font-size: 11px; font-weight: 500; color: rgba(255, 100, 100, 0.9);">${message}</div>`;
        }

        cropPendantFromRendererImage(fullImg) {
            try {
                if (!window.THREE || !window.mainMesh || !window.camera || !window.renderer) return null;
                const THREE = window.THREE;
                const mesh = window.mainMesh;
                const camera = window.camera;
                const dom = window.renderer.domElement;
                const rw = dom.width;
                const rh = dom.height;

                const box = new THREE.Box3().setFromObject(mesh);
                const corners = [
                    new THREE.Vector3(box.min.x, box.min.y, box.min.z),
                    new THREE.Vector3(box.min.x, box.min.y, box.max.z),
                    new THREE.Vector3(box.min.x, box.max.y, box.min.z),
                    new THREE.Vector3(box.min.x, box.max.y, box.max.z),
                    new THREE.Vector3(box.max.x, box.min.y, box.min.z),
                    new THREE.Vector3(box.max.x, box.min.y, box.max.z),
                    new THREE.Vector3(box.max.x, box.max.y, box.min.z),
                    new THREE.Vector3(box.max.x, box.max.y, box.max.z),
                ];

                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                for (const v of corners) {
                    v.project(camera);
                    const x = (v.x * 0.5 + 0.5) * rw;
                    const y = (-v.y * 0.5 + 0.5) * rh;
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                }

                if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return null;

                const padX = (maxX - minX) * 0.22;
                const padY = (maxY - minY) * 0.22;
                minX = this.clamp(minX - padX, 0, rw);
                minY = this.clamp(minY - padY, 0, rh);
                maxX = this.clamp(maxX + padX, 0, rw);
                maxY = this.clamp(maxY + padY, 0, rh);

                const cropW = Math.max(1, Math.floor(maxX - minX));
                const cropH = Math.max(1, Math.floor(maxY - minY));

                const maxSide = 520;
                const scale = Math.min(1, maxSide / Math.max(cropW, cropH));
                const outW = Math.max(1, Math.round(cropW * scale));
                const outH = Math.max(1, Math.round(cropH * scale));

                const c = document.createElement('canvas');
                c.width = outW;
                c.height = outH;
                const ctx = c.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(fullImg, minX, minY, cropW, cropH, 0, 0, outW, outH);
                return c.toDataURL('image/png');
            } catch (e) {
                console.warn('⚠️ 無法裁切墜飾圖片:', e);
                return null;
            }
        }

        // 供外部調用：當 3D 模型生成時更新墜子圖片
        async updatePendant() {
            console.log('📸 捕獲 3D 墜子...');

            if (!window.renderer || !window.scene || !window.camera) {
                console.warn('⚠️ Three.js 尚未初始化');
                return;
            }
            if (!window.mainMesh) {
                console.warn('⚠️ mainMesh 不存在，暫時無法截取墜飾');
                return;
            }

            try {
                // 先嘗試：透明去背墜飾 PNG（包含 bail）
                const transparentURL = this.captureJewelryTransparentDataURL({ size: 1024, maxSide: 520 });

                if (transparentURL) {
                    const parsed = parseDataURL(transparentURL);
                    this.pendantB64 = parsed.b64;
                    this.pendantMimeType = parsed.mimeType || 'image/png';

                    const img = new Image();
                    img.onload = () => {
                        this.pendantImage = img;
                        console.log('✅ 墜子圖片已更新(transparent):', img.width, 'x', img.height);
                        this.tryGenerateWearing();
                    };
                    img.src = transparentURL;
                    return;
                }

                // 退回：原本 renderer 截圖（可能包含背景）
                console.warn('⚠️ 透明去背失敗，退回使用 renderer 截圖');
                window.renderer.render(window.scene, window.camera);
                await new Promise(resolve => setTimeout(resolve, 80));
                const dataURL = window.renderer.domElement.toDataURL('image/png');
                const parsed = parseDataURL(dataURL);
                this.pendantB64 = parsed.b64;
                this.pendantMimeType = parsed.mimeType || 'image/png';

                const img = new Image();
                img.onload = () => {
                    this.pendantImage = img;
                    console.log('✅ 墜子圖片已更新(backup):', img.width, 'x', img.height);
                    this.tryGenerateWearing();
                };
                img.src = dataURL;

            } catch (error) {
                console.error('❌ 捕獲墜子失敗:', error);
            }
        }
    }

    // 初始化
    function init() {
        console.log('🚀 啟動 AI 佩戴模擬系統...');
        const container = document.getElementById('wearing-preview-container');
        if (!container) {
            console.error('❌ 找不到 wearing-preview-container');
            return;
        }

        const preview = new WearingPreview('wearing-preview-container');
        window.wearingPreviewInstance = preview;

        // 暴露更新函數供主程式調用
        window.updateWearingPreview = () => {
            if (preview) {
                preview.updatePendant();
            }
        };
    }

    // DOM 載入完成後初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 300);
    }

})();
