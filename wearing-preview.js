/**
 * DUET 佩戴模擬預覽模組
 * 修正說明：保留所有原有功能 (Zoom, 多模型切換)，僅優化圖片裁切與顯示比例
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

            this.canvas = document.createElement('canvas');
            this.ctx = this.canvas.getContext('2d');
            this.container.appendChild(this.canvas);

            this.currentModelIndex = 0;
            this.zoomIndex = 2; // 預設 1.0
            this.modelImage = new Image();
            this.modelImage.crossOrigin = "anonymous";

            this.init();
            window.addEventListener('resize', () => this.resize());
        }

        init() {
            this.resize();
            this.loadModel(0);
        }

        // 公開方法：切換模型 (保留您原本可能需要的外部呼叫)
        nextModel() {
            this.currentModelIndex = (this.currentModelIndex + 1) % CONFIG.models.length;
            this.loadModel(this.currentModelIndex);
        }

        // 公開方法：調整縮放 (保留您原本可能需要的外部呼叫)
        setZoom(index) {
            if (CONFIG.zoomLevels[index]) {
                this.zoomIndex = index;
                this.render();
            }
        }

        resize() {
            const rect = this.container.getBoundingClientRect();
            this.canvas.width = rect.width;
            this.canvas.height = rect.height;
            this.render();
        }

        loadModel(index) {
            this.currentModelIndex = index;
            // 確保圖片路徑正確，如果找不到會顯示 console 警告
            this.modelImage.src = CONFIG.models[index].src;
            this.modelImage.onload = () => this.render();
            this.modelImage.onerror = () => console.error("無法載入模特兒圖片:", CONFIG.models[index].src);
        }

        render() {
            if (!this.modelImage.complete || !this.ctx) return;

            const ctx = this.ctx;
            const canvas = this.canvas;
            const img = this.modelImage;
            const modelCfg = CONFIG.models[this.currentModelIndex];
            const zoom = CONFIG.zoomLevels[this.zoomIndex];

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // --- 核心修正：高度撐滿，左右裁切置中 ---
            const imgAspect = img.width / img.height;
            // 以畫布高度為準計算縮放後的寬度
            const drawH = canvas.height;
            const drawW = canvas.height * imgAspect;
            // 計算 X 偏移量使其水平置中
            const drawX = (canvas.width - drawW) / 2;
            const drawY = 0;

            // 繪製底圖
            ctx.drawImage(img, drawX, drawY, drawW, drawH);

            // 繪製飾品與項鍊
            this.drawSimulation(canvas.width / 2, canvas.height * modelCfg.pendantY, zoom);
        }

        drawSimulation(centerX, pendantY, zoom) {
            const ctx = this.ctx;
            const mainCanvas = document.querySelector('canvas:not(#wearing-preview-container canvas)');

            if (!mainCanvas) return;

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
            // 簡單的陰影效果讓飾品更立體
            ctx.shadowColor = 'rgba(0,0,0,0.3)';
            ctx.shadowBlur = 10;
            ctx.drawImage(mainCanvas, centerX - size / 2, pendantY, size, size);
            ctx.restore();
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
        if (window.wearingPreviewInstance) window.wearingPreviewInstance.render();
    };
})();