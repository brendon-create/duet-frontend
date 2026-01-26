/**
 * DUET 佩戴模擬預覽模組
 * 版本: 2.2.0 - 修正座標計算
 */

(function() {
    'use strict';
    
    const CONFIG = {
        models: [
            { name: '女性 - 短髮', src: 'assets/models/model_f1.png' },
            { name: '女性 - 中長髮', src: 'assets/models/model_f2.png' },
            { name: '女性 - 長髮', src: 'assets/models/model_f3.png' },
            { name: '男性 - 短髮', src: 'assets/models/model_m1.png' },
            { name: '男性 - 中長髮', src: 'assets/models/model_m2.png' }
        ],
        chain: { 
            color: '#D4AF37', 
            width: 2.5 
        },
        // 這些是相對於 Canvas 高度的位置
        neckY: 0.15,      // 脖子底部（鎖骨）
        pendantY: 0.35,   // 墜子位置
        zoomLevels: [0.8, 1.0, 1.2, 1.5, 1.8]
    };
    
    class WearingPreview {
        constructor(containerId) {
            console.log('🎨 初始化 WearingPreview');
            this.container = document.getElementById(containerId);
            if (!this.container) {
                console.error('❌ 找不到容器');
                return;
            }
            
            this.canvas = null;
            this.ctx = null;
            this.currentModelIndex = 0;
            this.currentZoom = 1; // 預設 1.0x
            this.modelImages = [];
            this.uploadedImage = null;
            this.pendantImage = null;
            
            this.init();
        }
        
        async init() {
            await this.preloadModels();
            this.createUI();
            this.setupEventListeners();
            this.startAutoUpdate();
            await this.render();
        }
        
        async preloadModels() {
            console.log('📥 載入 Model 圖片');
            const promises = CONFIG.models.map(model => {
                return new Promise(resolve => {
                    const img = new Image();
                    img.onload = () => {
                        console.log('✅ 載入:', model.name);
                        resolve(img);
                    };
                    img.onerror = () => {
                        console.warn('⚠️ 載入失敗:', model.name);
                        resolve(this.createPlaceholder(model.name));
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
            
            ctx.fillStyle = '#2a2a2a';
            ctx.fillRect(0, 0, 400, 600);
            
            ctx.fillStyle = '#666';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(name, 200, 300);
            ctx.fillText('(照片載入中)', 200, 320);
            
            const img = new Image();
            img.src = canvas.toDataURL();
            return img;
        }
        
        createUI() {
            this.container.innerHTML = `
                <div style="width:100%; height:100%; display:flex; flex-direction:column; background:rgba(0,0,0,0.3); border-radius:24px; overflow:hidden;">
                    <div style="flex:1; position:relative;">
                        <canvas id="wearing-canvas" width="400" height="600" style="width:100%; height:100%; object-fit:cover;"></canvas>
                        <div style="position:absolute; top:16px; left:16px; background:rgba(0,0,0,0.6); backdrop-filter:blur(8px); padding:6px 12px; border-radius:16px; color:#D4AF37; font-size:12px;">💍 佩戴效果</div>
                    </div>
                    <div style="padding:12px 16px; background:rgba(0,0,0,0.4); display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; gap:8px; align-items:center;">
                            <button id="prev-model" style="width:32px; height:32px; border-radius:50%; border:1px solid rgba(255,255,255,0.2); background:rgba(255,255,255,0.05); color:#fff; cursor:pointer; font-size:14px;">◀</button>
                            <span id="model-indicator" style="color:rgba(255,255,255,0.6); font-size:11px; min-width:30px; text-align:center;">1/5</span>
                            <button id="next-model" style="width:32px; height:32px; border-radius:50%; border:1px solid rgba(255,255,255,0.2); background:rgba(255,255,255,0.05); color:#fff; cursor:pointer; font-size:14px;">▶</button>
                        </div>
                        <button id="upload-btn" style="padding:6px 12px; border-radius:16px; border:1px solid rgba(212,175,55,0.3); background:rgba(212,175,55,0.05); color:rgba(212,175,55,0.9); cursor:pointer; font-size:10px;">📷</button>
                        <input type="file" id="photo-upload" accept="image/*" style="display:none;">
                        <div style="display:flex; gap:6px;">
                            <button id="zoom-out" style="width:32px; height:32px; border-radius:50%; border:1px solid rgba(255,255,255,0.2); background:rgba(255,255,255,0.05); color:#fff; cursor:pointer; font-size:16px;">−</button>
                            <button id="zoom-in" style="width:32px; height:32px; border-radius:50%; border:1px solid rgba(255,255,255,0.2); background:rgba(255,255,255,0.05); color:#fff; cursor:pointer; font-size:16px;">+</button>
                        </div>
                    </div>
                </div>
            `;
            
            this.canvas = document.getElementById('wearing-canvas');
            this.ctx = this.canvas.getContext('2d');
        }
        
        setupEventListeners() {
            document.getElementById('prev-model').onclick = () => this.prevModel();
            document.getElementById('next-model').onclick = () => this.nextModel();
            document.getElementById('zoom-in').onclick = () => this.zoomIn();
            document.getElementById('zoom-out').onclick = () => this.zoomOut();
            
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
        
        startAutoUpdate() {
            // 每 0.5 秒檢查並更新珠寶圖片
            setInterval(() => {
                this.capturePendant();
            }, 500);
        }
        
        async capturePendant() {
            if (!window.renderer || !window.scene || !window.camera) {
                return;
            }
            
            try {
                // 強制渲染最新狀態
                window.renderer.render(window.scene, window.camera);
                
                const dataURL = window.renderer.domElement.toDataURL('image/png');
                
                if (dataURL && dataURL.length > 100) {
                    const img = new Image();
                    img.onload = () => {
                        const changed = !this.pendantImage || 
                                      this.pendantImage.src !== img.src;
                        
                        this.pendantImage = img;
                        
                        if (changed) {
                            this.render();
                        }
                    };
                    img.src = dataURL;
                }
            } catch (e) {
                // 靜默失敗
            }
        }
        
        async render() {
            if (!this.ctx || !this.canvas) return;
            
            const ctx = this.ctx;
            const canvas = this.canvas;
            const w = canvas.width;
            const h = canvas.height;
            
            // 清空畫布
            ctx.clearRect(0, 0, w, h);
            
            // === 1. 繪製背景 Model 照片 ===
            const bg = this.uploadedImage || this.modelImages[this.currentModelIndex];
            if (bg && bg.width && bg.height) {
                const zoom = CONFIG.zoomLevels[this.currentZoom];
                
                // 計算縮放比例（填滿整個 canvas）
                const scale = Math.max(w / bg.width, h / bg.height) * zoom;
                const scaledW = bg.width * scale;
                const scaledH = bg.height * scale;
                
                // 居中顯示
                const bgX = (w - scaledW) / 2;
                const bgY = (h - scaledH) / 2;
                
                ctx.drawImage(bg, bgX, bgY, scaledW, scaledH);
                
                console.log('📐 背景尺寸:', { 
                    原始: `${bg.width}x${bg.height}`,
                    縮放後: `${scaledW.toFixed(0)}x${scaledH.toFixed(0)}`,
                    位置: `(${bgX.toFixed(0)}, ${bgY.toFixed(0)})`
                });
            }
            
            // === 2. 繪製項鍊和墜子 ===
            if (this.pendantImage) {
                const zoom = CONFIG.zoomLevels[this.currentZoom];
                
                // 關鍵：這些座標是相對於 Canvas 的絕對位置
                const centerX = w * 0.5;
                const neckY = h * CONFIG.neckY;       // 鎖骨位置
                const pendantY = h * CONFIG.pendantY;  // 墜子位置
                
                console.log('📐 項鍊座標:', {
                    canvas尺寸: `${w}x${h}`,
                    中心X: centerX,
                    鎖骨Y: neckY,
                    墜子Y: pendantY,
                    縮放: zoom
                });
                
                // === 2a. 繪製鏈子 ===
                ctx.strokeStyle = CONFIG.chain.color;
                ctx.lineWidth = CONFIG.chain.width;
                ctx.lineCap = 'round';
                ctx.shadowColor = 'rgba(0,0,0,0.3)';
                ctx.shadowBlur = 4;
                
                const chainWidth = 60; // 鏈子兩側的距離
                
                // 左側鏈子
                ctx.beginPath();
                ctx.moveTo(centerX - chainWidth, neckY);
                ctx.bezierCurveTo(
                    centerX - chainWidth * 0.7, neckY + (pendantY - neckY) * 0.4,
                    centerX - 20, pendantY - 20,
                    centerX, pendantY
                );
                ctx.stroke();
                
                // 右側鏈子
                ctx.beginPath();
                ctx.moveTo(centerX + chainWidth, neckY);
                ctx.bezierCurveTo(
                    centerX + chainWidth * 0.7, neckY + (pendantY - neckY) * 0.4,
                    centerX + 20, pendantY - 20,
                    centerX, pendantY
                );
                ctx.stroke();
                
                ctx.shadowColor = 'transparent';
                
                // === 2b. 繪製墜頭 ===
                ctx.fillStyle = CONFIG.chain.color;
                ctx.beginPath();
                ctx.arc(centerX, pendantY, 5, 0, Math.PI * 2);
                ctx.fill();
                
                // 水滴形墜頭
                ctx.beginPath();
                ctx.moveTo(centerX, pendantY - 5);
                ctx.bezierCurveTo(
                    centerX - 5, pendantY,
                    centerX - 5, pendantY + 8,
                    centerX, pendantY + 12
                );
                ctx.bezierCurveTo(
                    centerX + 5, pendantY + 8,
                    centerX + 5, pendantY,
                    centerX, pendantY - 5
                );
                ctx.fill();
                
                // === 2c. 繪製珠寶主體 ===
                const pendantSize = 90 * zoom;
                const pendantX = centerX - pendantSize / 2;
                const pendantYPos = pendantY + 12; // 墜頭下方
                
                console.log('📐 珠寶位置:', {
                    尺寸: pendantSize,
                    X: pendantX,
                    Y: pendantYPos
                });
                
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 10;
                ctx.shadowOffsetX = 3;
                ctx.shadowOffsetY = 3;
                
                ctx.drawImage(
                    this.pendantImage,
                    pendantX,
                    pendantYPos,
                    pendantSize,
                    pendantSize
                );
                
                ctx.shadowColor = 'transparent';
            } else {
                // 沒有珠寶時顯示提示
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.font = '14px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('等待珠寶生成...', w / 2, h / 2);
            }
        }
    }
    
    // === 全局初始化 ===
    window.WearingPreview = WearingPreview;
    
    function init() {
        console.log('🚀 開始初始化佩戴預覽');
        const container = document.getElementById('wearing-preview-container');
        if (container) {
            console.log('✅ 找到容器，建立實例');
            window.wearingPreviewInstance = new WearingPreview('wearing-preview-container');
        } else {
            console.error('❌ 找不到 wearing-preview-container');
        }
    }
    
    // 多重初始化策略
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // 備援延遲初始化
    setTimeout(init, 1000);
})();
