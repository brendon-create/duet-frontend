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
            this.container = document.getElementById(containerId);
            if (!this.container) return;

            this.canvas = null;
            this.ctx = null;
            this.currentModelIndex = 0;
            this.currentZoom = 2; // 預設 1.0
            this.modelImages = [];
            this.uploadedImage = null;

            this.init();
        }

        async init() {
            await this.preloadModels();
            this.createUI();
            this.setupEventListeners();
            window.addEventListener('resize', () => this.resize());
            await this.render();
        }

        async preloadModels() {
            const promises = CONFIG.models.map(model => {
                return new Promise(resolve => {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.onload = () => resolve(img);
                    img.onerror = () => {
                        console.warn("無法載入模特兒圖片:", model.src);
                        resolve(this.createPlaceholder(model.name));
                    };
                    img.src = model.src;
                });
            });
            this.modelImages = await Promise.all(promises);
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
            // 保留原有的標題裝飾層，添加完整 UI
            const existingTitle = this.container.querySelector('div[style*="position: absolute"]');
            
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
        window.wearingPreviewInstance = new WearingPreview('wearing-preview-container');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 保持與 index.html 的兼容性
    window.updateWearingPreview = () => {
        if (window.wearingPreviewInstance) {
            window.wearingPreviewInstance.render();
        }
    };
})();
