/**
 * DUET 佩戴模擬預覽模組
 * 版本: 2.0.0 (簡潔優雅版)
 */

(function() {
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
            this.currentZoom = 2; // 中等縮放
            this.modelImages = [];
            this.uploadedImage = null;
            
            this.init();
        }
        
        async init() {
            await this.preloadModels();
            this.createUI();
            this.setupEventListeners();
            await this.render();
        }
        
        async preloadModels() {
            const promises = CONFIG.models.map(model => {
                return new Promise(resolve => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = () => resolve(this.createPlaceholder(model.name));
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
            this.container.innerHTML = `
                <div style="
                    margin: 40px auto;
                    max-width: 600px;
                    position: relative;
                ">
                    <!-- 主預覽區 -->
                    <div style="
                        position: relative;
                        border-radius: 16px;
                        overflow: hidden;
                        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                    ">
                        <canvas id="wearing-canvas" 
                            width="600" 
                            height="800"
                            style="
                                width: 100%;
                                display: block;
                                background: #1a1a1a;
                            "></canvas>
                        
                        <!-- 標題 -->
                        <div style="
                            position: absolute;
                            top: 20px;
                            left: 20px;
                            background: rgba(0,0,0,0.5);
                            backdrop-filter: blur(10px);
                            padding: 8px 16px;
                            border-radius: 20px;
                            color: #D4AF37;
                            font-size: 14px;
                            font-weight: 500;
                        ">
                            💍 佩戴效果預覽
                        </div>
                    </div>
                    
                    <!-- 控制列 -->
                    <div style="
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        margin-top: 16px;
                        padding: 0 8px;
                    ">
                        <!-- 左：Model 切換 -->
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <button id="prev-model" style="
                                width: 36px;
                                height: 36px;
                                border-radius: 50%;
                                border: 1px solid rgba(255,255,255,0.2);
                                background: rgba(255,255,255,0.05);
                                color: rgba(255,255,255,0.8);
                                cursor: pointer;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                transition: all 0.3s;
                                font-size: 18px;
                            " onmouseover="this.style.background='rgba(255,255,255,0.1)'"
                               onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                                ◀
                            </button>
                            <span id="model-indicator" style="
                                color: rgba(255,255,255,0.6);
                                font-size: 13px;
                                min-width: 40px;
                                text-align: center;
                            ">1/5</span>
                            <button id="next-model" style="
                                width: 36px;
                                height: 36px;
                                border-radius: 50%;
                                border: 1px solid rgba(255,255,255,0.2);
                                background: rgba(255,255,255,0.05);
                                color: rgba(255,255,255,0.8);
                                cursor: pointer;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                transition: all 0.3s;
                                font-size: 18px;
                            " onmouseover="this.style.background='rgba(255,255,255,0.1)'"
                               onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                                ▶
                            </button>
                        </div>
                        
                        <!-- 中：上傳按鈕 -->
                        <button id="upload-btn" style="
                            padding: 8px 16px;
                            border-radius: 20px;
                            border: 1px solid rgba(212,175,55,0.3);
                            background: rgba(212,175,55,0.05);
                            color: rgba(212,175,55,0.8);
                            cursor: pointer;
                            font-size: 12px;
                            transition: all 0.3s;
                        " onmouseover="this.style.background='rgba(212,175,55,0.1)'"
                           onmouseout="this.style.background='rgba(212,175,55,0.05)'">
                            📷 上傳照片
                        </button>
                        <input type="file" id="photo-upload" accept="image/*" style="display:none;">
                        
                        <!-- 右：縮放控制 -->
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <button id="zoom-out" style="
                                width: 36px;
                                height: 36px;
                                border-radius: 50%;
                                border: 1px solid rgba(255,255,255,0.2);
                                background: rgba(255,255,255,0.05);
                                color: rgba(255,255,255,0.8);
                                cursor: pointer;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                transition: all 0.3s;
                                font-size: 20px;
                            " onmouseover="this.style.background='rgba(255,255,255,0.1)'"
                               onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                                🔍−
                            </button>
                            <button id="zoom-in" style="
                                width: 36px;
                                height: 36px;
                                border-radius: 50%;
                                border: 1px solid rgba(255,255,255,0.2);
                                background: rgba(255,255,255,0.05);
                                color: rgba(255,255,255,0.8);
                                cursor: pointer;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                transition: all 0.3s;
                                font-size: 20px;
                            " onmouseover="this.style.background='rgba(255,255,255,0.1)'"
                               onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                                🔍+
                            </button>
                        </div>
                    </div>
                    
                    <!-- 提示 -->
                    <p style="
                        text-align: center;
                        color: rgba(255,255,255,0.4);
                        font-size: 11px;
                        margin-top: 12px;
                    ">
                        預覽效果僅供參考，實際尺寸可能因個人體型而異
                    </p>
                </div>
            `;
            
            this.canvas = document.getElementById('wearing-canvas');
            this.ctx = this.canvas.getContext('2d');
        }
        
        setupEventListeners() {
            // Model 切換
            document.getElementById('prev-model').onclick = () => this.prevModel();
            document.getElementById('next-model').onclick = () => this.nextModel();
            
            // 縮放
            document.getElementById('zoom-in').onclick = () => this.zoomIn();
            document.getElementById('zoom-out').onclick = () => this.zoomOut();
            
            // 上傳
            const uploadBtn = document.getElementById('upload-btn');
            const uploadInput = document.getElementById('photo-upload');
            uploadBtn.onclick = () => uploadInput.click();
            uploadInput.onchange = (e) => this.handleUpload(e);
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
                const scale = Math.max(w / bg.width, h / bg.height);
                const scaledW = bg.width * scale;
                const scaledH = bg.height * scale;
                const x = (w - scaledW) / 2;
                const y = (h - scaledH) / 2;
                ctx.drawImage(bg, x, y, scaledW, scaledH);
            }
            
            // 繪製珠寶
            const pendant = await this.captureJewelry();
            if (pendant) {
                const model = CONFIG.models[this.currentModelIndex];
                const zoom = CONFIG.zoomLevels[this.currentZoom];
                
                const neckY = h * model.neckY;
                const pendantY = h * model.pendantY;
                const centerX = w * 0.5;
                
                // 鏈子
                ctx.strokeStyle = CONFIG.chain.color;
                ctx.lineWidth = CONFIG.chain.width;
                ctx.beginPath();
                ctx.moveTo(centerX, neckY);
                ctx.bezierCurveTo(
                    centerX, neckY + 50,
                    centerX, pendantY - 30,
                    centerX, pendantY
                );
                ctx.stroke();
                
                // 墜頭
                ctx.fillStyle = CONFIG.chain.color;
                ctx.beginPath();
                ctx.arc(centerX, pendantY - 10, 5, 0, Math.PI * 2);
                ctx.fill();
                
                // 水滴形墜頭
                ctx.beginPath();
                ctx.moveTo(centerX, pendantY - 5);
                ctx.bezierCurveTo(centerX - 5, pendantY, centerX - 5, pendantY + 10, centerX, pendantY + 15);
                ctx.bezierCurveTo(centerX + 5, pendantY + 10, centerX + 5, pendantY, centerX, pendantY - 5);
                ctx.fill();
                
                // 珠寶
                const size = 100 * zoom;
                ctx.drawImage(pendant, centerX - size/2, pendantY + 15, size, size);
            }
        }
    }
    
    window.WearingPreview = WearingPreview;
    window.updateWearingPreview = () => window.wearingPreviewInstance?.render();
    
    function init() {
        const container = document.getElementById('wearing-preview-container');
        if (container) {
            window.wearingPreviewInstance = new WearingPreview('wearing-preview-container');
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    setTimeout(() => {
        if (!window.wearingPreviewInstance) init();
    }, 1000);
})();
