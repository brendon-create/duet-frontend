/**
 * DUET 佩戴模擬預覽模組 V5.0
 * 核心：金屬質感渲染、三點座標連動、3D 透視對齊
 */

(function () {
    'use strict';

    const CONFIG = {
        // Model 定位數據：設定項鍊兩端 (left/right) 與 墜子頂端中心 (pendantCenter)
        models: [
            {
                name: '女性 - 優雅鎖骨',
                src: 'https://images.unsplash.com/photo-1539109132381-3475517a630a?auto=format&fit=crop&q=80&w=800',
                width: 800,
                height: 1200,
                points: {
                    leftAnchor: { x: 0.42, y: 0.35 },    // 項鍊左端起始點
                    rightAnchor: { x: 0.58, y: 0.35 },   // 項鍊右端起始點
                    pendantTop: { x: 0.505, y: 0.51 }    // 墜子頂端圓環中心
                }
            }
        ],
        jewelry: {
            gold: {
                base: '#D4AF37',
                highlight: '#FFF7D6',
                shadow: '#8A6D3B',
                width: 2.2
            }
        }
    };

    class WearingPreview {
        constructor(containerId) {
            this.container = document.getElementById(containerId);
            if (!this.container) return;

            this.canvas = document.createElement('canvas');
            this.ctx = this.canvas.getContext('2d', { alpha: true });
            this.container.appendChild(this.canvas);

            this.currentModelIndex = 0;
            this.modelImage = new Image();
            this.pendantImage = null; // 從 Three.js 傳入

            this.init();
        }

        async init() {
            await this.loadModel(this.currentModelIndex);
            this.resize();
            window.addEventListener('resize', () => this.resize());
        }

        loadModel(index) {
            return new Promise((resolve) => {
                this.modelImage.crossOrigin = "anonymous";
                this.modelImage.src = CONFIG.models[index].src;
                this.modelImage.onload = () => {
                    this.render();
                    resolve();
                };
            });
        }

        /**
         * 核心：從主畫面 Three.js 同步墜子視角
         * @param {HTMLCanvasElement} threeCanvas 
         */
        syncWithThreeJS(threeCanvas) {
            // 創建離屏 Canvas 進行裁切與縮放
            const cropCanvas = document.createElement('canvas');
            const size = 512;
            cropCanvas.width = size;
            cropCanvas.height = size;
            const cCtx = cropCanvas.getContext('2d');

            // 假設墜子在 Three.js 畫面正中心，裁切適當比例
            const sourceSize = Math.min(threeCanvas.width, threeCanvas.height) * 0.4;
            cCtx.drawImage(
                threeCanvas,
                (threeCanvas.width - sourceSize) / 2, (threeCanvas.height - sourceSize) / 2, sourceSize, sourceSize,
                0, 0, size, size
            );

            this.pendantImage = cropCanvas;
            this.render();
        }

        /**
         * 繪製具金屬質感的項鍊鏈條
         */
        drawMetalChain(ctx, p1, p2, pCenter, scale) {
            const config = CONFIG.jewelry.gold;
            const chainWidth = config.width * scale;

            // 創建金屬漸層
            const gradient = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
            gradient.addColorStop(0, config.shadow);
            gradient.addColorStop(0.3, config.base);
            gradient.addColorStop(0.5, config.highlight);
            gradient.addColorStop(0.7, config.base);
            gradient.addColorStop(1, config.shadow);

            ctx.save();

            // 1. 底層陰影 (Ambient Occlusion)
            ctx.beginPath();
            ctx.lineWidth = chainWidth + 1;
            ctx.strokeStyle = 'rgba(0,0,0,0.15)';
            ctx.setLineDash([]);
            this.traceChainPath(ctx, p1, p2, pCenter);
            ctx.stroke();

            // 2. 主鏈條
            ctx.beginPath();
            ctx.lineWidth = chainWidth;
            ctx.strokeStyle = gradient;
            this.traceChainPath(ctx, p1, p2, pCenter);
            ctx.stroke();

            // 3. 珠寶質感：模擬金屬結節高光
            ctx.beginPath();
            ctx.lineWidth = chainWidth * 0.4;
            ctx.strokeStyle = 'rgba(255,255,255,0.6)';
            ctx.setLineDash([2 * scale, 4 * scale]); // 模擬鏈條的一環一環
            this.traceChainPath(ctx, p1, p2, pCenter);
            ctx.stroke();

            ctx.restore();
        }

        traceChainPath(ctx, p1, p2, pCenter) {
            ctx.moveTo(p1.x, p1.y);
            // 使用控制點讓曲線更有重量下墜感 (U型)
            const cp1x = p1.x + (pCenter.x - p1.x) * 0.3;
            const cp1y = pCenter.y;
            const cp2x = p2.x - (p2.x - pCenter.x) * 0.3;
            const cp2y = pCenter.y;

            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
        }

        resize() {
            const rect = this.container.getBoundingClientRect();
            // 處理高解析度螢幕模糊問題
            const dpr = window.devicePixelRatio || 1;
            this.canvas.width = rect.width * dpr;
            this.canvas.height = rect.height * dpr;
            this.canvas.style.width = `${rect.width}px`;
            this.canvas.style.height = `${rect.height}px`;
            this.ctx.scale(dpr, dpr);
            this.render();
        }

        render() {
            if (!this.modelImage.complete) return;

            const ctx = this.ctx;
            const model = CONFIG.models[this.currentModelIndex];
            const canvasW = this.canvas.width / (window.devicePixelRatio || 1);
            const canvasH = this.canvas.height / (window.devicePixelRatio || 1);

            ctx.clearRect(0, 0, canvasW, canvasH);

            // 計算圖片縮放以填充容器 (Object-fit: cover)
            const scale = Math.max(canvasW / model.width, canvasH / model.height);
            const imgW = model.width * scale;
            const imgH = model.height * scale;
            const offsetX = (canvasW - imgW) / 2;
            const offsetY = (canvasH - imgH) / 2;

            // 1. 繪製模特兒
            ctx.drawImage(this.modelImage, offsetX, offsetY, imgW, imgH);

            // 2. 轉換座標點
            const toCanvas = (pt) => ({
                x: offsetX + (pt.x * imgW),
                y: offsetY + (pt.y * imgH)
            });

            const p1 = toCanvas(model.points.leftAnchor);
            const p2 = toCanvas(model.points.rightAnchor);
            const pTop = toCanvas(model.points.pendantTop);

            // 3. 繪製鏈條 (在墜子下方)
            this.drawMetalChain(ctx, p1, p2, pTop, scale);

            // 4. 繪製墜子
            if (this.pendantImage) {
                const pDisplaySize = 85 * scale; // 可根據實際尺寸調整

                ctx.save();
                // 陰影處理
                ctx.shadowColor = 'rgba(0,0,0,0.35)';
                ctx.shadowBlur = 12;
                ctx.shadowOffsetY = 8;

                // 繪製從 3D 抓取下來的墜子圖片
                ctx.drawImage(
                    this.pendantImage,
                    pTop.x - pDisplaySize / 2,
                    pTop.y - (pDisplaySize * 0.1), // 稍微向下偏移，讓圓環對準定位點
                    pDisplaySize,
                    pDisplaySize
                );
                ctx.restore();
            }
        }
    }

    window.WearingPreview = WearingPreview;
})();