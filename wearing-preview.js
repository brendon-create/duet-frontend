/**
 * DUET 佩戴模擬預覽模組 V4.0
 * 改進：動態鏈條繪製、光影混合、3D 透視對齊
 */

(function () {
    'use strict';

    const CONFIG = {
        models: [
            {
                name: '優雅女性 - 鎖骨展示',
                src: 'https://images.unsplash.com/photo-1539109132381-3475517a630a?auto=format&fit=crop&q=80&w=800',
                width: 800,
                height: 1200,
                neckX: 0.505,      // 鎖骨中心
                neckY: 0.385,      // 頸部起點
                pendantY: 0.520,   // 墜子下垂位置
                skinTone: '#e8beac' // 用於鏈條陰影參考
            }
        ],
        chainColor: '#D4AF37', // 金色項鍊
        chainShadow: 'rgba(0,0,0,0.3)'
    };

    class WearingPreview {
        constructor(containerId) {
            this.container = document.getElementById(containerId);
            if (!this.container) return;

            this.canvas = document.createElement('canvas');
            this.ctx = this.canvas.getContext('2d');
            this.container.appendChild(this.canvas);

            this.currentModelIndex = 0;
            this.modelImage = new Image();
            this.pendantImage = null;

            this.init();
            window.addEventListener('resize', () => this.resize());
        }

        async init() {
            await this.loadModel(this.currentModelIndex);
            this.resize();
        }

        loadModel(index) {
            return new Promise((resolve) => {
                this.modelImage.src = CONFIG.models[index].src;
                this.modelImage.onload = () => {
                    this.render();
                    resolve();
                };
            });
        }

        /**
         * 從 Three.js 獲取當前墜子的截圖，確保透視一致
         */
        updatePendantFromCanvas(threeCanvas) {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = 256;
            tempCanvas.height = 256;
            const tCtx = tempCanvas.getContext('2d');

            // 裁切 Three.js 中央區域 (假設墜子在中央)
            tCtx.drawImage(threeCanvas,
                threeCanvas.width / 2 - 200, threeCanvas.height / 2 - 200, 400, 400,
                0, 0, 256, 256
            );

            this.pendantImage = tempCanvas;
            this.render();
        }

        resize() {
            const rect = this.container.getBoundingClientRect();
            this.canvas.width = rect.width;
            this.canvas.height = rect.height;
            this.render();
        }

        drawChain(ctx, startX, startY, endX, endY, pendantX, pendantY) {
            ctx.beginPath();
            ctx.strokeStyle = CONFIG.chainColor;
            ctx.lineWidth = 1.5;
            ctx.lineCap = 'round';

            // 繪製左側鏈條（使用二次貝茲曲線模擬重力）
            ctx.moveTo(startX - 60, startY - 20); // 左側肩膀位置
            ctx.quadraticCurveTo(startX - 40, pendantY - 10, pendantX, pendantY);

            // 繪製右側鏈條
            ctx.moveTo(startX + 60, startY - 20); // 右側肩膀位置
            ctx.quadraticCurveTo(startX + 40, pendantY - 10, pendantX, pendantY);

            // 增加鏈條金屬感
            ctx.stroke();

            // 增加細微的高光
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.setLineDash([2, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        render() {
            if (!this.modelImage.complete) return;

            const ctx = this.ctx;
            const canvas = this.canvas;
            const model = CONFIG.models[this.currentModelIndex];

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 1. 繪製模特兒
            const scale = Math.max(canvas.width / model.width, canvas.height / model.height);
            const w = model.width * scale;
            const h = model.height * scale;
            const x = (canvas.width - w) / 2;
            const y = (canvas.height - h) / 2;

            ctx.drawImage(this.modelImage, x, y, w, h);

            // 2. 計算精確座標
            const neckX = x + (model.neckX * w);
            const neckY = y + (model.neckY * h);
            const pendantY = y + (model.pendantY * h);

            // 3. 繪製項鍊鏈條
            this.drawChain(ctx, neckX, neckY, neckX, neckY, neckX, pendantY);

            // 4. 繪製墜子
            if (this.pendantImage) {
                const pSize = 60 * scale; // 根據縮放調整墜子大小

                // 墜子陰影 (Ambient Occlusion 風格)
                ctx.save();
                ctx.shadowColor = 'rgba(0,0,0,0.4)';
                ctx.shadowBlur = 15;
                ctx.shadowOffsetY = 10;

                // 繪製墜子本體
                ctx.drawImage(
                    this.pendantImage,
                    neckX - pSize / 2,
                    pendantY - pSize / 2,
                    pSize,
                    pSize
                );
                ctx.restore();

                // 5. 增加環境遮擋 (讓墜子邊緣與皮膚融合)
                ctx.globalCompositeOperation = 'multiply';
                ctx.fillStyle = 'rgba(0,0,0,0.1)';
                ctx.beginPath();
                ctx.arc(neckX, pendantY, pSize / 2.2, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalCompositeOperation = 'source-over';
            }
        }
    }

    window.WearingPreview = WearingPreview;
})();