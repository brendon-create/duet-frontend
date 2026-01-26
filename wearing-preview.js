/**
 * DUET 佩戴模擬預覽模組
 * 完整版本：包含三種視角模式、智能鎖骨檢測、自動更新
 */

(function () {
    'use strict';

    const CONFIG = {
        models: [
            { name: '女性 - 短髮', src: 'assets/models/model_f1.png', neckY: 0.18, pendantY: 0.35, clavicleY: 0.22 },
            { name: '女性 - 中長髮', src: 'assets/models/model_f2.png', neckY: 0.18, pendantY: 0.35, clavicleY: 0.22 },
            { name: '女性 - 長髮', src: 'assets/models/model_f3.png', neckY: 0.18, pendantY: 0.35, clavicleY: 0.22 },
            { name: '男性 - 短髮', src: 'assets/models/model_m1.png', neckY: 0.20, pendantY: 0.38, clavicleY: 0.24 },
            { name: '男性 - 中長髮', src: 'assets/models/model_m2.png', neckY: 0.20, pendantY: 0.38, clavicleY: 0.24 }
        ],
        chain: { color: '#D4AF37', width: 2 },
        // 三種視角模式：半身照、鎖骨周邊、墜飾特寫
        // zoom: 圖片裁剪縮放倍數（1.0 = 不裁剪，>1.0 = 放大裁剪）
        // focusY: 聚焦點的 Y 位置（0-1，鎖骨約在 0.22-0.24）
        // pendantSize: 墜飾顯示大小（像素）
        // chainOffset: 墜飾從鎖骨的垂直偏移量
        viewModes: [
            { name: '半身照', zoom: 1.0, focusY: 0.5, pendantSize: 45, chainOffset: 0.15 },      // 不裁剪，完整顯示
            { name: '鎖骨周邊', zoom: 1.8, focusY: 0.23, pendantSize: 65, chainOffset: 0.12 },   // 以鎖骨為中心放大
            { name: '墜飾特寫', zoom: 3.0, focusY: 0.30, pendantSize: 90, chainOffset: 0.10 }    // 大幅放大，只看鎖骨周邊
        ]
    };

    class WearingPreview {
        constructor(containerId) {
            console.log('🔍 WearingPreview constructor 被調用，containerId:', containerId);
            this.container = document.getElementById(containerId);
            if (!this.container) {
                console.error('❌ 無法找到 container:', containerId);
                return;
            }
            console.log('✅ Container 找到，開始初始化');

            this.canvas = null;
            this.ctx = null;
            this.currentModelIndex = 0;
            this.currentViewMode = 1; // 預設鎖骨周邊
            this.modelImages = [];
            this.uploadedImage = null;
            this.uploadedClavicleY = null; // 上傳照片的鎖骨位置

            this.init();
        }

        async init() {
            console.log('🔍 WearingPreview init() 開始');
            try {
                // 先創建 UI，不等待圖片載入
                console.log('🎨 開始創建 UI（不等待圖片載入）...');
                this.createUI();
                console.log('✅ UI 創建完成');
                console.log('🔗 設置事件監聽器...');
                this.setupEventListeners();
                console.log('✅ 事件監聽器設置完成');
                window.addEventListener('resize', () => this.resize());
                
                // 在背景載入圖片，不阻塞 UI 顯示
                console.log('📦 開始預載入模型圖片（背景載入）...');
                this.preloadModels().then(() => {
                    console.log('✅ 模型圖片預載入完成，共', this.modelImages.length, '張');
                    console.log('🖼️ 開始渲染...');
                    this.render();
                }).catch(error => {
                    console.error('❌ 圖片預載入錯誤:', error);
                    this.render();
                });
                
                // 立即渲染一次（使用佔位符或已載入的圖片）
                console.log('🖼️ 立即渲染初始畫面...');
                await this.render();
                console.log('✅ 初始化完成！');
            } catch (error) {
                console.error('❌ WearingPreview 初始化錯誤:', error);
            }
        }

        async preloadModels() {
            const promises = CONFIG.models.map((model, index) => {
                return new Promise(resolve => {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.onload = () => {
                        console.log(`✅ 模型圖片 ${index + 1}/${CONFIG.models.length} 載入成功:`, model.name);
                        resolve(img);
                    };
                    img.onerror = () => {
                        console.warn(`⚠️ 無法載入模特兒圖片 ${index + 1}:`, model.src, '，使用佔位符');
                        resolve(this.createPlaceholder(model.name));
                    };
                    img.src = model.src;
                });
            });
            this.modelImages = await Promise.all(promises);
            console.log('✅ 所有模型圖片預載入完成');
        }

        createPlaceholder(name) {
            const canvas = document.createElement('canvas');
            canvas.width = 600;
            canvas.height = 800;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#2a2a2a';
            ctx.fillRect(0, 0, 600, 800);
            ctx.fillStyle = '#666';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(name, 300, 400);
            const img = new Image();
            img.src = canvas.toDataURL();
            return img;
        }

        createUI() {
            console.log('🎨 createUI() 開始，container 當前內容:', this.container.innerHTML.substring(0, 100));
            
            this.container.innerHTML = `
                <!-- 標題裝飾層 -->
                <div style="
                    position: absolute; 
                    top: 20px; 
                    left: 24px; 
                    font-size: 10px; 
                    font-weight: 600;
                    letter-spacing: 0.15em; 
                    color: rgba(255, 255, 255, 0.4); 
                    text-transform: uppercase; 
                    z-index: 5;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                ">
                    <span style="width: 6px; height: 6px; background: #D4AF37; border-radius: 50%; box-shadow: 0 0 12px rgba(212, 175, 55, 0.6);"></span>
                    Model Simulation
                </div>
                
                <!-- 主預覽區 -->
                <div style="
                    position: absolute;
                    top: 50px;
                    left: 12px;
                    right: 12px;
                    bottom: 120px;
                    border-radius: 12px;
                    overflow: hidden;
                ">
                    <canvas id="wearing-canvas" 
                        style="
                            width: 100%;
                            height: 100%;
                            display: block;
                            background: rgba(0, 0, 0, 0.2);
                        "></canvas>
                </div>
                
                <!-- 控制列 -->
                <div style="
                    position: absolute;
                    bottom: 20px;
                    left: 12px;
                    right: 12px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                ">
                    <!-- 第一行：視角模式切換 -->
                    <div style="
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 4px;
                    ">
                        <button id="view-half" class="view-mode-btn" data-mode="0" style="
                            flex: 1;
                            padding: 6px 8px;
                            border-radius: 12px;
                            border: 1px solid rgba(255,255,255,0.2);
                            background: rgba(255,255,255,0.05);
                            color: rgba(255,255,255,0.6);
                            cursor: pointer;
                            font-size: 9px;
                            transition: all 0.3s;
                        ">半身</button>
                        <button id="view-clavicle" class="view-mode-btn active" data-mode="1" style="
                            flex: 1;
                            padding: 6px 8px;
                            border-radius: 12px;
                            border: 1px solid rgba(212,175,55,0.5);
                            background: rgba(212,175,55,0.15);
                            color: rgba(212,175,55,1);
                            cursor: pointer;
                            font-size: 9px;
                            transition: all 0.3s;
                        ">鎖骨</button>
                        <button id="view-closeup" class="view-mode-btn" data-mode="2" style="
                            flex: 1;
                            padding: 6px 8px;
                            border-radius: 12px;
                            border: 1px solid rgba(255,255,255,0.2);
                            background: rgba(255,255,255,0.05);
                            color: rgba(255,255,255,0.6);
                            cursor: pointer;
                            font-size: 9px;
                            transition: all 0.3s;
                        ">特寫</button>
                    </div>
                    
                    <!-- 第二行：其他控制 -->
                    <div style="
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 8px;
                    ">
                        <!-- 左：Model 切換 -->
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <button id="prev-model" style="
                                width: 28px;
                                height: 28px;
                                border-radius: 50%;
                                border: 1px solid rgba(255,255,255,0.2);
                                background: rgba(255,255,255,0.05);
                                color: rgba(255,255,255,0.8);
                                cursor: pointer;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                transition: all 0.3s;
                                font-size: 14px;
                                padding: 0;
                            ">◀</button>
                            <span id="model-indicator" style="
                                color: rgba(255,255,255,0.6);
                                font-size: 11px;
                                min-width: 32px;
                                text-align: center;
                            ">1/5</span>
                            <button id="next-model" style="
                                width: 28px;
                                height: 28px;
                                border-radius: 50%;
                                border: 1px solid rgba(255,255,255,0.2);
                                background: rgba(255,255,255,0.05);
                                color: rgba(255,255,255,0.8);
                                cursor: pointer;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                transition: all 0.3s;
                                font-size: 14px;
                                padding: 0;
                            ">▶</button>
                        </div>
                        
                        <!-- 中：上傳按鈕 -->
                        <button id="upload-btn" style="
                            padding: 6px 12px;
                            border-radius: 16px;
                            border: 1px solid rgba(212,175,55,0.3);
                            background: rgba(212,175,55,0.05);
                            color: rgba(212,175,55,0.8);
                            cursor: pointer;
                            font-size: 10px;
                            transition: all 0.3s;
                            white-space: nowrap;
                        ">📷</button>
                        <input type="file" id="photo-upload" accept="image/*" style="display:none;">
                    </div>
                </div>
            `;

            this.canvas = document.getElementById('wearing-canvas');
            this.ctx = this.canvas.getContext('2d');
            
            // 延遲 resize 以確保容器尺寸已正確計算
            setTimeout(() => {
                this.resize();
            }, 100);
        }

        resize() {
            if (!this.canvas || !this.container) {
                console.warn('⚠️ Canvas 或 Container 未準備好，無法 resize');
                return;
            }
            
            const previewArea = this.canvas.parentElement;
            if (!previewArea) {
                console.warn('⚠️ 找不到 previewArea，無法 resize');
                return;
            }
            
            const areaRect = previewArea.getBoundingClientRect();
            if (areaRect.width === 0 || areaRect.height === 0) {
                console.warn('⚠️ PreviewArea 尺寸為 0，延遲 resize');
                setTimeout(() => this.resize(), 200);
                return;
            }
            
            this.canvas.width = areaRect.width;
            this.canvas.height = areaRect.height;
            console.log('✅ Canvas 尺寸設置為:', areaRect.width, 'x', areaRect.height);
            
            // 只在尺寸有效時才渲染
            if (this.canvas.width > 0 && this.canvas.height > 0) {
                this.render();
            }
        }

        setupEventListeners() {
            // 視角模式切換
            const viewModeBtns = this.container.querySelectorAll('.view-mode-btn');
            viewModeBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const mode = parseInt(btn.getAttribute('data-mode'));
                    console.log('🔍 切換視角模式:', mode, CONFIG.viewModes[mode].name);
                    this.setViewMode(mode);
                });
            });

            // Model 切換
            const prevBtn = document.getElementById('prev-model');
            const nextBtn = document.getElementById('next-model');
            if (prevBtn) {
                prevBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.prevModel();
                });
            }
            if (nextBtn) {
                nextBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.nextModel();
                });
            }

            // 上傳
            const uploadBtn = document.getElementById('upload-btn');
            const uploadInput = document.getElementById('photo-upload');
            if (uploadBtn && uploadInput) {
                uploadBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    uploadInput.click();
                });
                uploadInput.addEventListener('change', (e) => this.handleUpload(e));
            }

            // 按鈕 hover 效果
            const buttons = this.container.querySelectorAll('button');
            buttons.forEach(btn => {
                btn.addEventListener('mouseover', () => {
                    if (btn.id === 'upload-btn') {
                        btn.style.background = 'rgba(212,175,55,0.1)';
                    } else if (btn.classList.contains('view-mode-btn') && !btn.classList.contains('active')) {
                        btn.style.background = 'rgba(255,255,255,0.1)';
                    }
                });
                btn.addEventListener('mouseout', () => {
                    if (btn.id === 'upload-btn') {
                        btn.style.background = 'rgba(212,175,55,0.05)';
                    } else if (btn.classList.contains('view-mode-btn') && !btn.classList.contains('active')) {
                        btn.style.background = 'rgba(255,255,255,0.05)';
                    }
                });
            });
        }

        setViewMode(mode) {
            if (mode >= 0 && mode < CONFIG.viewModes.length) {
                this.currentViewMode = mode;
                
                // 更新按鈕樣式
                const viewModeBtns = this.container.querySelectorAll('.view-mode-btn');
                viewModeBtns.forEach((btn, index) => {
                    if (index === mode) {
                        btn.classList.add('active');
                        btn.style.border = '1px solid rgba(212,175,55,0.5)';
                        btn.style.background = 'rgba(212,175,55,0.15)';
                        btn.style.color = 'rgba(212,175,55,1)';
                    } else {
                        btn.classList.remove('active');
                        btn.style.border = '1px solid rgba(255,255,255,0.2)';
                        btn.style.background = 'rgba(255,255,255,0.05)';
                        btn.style.color = 'rgba(255,255,255,0.6)';
                    }
                });
                
                this.render();
            }
        }

        prevModel() {
            this.uploadedImage = null;
            this.uploadedClavicleY = null;
            this.currentModelIndex = (this.currentModelIndex - 1 + CONFIG.models.length) % CONFIG.models.length;
            this.updateIndicator();
            this.render();
        }

        nextModel() {
            this.uploadedImage = null;
            this.uploadedClavicleY = null;
            this.currentModelIndex = (this.currentModelIndex + 1) % CONFIG.models.length;
            this.updateIndicator();
            this.render();
        }

        updateIndicator() {
            const indicator = document.getElementById('model-indicator');
            if (indicator) {
                indicator.textContent = `${this.currentModelIndex + 1}/${CONFIG.models.length}`;
            }
        }

        handleUpload(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    this.uploadedImage = img;
                    // 嘗試自動檢測鎖骨位置（簡單方法：圖片上半部分）
                    // 對於更精確的檢測，可以讓用戶點擊標記鎖骨位置
                    this.uploadedClavicleY = 0.22; // 預設值，可以改進
                    console.log('✅ 照片上傳成功，鎖骨位置設為:', this.uploadedClavicleY);
                    this.render();
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        }

        async captureJewelry() {
            console.log('📸 開始捕獲飾品圖片...');
            
            // 方法1: 從 window.renderer 獲取（優先）
            if (window.renderer && window.renderer.domElement) {
                try {
                    console.log('✅ 找到 window.renderer，嘗試捕獲...');
                    
                    // 確保場景已渲染
                    if (window.scene && window.camera) {
                        console.log('🔄 強制重新渲染場景...');
                        window.renderer.render(window.scene, window.camera);
                        console.log('✅ 場景已重新渲染');
                    } else {
                        console.warn('⚠️ window.scene 或 window.camera 不存在');
                    }
                    
                    // 等待渲染完成
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    const dataURL = window.renderer.domElement.toDataURL('image/png');
                    if (dataURL && dataURL !== 'data:,') {
                        return new Promise((resolve, reject) => {
                            const img = new Image();
                            img.onload = () => {
                                console.log('✅ 成功從 window.renderer 捕獲飾品，尺寸:', img.width, 'x', img.height);
                                resolve(img);
                            };
                            img.onerror = () => {
                                console.warn('⚠️ 圖片載入失敗');
                                reject(null);
                            };
                            img.src = dataURL;
                        });
                    } else {
                        console.warn('⚠️ dataURL 為空或無效');
                    }
                } catch (e) {
                    console.warn('⚠️ 無法從 window.renderer 獲取圖片:', e);
                }
            } else {
                console.warn('⚠️ window.renderer 不存在');
            }
            
            // 方法2: 從 viewport canvas 獲取（備用）
            const viewportCanvas = document.querySelector('#viewport canvas');
            if (viewportCanvas) {
                try {
                    console.log('✅ 找到 viewport canvas，嘗試捕獲...');
                    const dataURL = viewportCanvas.toDataURL('image/png');
                    if (dataURL && dataURL !== 'data:,') {
                        return new Promise((resolve, reject) => {
                            const img = new Image();
                            img.onload = () => {
                                console.log('✅ 成功從 viewport canvas 捕獲飾品，尺寸:', img.width, 'x', img.height);
                                resolve(img);
                            };
                            img.onerror = () => {
                                console.warn('⚠️ 圖片載入失敗');
                                reject(null);
                            };
                            img.src = dataURL;
                        });
                    }
                } catch (e) {
                    console.warn('⚠️ 無法從 viewport canvas 獲取圖片:', e);
                }
            }
            
            console.warn('⚠️ 無法找到可用的 renderer 或 canvas');
            return null;
        }

        getClaviclePosition() {
            // 獲取當前使用的鎖骨位置
            if (this.uploadedImage && this.uploadedClavicleY !== null) {
                return this.uploadedClavicleY;
            }
            const model = CONFIG.models[this.currentModelIndex];
            return model.clavicleY || model.neckY;
        }

        async render() {
            if (!this.ctx || !this.canvas) {
                console.warn('⚠️ Canvas 未準備好，跳過渲染');
                return;
            }

            const ctx = this.ctx;
            const canvas = this.canvas;
            const w = canvas.width;
            const h = canvas.height;

            if (w === 0 || h === 0) {
                console.warn('⚠️ Canvas 尺寸為 0，跳過渲染');
                return;
            }

            ctx.clearRect(0, 0, w, h);

            // 獲取當前視角模式
            const viewMode = CONFIG.viewModes[this.currentViewMode];
            const zoom = viewMode.zoom;
            const focusY = viewMode.focusY;
            const pendantSize = viewMode.pendantSize;
            const chainOffset = viewMode.chainOffset;

            // 繪製背景（根據視角模式調整顯示區域和裁剪）
            const bg = this.uploadedImage || this.modelImages[this.currentModelIndex];
            if (bg && bg.width && bg.height) {
                const imgAspect = bg.width / bg.height;
                const canvasAspect = w / h;
                
                let drawW, drawH, drawX, drawY;
                
                // 計算裁剪區域：
                // zoom = 1.0: 不裁剪，完整顯示（半身照）
                // zoom > 1.0: 放大裁剪，以 focusY 為中心
                
                if (imgAspect > canvasAspect) {
                    // 圖片較寬，以高度為準
                    if (zoom === 1.0) {
                        // 半身照：完整顯示，高度填滿
                        drawH = h;
                        drawW = drawH * imgAspect;
                        drawX = (w - drawW) / 2;
                        drawY = 0;
                    } else {
                        // 鎖骨/特寫：放大裁剪
                        drawH = h * zoom;
                        drawW = drawH * imgAspect;
                        drawX = (w - drawW) / 2;
                        // 以 focusY 為中心裁剪
                        const focusPixelY = bg.height * focusY;
                        const cropStartY = focusPixelY - (h / 2 / zoom);
                        drawY = -cropStartY * (h / bg.height) * zoom;
                    }
                } else {
                    // 圖片較高，以寬度為準
                    if (zoom === 1.0) {
                        // 半身照：完整顯示，寬度填滿
                        drawW = w;
                        drawH = drawW / imgAspect;
                        drawX = 0;
                        drawY = (h - drawH) / 2;
                    } else {
                        // 鎖骨/特寫：放大裁剪
                        drawW = w * zoom;
                        drawH = drawW / imgAspect;
                        drawX = (w - drawW) / 2;
                        // 以 focusY 為中心裁剪
                        const focusPixelY = bg.height * focusY;
                        const cropStartY = focusPixelY - (h / 2 / zoom);
                        drawY = -cropStartY * (w / bg.width) * zoom;
                    }
                }
                
                // 繪製裁剪後的圖片
                ctx.save();
                ctx.beginPath();
                ctx.rect(0, 0, w, h);
                ctx.clip();
                ctx.drawImage(bg, drawX, drawY, drawW, drawH);
                ctx.restore();
            } else {
                console.log('ℹ️ 背景圖片尚未載入，等待中...');
            }

            // 繪製珠寶
            const pendant = await this.captureJewelry();
            if (pendant) {
                console.log('✅ 開始繪製墜飾和鏈條...');
                
                // 確保背景圖片已載入（需要用於計算坐標）
                if (!bg || !bg.width || !bg.height) {
                    console.warn('⚠️ 背景圖片尚未載入，無法計算墜飾位置');
                    return;
                }
                
                const model = this.uploadedImage ? 
                    { clavicleY: this.uploadedClavicleY || 0.22 } :
                    CONFIG.models[this.currentModelIndex];
                
                // 獲取鎖骨位置（在原始圖片中的位置）
                const clavicleY = this.getClaviclePosition();
                
                // 計算墜飾位置（考慮裁剪後的坐標）
                // 鎖骨在原始圖片中的 Y 位置需要轉換到裁剪後的坐標
                let pendantY, clavicleYOnCanvas;
                
                if (zoom === 1.0) {
                    // 半身照：不裁剪，直接使用原始比例
                    clavicleYOnCanvas = h * clavicleY;
                    pendantY = h * (clavicleY + chainOffset);
                } else {
                    // 鎖骨/特寫：需要考慮裁剪偏移
                    const focusPixelY = bg.height * focusY;
                    const cropStartY = focusPixelY - (h / 2 / zoom);
                    const claviclePixelY = bg.height * clavicleY;
                    clavicleYOnCanvas = (claviclePixelY - cropStartY) * (h / bg.height) * zoom;
                    pendantY = clavicleYOnCanvas + (h * chainOffset / zoom);
                }
                
                const centerX = w * 0.5;

                // 繪製真實的項鍊鏈條
                // 項鍊應該從鎖骨兩側開始，形成 U 形，在墜飾位置匯合
                ctx.strokeStyle = CONFIG.chain.color;
                ctx.lineWidth = CONFIG.chain.width * Math.max(1.5, 2.5 / zoom); // 根據縮放調整線條粗細
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.shadowColor = 'rgba(0,0,0,0.3)';
                ctx.shadowBlur = 3;
                
                // 計算鏈條的寬度（鎖骨兩側的距離）
                const chainWidth = 35 * (1 / zoom); // 根據縮放調整
                const leftChainX = centerX - chainWidth;
                const rightChainX = centerX + chainWidth;
                
                // 左側鏈條：從左鎖骨到墜飾
                ctx.beginPath();
                ctx.moveTo(leftChainX, clavicleYOnCanvas);
                // 使用貝塞爾曲線形成自然的 U 形
                ctx.bezierCurveTo(
                    leftChainX + chainWidth * 0.3, clavicleYOnCanvas + (pendantY - clavicleYOnCanvas) * 0.3,
                    centerX - chainWidth * 0.2, pendantY - (pendantY - clavicleYOnCanvas) * 0.2,
                    centerX, pendantY
                );
                ctx.stroke();
                
                // 右側鏈條：從右鎖骨到墜飾
                ctx.beginPath();
                ctx.moveTo(rightChainX, clavicleYOnCanvas);
                ctx.bezierCurveTo(
                    rightChainX - chainWidth * 0.3, clavicleYOnCanvas + (pendantY - clavicleYOnCanvas) * 0.3,
                    centerX + chainWidth * 0.2, pendantY - (pendantY - clavicleYOnCanvas) * 0.2,
                    centerX, pendantY
                );
                ctx.stroke();
                
                // 繪製鎖骨上方的鏈條（連接左右兩側）
                ctx.beginPath();
                ctx.moveTo(leftChainX, clavicleYOnCanvas);
                ctx.quadraticCurveTo(
                    centerX, clavicleYOnCanvas - 8 * (1 / zoom), // 稍微向上形成弧度
                    rightChainX, clavicleYOnCanvas
                );
                ctx.stroke();

                // 繪製 3D 飾品截圖（根據視角模式調整大小）
                const size = pendantSize;
                const actualSize = Math.max(35, Math.min(120, size)); // 限制大小範圍
                
                console.log('📐 墜飾位置:', { 
                    x: centerX, 
                    y: pendantY, 
                    size: actualSize, 
                    viewMode: viewMode.name,
                    clavicleY: clavicleYOnCanvas,
                    zoom: zoom
                });
                
                ctx.save();
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 10;
                ctx.shadowOffsetX = 3;
                ctx.shadowOffsetY = 3;
                ctx.drawImage(pendant, centerX - actualSize / 2, pendantY, actualSize, actualSize);
                ctx.restore();
                
                console.log('✅ 墜飾和鏈條繪製完成');
            } else {
                console.log('ℹ️ 尚未有飾品可顯示，等待商品生成...');
                console.log('🔍 檢查 renderer 狀態:', {
                    hasRenderer: !!window.renderer,
                    hasScene: !!window.scene,
                    hasCamera: !!window.camera,
                    hasMainMesh: !!window.mainMesh
                });
            }
        }
    }

    // 初始化並掛載到 window 供外部按鈕呼叫
    function init() {
        console.log('🔍 開始初始化 WearingPreview...');
        const container = document.getElementById('wearing-preview-container');
        if (!container) {
            console.error('❌ 找不到 wearing-preview-container 元素');
            return;
        }
        console.log('✅ 找到 container，開始創建實例');
        window.wearingPreviewInstance = new WearingPreview('wearing-preview-container');
        if (window.wearingPreviewInstance) {
            console.log('✅ WearingPreview 實例創建成功');
        } else {
            console.error('❌ WearingPreview 實例創建失敗');
        }
    }

    // 確保在 DOM 完全載入後初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('📄 DOMContentLoaded 事件觸發，開始初始化 WearingPreview');
            setTimeout(init, 200);
        });
    } else {
        console.log('📄 DOM 已載入，延遲初始化 WearingPreview');
        setTimeout(init, 500);
    }
    
    // 備用初始化：如果上面的初始化失敗，1秒後再試一次
    setTimeout(() => {
        if (!window.wearingPreviewInstance) {
            console.warn('⚠️ 初次初始化可能失敗，嘗試備用初始化...');
            init();
        }
    }, 2000);

    // 保持與 index.html 的兼容性
    window.updateWearingPreview = () => {
        console.log('🔄 updateWearingPreview 被調用');
        if (window.wearingPreviewInstance) {
            window.wearingPreviewInstance.render();
        } else {
            console.warn('⚠️ wearingPreviewInstance 尚未初始化');
        }
    };

    // 監聽商品生成完成事件（如果有的話）
    const originalGenerateModel = window.generateModel;
    if (typeof originalGenerateModel === 'function') {
        window.generateModel = async function(...args) {
            const result = await originalGenerateModel.apply(this, args);
            // 商品生成完成後，更新佩戴模擬
            setTimeout(() => {
                console.log('🔄 商品生成完成，更新佩戴模擬');
                if (window.wearingPreviewInstance) {
                    window.wearingPreviewInstance.render();
                }
            }, 500);
            return result;
        };
    }
})();
