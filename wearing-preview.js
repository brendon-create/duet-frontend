/**
 * DUET 佩戴模擬預覽模組
 * 版本: 1.0.0
 * 功能: 將客製化珠寶合成到 Model 照片上，模擬佩戴效果
 */

(function() {
    'use strict';
    
    // ========== 配置 ==========
    const CONFIG = {
        // Model 照片路徑（目前 5 張，第 6 張待補）
        models: [
            { id: 'f1', name: '女性 - 短髮', src: 'assets/models/model_f1.png', neckY: 0.15, pendantY: 0.35 },
            { id: 'f2', name: '女性 - 中長髮', src: 'assets/models/model_f2.png', neckY: 0.15, pendantY: 0.35 },
            { id: 'f3', name: '女性 - 長髮', src: 'assets/models/model_f3.png', neckY: 0.15, pendantY: 0.35 },
            { id: 'm1', name: '男性 - 短髮', src: 'assets/models/model_m1.png', neckY: 0.15, pendantY: 0.35 },
            { id: 'm2', name: '男性 - 中長髮', src: 'assets/models/model_m2.png', neckY: 0.15, pendantY: 0.35 }
        ],
        
        chain: { color: '#D4AF37', width: 1.5 },
        bail: { width: 8, height: 12 },
        zoomLevels: {
            halfBody: { scale: 0.4, label: '半身照', cropY: 0 },
            bust: { scale: 0.7, label: '胸口照', cropY: 0.2 },
            closeUp: { scale: 1.0, label: '作品特寫', cropY: 0.3 }
        }
    };
    
    class WearingPreview {
        constructor(containerId) {
            this.container = document.getElementById(containerId);
            if (!this.container) return;
            
            this.canvas = null;
            this.ctx = null;
            this.currentModelIndex = 0;
            this.currentZoom = 'bust';
            this.pendantImage = null;
            this.modelImages = [];
            this.uploadedImage = null;
            
            this.init();
        }
        
        async init() {
            console.log('🎨 初始化佩戴模擬預覽...');
            await this.preloadModels();
            this.createUI();
            this.setupEventListeners();
            await this.render();
        }
        
        async preloadModels() {
            const promises = CONFIG.models.map(model => {
                return new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = () => {
                        // 如果載入失敗，創建佔位圖
                        const placeholder = this.createPlaceholder(model.name);
                        resolve(placeholder);
                    };
                    img.src = model.src;
                });
            });
            
            this.modelImages = await Promise.all(promises);
        }
        
        createPlaceholder(name) {
            const canvas = document.createElement('canvas');
            canvas.width = 400;
            canvas.height = 600;
            const ctx = canvas.getContext('2d');
            
            // 背景
            ctx.fillStyle = '#2a2a2a';
            ctx.fillRect(0, 0, 400, 600);
            
            // 文字
            ctx.fillStyle = '#888';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(name, 200, 300);
            ctx.fillText('(佔位圖)', 200, 320);
            
            // 轉換為 Image
            const img = new Image();
            img.src = canvas.toDataURL();
            return img;
        }
        
        createUI() {
            this.container.innerHTML = `
                <div style="margin:30px 0; background:rgba(255,255,255,0.02); border-radius:20px; padding:30px; border:1px solid rgba(255,255,255,0.1);">
                    <h3 style="text-align:center; color:#D4AF37; margin-bottom:20px;">💍 佩戴效果預覽</h3>
                    
                    <div style="display:flex; gap:30px;">
                        <div style="flex:1;">
                            <canvas id="wearing-canvas" width="400" height="600" style="width:100%; max-width:400px; border-radius:12px; box-shadow:0 4px 20px rgba(0,0,0,0.3); display:block; margin:0 auto;"></canvas>
                        </div>
                        
                        <div style="flex:0 0 280px; display:flex; flex-direction:column; gap:20px;">
                            <div>
                                <h4 style="color:rgba(255,255,255,0.8); margin-bottom:12px; font-size:14px;">選擇 Model</h4>
                                <div id="model-selector" style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px;"></div>
                            </div>
                            
                            <button id="upload-btn" style="width:100%; padding:12px; background:rgba(212,175,55,0.1); border:2px dashed #D4AF37; border-radius:8px; color:#D4AF37; cursor:pointer;">
                                📤 上傳照片
                            </button>
                            <input type="file" id="photo-upload" accept="image/*" style="display:none;">
                            
                            <div>
                                <h4 style="color:rgba(255,255,255,0.8); margin-bottom:12px; font-size:14px;">檢視模式</h4>
                                <div id="zoom-selector" style="display:flex; flex-direction:column; gap:8px;"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            this.canvas = document.getElementById('wearing-canvas');
            this.ctx = this.canvas.getContext('2d');
            
            this.createModelSelector();
            this.createZoomSelector();
        }
        
        createModelSelector() {
            const selector = document.getElementById('model-selector');
            CONFIG.models.forEach((model, i) => {
                const btn = document.createElement('button');
                btn.innerHTML = `<div style="aspect-ratio:2/3; background:#333; border-radius:6px; border:2px solid ${i===0?'#D4AF37':'rgba(255,255,255,0.1)'}; cursor:pointer;"></div>
                <div style="font-size:10px; color:rgba(255,255,255,0.6); margin-top:4px; text-align:center;">${model.name}</div>`;
                btn.onclick = () => this.selectModel(i);
                selector.appendChild(btn);
            });
        }
        
        createZoomSelector() {
            const selector = document.getElementById('zoom-selector');
            Object.entries(CONFIG.zoomLevels).forEach(([key, cfg]) => {
                const btn = document.createElement('button');
                btn.textContent = cfg.label;
                btn.dataset.zoom = key;
                btn.style.cssText = `padding:10px; background:${key==='bust'?'#D4AF37':'rgba(255,255,255,0.05)'}; border:1px solid ${key==='bust'?'#D4AF37':'rgba(255,255,255,0.1)'}; border-radius:6px; color:${key==='bust'?'#000':'rgba(255,255,255,0.8)'}; cursor:pointer;`;
                btn.onclick = () => this.selectZoom(key);
                selector.appendChild(btn);
            });
        }
        
        setupEventListeners() {
            document.getElementById('upload-btn').onclick = () => document.getElementById('photo-upload').click();
            document.getElementById('photo-upload').onchange = (e) => this.handleUpload(e);
        }
        
        async selectModel(i) {
            this.currentModelIndex = i;
            this.uploadedImage = null;
            document.querySelectorAll('#model-selector button div').forEach((d, idx) => {
                d.style.borderColor = idx === i ? '#D4AF37' : 'rgba(255,255,255,0.1)';
            });
            await this.render();
        }
        
        async selectZoom(zoom) {
            this.currentZoom = zoom;
            document.querySelectorAll('#zoom-selector button').forEach(btn => {
                const isActive = btn.dataset.zoom === zoom;
                btn.style.background = isActive ? '#D4AF37' : 'rgba(255,255,255,0.05)';
                btn.style.color = isActive ? '#000' : 'rgba(255,255,255,0.8)';
            });
            await this.render();
        }
        
        handleUpload(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => { this.uploadedImage = img; this.render(); };
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
                console.error('珠寶導出失敗:', e);
                return null;
            }
        }
        
        async render() {
            const ctx = this.ctx;
            const canvas = this.canvas;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            const zoom = CONFIG.zoomLevels[this.currentZoom];
            const model = CONFIG.models[this.currentModelIndex];
            
            // 背景
            const bg = this.uploadedImage || this.modelImages[this.currentModelIndex];
            if (bg) {
                const cropY = bg.height * zoom.cropY;
                const cropH = bg.height * (1 - zoom.cropY);
                ctx.drawImage(bg, 0, cropY, bg.width, cropH, 0, 0, canvas.width, canvas.height);
            }
            
            // 珠寶
            this.pendantImage = await this.captureJewelry();
            if (this.pendantImage) {
                const neckY = canvas.height * ((model.neckY - zoom.cropY) / (1 - zoom.cropY));
                const pendantY = canvas.height * ((model.pendantY - zoom.cropY) / (1 - zoom.cropY));
                const centerX = canvas.width * 0.5;
                
                // 鏈子
                ctx.strokeStyle = CONFIG.chain.color;
                ctx.lineWidth = CONFIG.chain.width;
                ctx.beginPath();
                ctx.moveTo(centerX, neckY);
                ctx.bezierCurveTo(centerX, neckY + 30, centerX, pendantY - 20, centerX, pendantY);
                ctx.stroke();
                
                // 墜頭
                ctx.fillStyle = CONFIG.chain.color;
                ctx.beginPath();
                ctx.arc(centerX, pendantY - 8, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(centerX, pendantY - 4);
                ctx.bezierCurveTo(centerX - 4, pendantY, centerX - 4, pendantY + 8, centerX, pendantY + 12);
                ctx.bezierCurveTo(centerX + 4, pendantY + 8, centerX + 4, pendantY, centerX, pendantY - 4);
                ctx.fill();
                
                // 珠寶
                const size = 80 * zoom.scale;
                ctx.drawImage(this.pendantImage, centerX - size/2, pendantY + 10, size, size);
            }
        }
    }
    
    window.WearingPreview = WearingPreview;
    window.updateWearingPreview = () => window.wearingPreviewInstance?.render();
    
    document.addEventListener('DOMContentLoaded', () => {
        const c = document.getElementById('wearing-preview-container');
        if (c) window.wearingPreviewInstance = new WearingPreview('wearing-preview-container');
    });
})();
