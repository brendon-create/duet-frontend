/**
 * DUET 佩戴模擬預覽模組
 * 完整版本：包含 UI 控制（模型切換、縮放、上傳照片）
 */

(function () {
    'use strict';

    const CONFIG = {
        models: [
            { name: '女性 - 短髮', src: 'assets/models/model_f1.png', neckY: 0.2, pendantY: 0.4 },
            { name: '女性 - 中長髮', src: 'assets/models/model_f2.png', neckY: 0.2, pendantY: 0.4 },
            { name: '女性 - 長髮', src: 'assets/models/model_f3.png', neckY: 0.2, pendantY: 0.4 },
            { name: '男性 - 短髮', src: 'assets/models/model_m1.png', neckY: 0.2, pendantY: 0.4 },
            { name: '男性 - 中長髮', src: 'assets/models/model_m2.png', neckY: 0.2, pendantY: 0.4 }
        ],
        chain: { color: '#D4AF37', width: 2 },
        zoomLevels: [0.6, 0.8, 1.0, 1.2, 1.5]
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
            this.currentZoom = 2; // 預設 1.0
            this.modelImages = [];
            this.uploadedImage = null;

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
                    // 即使圖片載入失敗，也嘗試渲染（使用佔位符）
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
                    bottom: 100px;
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
                    
                    <!-- 右：縮放控制 -->
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <button id="zoom-out" style="
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
                            font-size: 16px;
                            padding: 0;
                        ">−</button>
                        <button id="zoom-in" style="
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
                            font-size: 16px;
                            padding: 0;
                        ">+</button>
                    </div>
                </div>
            `;

            this.canvas = document.getElementById('wearing-canvas');
            this.ctx = this.canvas.getContext('2d');
            this.resize();
        }

        resize() {
            if (!this.canvas || !this.container) return;
            const rect = this.container.getBoundingClientRect();
            const previewArea = this.canvas.parentElement;
            if (previewArea) {
                const areaRect = previewArea.getBoundingClientRect();
                this.canvas.width = areaRect.width;
                this.canvas.height = areaRect.height;
            }
            this.render();
        }

        setupEventListeners() {
            // Model 切換
            const prevBtn = document.getElementById('prev-model');
            const nextBtn = document.getElementById('next-model');
            if (prevBtn) prevBtn.onclick = () => this.prevModel();
            if (nextBtn) nextBtn.onclick = () => this.nextModel();

            // 縮放
            const zoomInBtn = document.getElementById('zoom-in');
            const zoomOutBtn = document.getElementById('zoom-out');
            if (zoomInBtn) zoomInBtn.onclick = () => this.zoomIn();
            if (zoomOutBtn) zoomOutBtn.onclick = () => this.zoomOut();

            // 上傳
            const uploadBtn = document.getElementById('upload-btn');
            const uploadInput = document.getElementById('photo-upload');
            if (uploadBtn && uploadInput) {
                uploadBtn.onclick = () => uploadInput.click();
                uploadInput.onchange = (e) => this.handleUpload(e);
            }

            // 按鈕 hover 效果
            const buttons = this.container.querySelectorAll('button');
            buttons.forEach(btn => {
                btn.onmouseover = () => {
                    if (btn.id === 'upload-btn') {
                        btn.style.background = 'rgba(212,175,55,0.1)';
                    } else {
                        btn.style.background = 'rgba(255,255,255,0.1)';
                    }
                };
                btn.onmouseout = () => {
                    if (btn.id === 'upload-btn') {
                        btn.style.background = 'rgba(212,175,55,0.05)';
                    } else {
                        btn.style.background = 'rgba(255,255,255,0.05)';
                    }
                };
            });
        }

        prevModel() {
            this.uploadedImage = null;
            this.currentModelIndex = (this.currentModelIndex - 1 + CONFIG.models.length) % CONFIG.models.length;
            this.updateIndicator();
            this.render();
        }

        nextModel() {
            this.uploadedImage = null;
            this.currentModelIndex = (this.currentModelIndex + 1) % CONFIG.models.length;
            this.updateIndicator();
            this.render();
        }

        zoomIn() {
            if (this.currentZoom < CONFIG.zoomLevels.length - 1) {
                this.currentZoom++;
                this.render();
            }
        }

        zoomOut() {
            if (this.currentZoom > 0) {
                this.currentZoom--;
                this.render();
            }
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
                    this.render();
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        }

        async captureJewelry() {
            if (!window.renderer) return null;
            try {
                const dataURL = window.renderer.domElement.toDataURL('image/png');
                return new Promise(resolve => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.src = dataURL;
                });
            } catch (e) {
                return null;
            }
        }

        async render() {
            if (!this.ctx || !this.canvas) return;

            const ctx = this.ctx;
            const canvas = this.canvas;
            const w = canvas.width;
            const h = canvas.height;

            ctx.clearRect(0, 0, w, h);

            // 繪製背景（自動裁切居中）
            const bg = this.uploadedImage || this.modelImages[this.currentModelIndex];
            if (bg) {
                const imgAspect = bg.width / bg.height;
                const canvasAspect = w / h;
                
                let drawW, drawH, drawX, drawY;
                
                if (imgAspect > canvasAspect) {
                    // 圖片較寬，以高度為準
                    drawH = h;
                    drawW = h * imgAspect;
                    drawX = (w - drawW) / 2;
                    drawY = 0;
                } else {
                    // 圖片較高，以寬度為準
                    drawW = w;
                    drawH = w / imgAspect;
                    drawX = 0;
                    drawY = (h - drawH) / 2;
                }
                
                ctx.drawImage(bg, drawX, drawY, drawW, drawH);
            }

            // 繪製珠寶
            const pendant = await this.captureJewelry();
            if (pendant) {
                const model = CONFIG.models[this.currentModelIndex];
                const zoom = CONFIG.zoomLevels[this.currentZoom];

                const pendantY = h * model.pendantY;
                const centerX = w * 0.5;

                // 繪製項鍊線條
                ctx.strokeStyle = CONFIG.chain.color;
                ctx.lineWidth = CONFIG.chain.width;
                ctx.beginPath();
                ctx.moveTo(centerX - (40 * zoom), pendantY - (60 * zoom));
                ctx.quadraticCurveTo(centerX, pendantY + (10 * zoom), centerX + (40 * zoom), pendantY - (60 * zoom));
                ctx.stroke();

                // 繪製 3D 飾品截圖
                const size = 80 * zoom;
                ctx.save();
                ctx.shadowColor = 'rgba(0,0,0,0.3)';
                ctx.shadowBlur = 10;
                ctx.drawImage(pendant, centerX - size / 2, pendantY, size, size);
                ctx.restore();
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
            setTimeout(init, 200); // 稍微延遲以確保所有元素都已準備好
        });
    } else {
        // 如果 DOM 已經載入，稍微延遲以確保所有元素都已準備好
        console.log('📄 DOM 已載入，延遲初始化 WearingPreview');
        setTimeout(init, 500); // 給更多時間讓其他腳本完成
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
        if (window.wearingPreviewInstance) {
            window.wearingPreviewInstance.render();
        }
    };
})();
