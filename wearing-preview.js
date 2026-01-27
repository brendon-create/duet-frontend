/**
 * DUET 佩戴模擬預覽模組
 * 版本: 3.0.0 - 精確座標系統
 */

(function() {
    'use strict';
    
    const CONFIG = {
        // 精確測量的 Model 數據
        models: [
            { 
                name: '女性 - 短髮',
                src: 'assets/models/model_f1.png',
                width: 587,
                height: 754,
                neckX: 0.50,      // 鎖骨中心 X（相對於照片寬度）
                neckY: 0.278,     // 鎖骨中心 Y（相對於照片高度）
                pendantY: 0.420,  // 墜子位置 Y
                shoulderWidth: 180 // 肩寬（像素）
            },
            { 
                name: '女性 - 中長髮',
                src: 'assets/models/model_f2.png',
                width: 587,
                height: 754,
                neckX: 0.50,
                neckY: 0.285,
                pendantY: 0.430,
                shoulderWidth: 175
            },
            { 
                name: '女性 - 長髮',
                src: 'assets/models/model_f3.png',
                width: 587,
                height: 754,
                neckX: 0.50,
                neckY: 0.272,
                pendantY: 0.415,
                shoulderWidth: 170
            },
            { 
                name: '男性 - 短髮',
                src: 'assets/models/model_m1.png',
                width: 485,
                height: 645,
                neckX: 0.50,
                neckY: 0.302,
                pendantY: 0.470,
                shoulderWidth: 200
            },
            { 
                name: '男性 - 中長髮',
                src: 'assets/models/model_m2.png',
                width: 494,
                height: 647,
                neckX: 0.50,
                neckY: 0.294,
                pendantY: 0.455,
                shoulderWidth: 195
            }
        ],
        chain: { 
            color: '#D4AF37', 
            width: 2.5 
        },
        // 真實尺寸（毫米）
        realSizes: {
            'S': 12,
            'M': 15,
            'L': 18
        },
        // 假設平均肩寬 40cm = 400mm
        avgShoulderWidthMM: 400,
        zoomLevels: [0.8, 1.0, 1.2, 1.5, 1.8]
    };
    
    class WearingPreview {
        constructor(containerId) {
            console.log('🎨 初始化佩戴預覽 v3.0');
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
            this.pendantImage = null;
            this.currentSize = 'M'; // 預設中號
            
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
            const promises = CONFIG.models.map((model, index) => {
                return new Promise(resolve => {
                    const img = new Image();
                    img.onload = () => {
                        console.log(`✅ 載入完成 [${index + 1}/5]: ${model.name} (${model.width}x${model.height})`);
                        resolve(img);
                    };
                    img.onerror = () => {
                        console.error(`❌ 載入失敗: ${model.name}`);
                        resolve(this.createPlaceholder(model.name, model.width, model.height));
                    };
                    img.src = model.src;
                });
            });
            this.modelImages = await Promise.all(promises);
        }
        
        createPlaceholder(name, width, height) {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            ctx.fillStyle = '#2a2a2a';
            ctx.fillRect(0, 0, width, height);
            
            ctx.fillStyle = '#666';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(name, width / 2, height / 2 - 10);
            ctx.fillText('載入中...', width / 2, height / 2 + 10);
            
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
        }
        
        prevModel() {
            this.currentModelIndex = (this.currentModelIndex - 1 + CONFIG.models.length) % CONFIG.models.length;
            this.updateIndicator();
            this.render();
        }
        
        nextModel() {
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
        
        startAutoUpdate() {
            setInterval(() => {
                this.capturePendant();
            }, 500);
        }
        
        async capturePendant() {
            if (!window.renderer || !window.scene || !window.camera) return;
            
            try {
                window.renderer.render(window.scene, window.camera);
                const dataURL = window.renderer.domElement.toDataURL('image/png');
                
                if (dataURL && dataURL.length > 100) {
                    const img = new Image();
                    img.onload = () => {
                        this.pendantImage = img;
                        this.render();
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
            const canvasW = canvas.width;
            const canvasH = canvas.height;
            
            ctx.clearRect(0, 0, canvasW, canvasH);
            
            const model = CONFIG.models[this.currentModelIndex];
            const modelImg = this.modelImages[this.currentModelIndex];
            
            if (!modelImg || !modelImg.width) return;
            
            const zoom = CONFIG.zoomLevels[this.currentZoom];
            
            // === 1. 計算照片在 Canvas 中的位置和尺寸 ===
            const scale = Math.max(canvasW / model.width, canvasH / model.height) * zoom;
            const scaledW = model.width * scale;
            const scaledH = model.height * scale;
            const imgX = (canvasW - scaledW) / 2;
            const imgY = (canvasH - scaledH) / 2;
            
            console.log('📐 照片位置:', {
                原始: `${model.width}x${model.height}`,
                縮放: zoom,
                縮放後: `${scaledW.toFixed(0)}x${scaledH.toFixed(0)}`,
                位置: `(${imgX.toFixed(0)}, ${imgY.toFixed(0)})`
            });
            
            // === 2. 繪製背景照片 ===
            ctx.drawImage(modelImg, imgX, imgY, scaledW, scaledH);
            
            // === 3. 計算項鍊位置（相對於照片） ===
            const neckX = imgX + (scaledW * model.neckX);
            const neckY = imgY + (scaledH * model.neckY);
            const pendantX = imgX + (scaledW * model.neckX);
            const pendantY = imgY + (scaledH * model.pendantY);
            
            console.log('📐 項鍊位置:', {
                鎖骨: `(${neckX.toFixed(0)}, ${neckY.toFixed(0)})`,
                墜子: `(${pendantX.toFixed(0)}, ${pendantY.toFixed(0)})`
            });
            
            // === 4. 繪製項鍊 ===
            if (this.pendantImage) {
                // 4a. 繪製鏈子
                ctx.strokeStyle = CONFIG.chain.color;
                ctx.lineWidth = CONFIG.chain.width;
                ctx.lineCap = 'round';
                ctx.shadowColor = 'rgba(0,0,0,0.3)';
                ctx.shadowBlur = 4;
                
                const chainWidthPx = 60 * (scaledW / model.width); // 鏈子寬度隨照片縮放
                
                // 左鏈
                ctx.beginPath();
                ctx.moveTo(neckX - chainWidthPx, neckY);
                ctx.bezierCurveTo(
                    neckX - chainWidthPx * 0.7, neckY + (pendantY - neckY) * 0.4,
                    pendantX - 20, pendantY - 20,
                    pendantX, pendantY
                );
                ctx.stroke();
                
                // 右鏈
                ctx.beginPath();
                ctx.moveTo(neckX + chainWidthPx, neckY);
                ctx.bezierCurveTo(
                    neckX + chainWidthPx * 0.7, neckY + (pendantY - neckY) * 0.4,
                    pendantX + 20, pendantY - 20,
                    pendantX, pendantY
                );
                ctx.stroke();
                
                ctx.shadowColor = 'transparent';
                
                // 4b. 繪製墜頭
                ctx.fillStyle = CONFIG.chain.color;
                ctx.beginPath();
                ctx.arc(pendantX, pendantY, 5, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.beginPath();
                ctx.moveTo(pendantX, pendantY - 5);
                ctx.bezierCurveTo(
                    pendantX - 5, pendantY,
                    pendantX - 5, pendantY + 8,
                    pendantX, pendantY + 12
                );
                ctx.bezierCurveTo(
                    pendantX + 5, pendantY + 8,
                    pendantX + 5, pendantY,
                    pendantX, pendantY - 5
                );
                ctx.fill();
                
                // 4c. 計算墜子尺寸（根據真實尺寸和照片比例）
                const realSizeMM = CONFIG.realSizes[this.currentSize];
                const pixelPerMM = model.shoulderWidth / CONFIG.avgShoulderWidthMM;
                const pendantSizeInPhoto = realSizeMM * pixelPerMM;
                const pendantSizeInCanvas = pendantSizeInPhoto * (scaledW / model.width);
                
                console.log('📐 墜子尺寸:', {
                    真實尺寸: `${realSizeMM}mm`,
                    照片中: `${pendantSizeInPhoto.toFixed(1)}px`,
                    Canvas中: `${pendantSizeInCanvas.toFixed(1)}px`
                });
                
                // 4d. 繪製墜子
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 10;
                ctx.shadowOffsetX = 3;
                ctx.shadowOffsetY = 3;
                
                ctx.drawImage(
                    this.pendantImage,
                    pendantX - pendantSizeInCanvas / 2,
                    pendantY + 12,
                    pendantSizeInCanvas,
                    pendantSizeInCanvas
                );
                
                ctx.shadowColor = 'transparent';
            }
        }
    }
    
    // === 全局初始化 ===
    window.WearingPreview = WearingPreview;
    
    function init() {
        console.log('🚀 初始化佩戴預覽系統');
        const container = document.getElementById('wearing-preview-container');
        if (container) {
            window.wearingPreviewInstance = new WearingPreview('wearing-preview-container');
        } else {
            console.error('❌ 找不到 wearing-preview-container');
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    setTimeout(init, 1000);
})();
