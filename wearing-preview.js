/**
 * DUET 佩戴模擬預覽 - Gemini AI 版本
 * 使用 Gemini 2.5 Flash Image Preview API 進行物理級渲染
 */

(function () {
    'use strict';

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

        // AI 提示詞模板
        prompt: `TASK: Professional Jewelry Portrait Synthesis - Ultra-realistic chain necklace rendering.

REQUIREMENTS:
1. ANALYZE: Identify the person's neck, collarbone, and shoulder anatomy in the Model Image.
2. CHAIN PHYSICS: Generate a photorealistic metallic chain (Silver/Platinum finish) that naturally wraps around the neck following gravity and body contours.
3. PENDANT PLACEMENT: Position the Pendant Image at the center of the collarbone, connected to the chain via a bail loop.
4. LIGHTING & MATERIAL:
   - Match chain reflections to the environment lighting in the photo
   - Add subtle subsurface scattering on skin where chain touches
   - Pendant should cast soft shadow on skin
   - Metal shows realistic highlights and ambient occlusion
5. PERSPECTIVE: Ensure pendant orientation matches the person's body angle and camera perspective.
6. PRESERVATION: Keep the person's face, hair, clothing, and background completely unchanged.
7. QUALITY: High-end jewelry catalog standard. Photorealistic. No artifacts.

OUTPUT: Single composite image with the person naturally wearing the pendant necklace.`
    };

    function getBackendUrl() {
        if (window.BACKEND_URL) return window.BACKEND_URL;
        return '';
    }

    class WearingPreview {
        constructor(containerId) {
            console.log('🎨 初始化 AI 佩戴模擬...');
            this.container = document.getElementById(containerId);
            if (!this.container) {
                console.error('❌ 找不到 container:', containerId);
                return;
            }

            // 狀態
            this.currentModelIndex = 0;
            this.modelImages = [];
            this.uploadedImage = null;
            this.pendantImage = null;
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
            await this.preloadModels();

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
                const img = new Image();
                img.onload = () => {
                    this.uploadedImage = img;
                    this.resultImage = null;
                    console.log('📸 上傳照片:', img.width, 'x', img.height);
                    this.updateCanvas();
                    this.tryGenerateWearing();
                };
                img.src = event.target.result;
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
            if (!this.pendantImage) {
                console.log('ℹ️ 等待商品生成...');
                return;
            }

            await this.generateWearing();
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

                // 準備圖片
                const modelImage = this.uploadedImage || this.modelImages[this.currentModelIndex];
                const modelB64 = await this.imageToBase64(modelImage);
                const pendantB64 = await this.imageToBase64(this.pendantImage);

                // 呼叫後端代理（後端再呼叫 Gemini）
                const response = await fetch(`${backendUrl}${CONFIG.TRYON_ENDPOINT}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        modelImageB64: modelB64,
                        pendantImageB64: pendantB64,
                        prompt: CONFIG.prompt,
                        modelMimeType: "image/png",
                        pendantMimeType: "image/png"
                    })
                });

                const result = await response.json().catch(() => null);
                console.log('📊 tryon 回應:', result);

                if (!response.ok || !result || !result.success) {
                    const msg = result?.error || `tryon 失敗（HTTP ${response.status}）`;
                    throw new Error(msg);
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
                // 渲染場景
                window.renderer.render(window.scene, window.camera);
                await new Promise(resolve => setTimeout(resolve, 100));

                // 捕獲圖片
                const dataURL = window.renderer.domElement.toDataURL('image/png');

                const fullImg = new Image();
                fullImg.onload = () => {
                    const croppedDataURL = this.cropPendantFromRendererImage(fullImg);
                    const finalURL = croppedDataURL || dataURL;

                    const img = new Image();
                    img.onload = () => {
                        this.pendantImage = img;
                        console.log('✅ 墜子圖片已更新:', img.width, 'x', img.height, croppedDataURL ? '(cropped)' : '(full)');
                        this.tryGenerateWearing();
                    };
                    img.src = finalURL;
                };
                fullImg.src = dataURL;

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
