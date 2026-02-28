/**
 * DUET 開發者功能管理器
 * 統一控制所有開發者功能的顯示/隱藏
 * 
 * 使用方式：
 * 1. URL 參數控制：?dev=true
 * 2. 或在程式碼中設定：DevFeatures.enabled = true
 */

const DevFeatures = {
    // 🔧 主開關（可被 URL 參數覆蓋）
    enabled: false,
    
    /**
     * 初始化（檢查 URL 參數）
     */
    init() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('dev') === 'true') {
            this.enabled = true;
            console.log('🔧 開發者模式已啟用（URL 參數）');
        } else if (this.enabled) {
            console.log('🔧 開發者模式已啟用（程式碼設定）');
        }
    },
    
    /**
     * 控制元素顯示/隱藏
     */
    toggleElement(elementId, show = this.enabled) {
        const element = document.getElementById(elementId);
        if (element) {
            element.style.display = show ? 'block' : 'none';
        }
    }
};

/**
 * DUET 產品攝影模組
 * 用於生成高品質的產品去背照片
 */

const ProductPhotoStudio = {
    // Three.js 引用（從外部傳入）
    scene: null,
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    mainMesh: null,
    bailMesh: null,
    gridHelper: null,
    axesHelper: null,
    
    // 當前設定
    settings: {
        background: 'transparent',
        scale: 2
    },
    
    /**
     * 初始化模組
     */
    init(scene, camera, renderer, controls) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.controls = controls;
        
        if (DevFeatures.enabled) {
            this.createUI();
            this.bindEvents();
            console.log('✅ 產品攝影模組已啟用');
        }
    },
    
    /**
     * 設定 mesh 引用（從外部更新）
     */
    setMeshes(mainMesh, bailMesh, gridHelper, axesHelper) {
        this.mainMesh = mainMesh;
        this.bailMesh = bailMesh;
        this.gridHelper = gridHelper;
        this.axesHelper = axesHelper;
    },
    
    /**
     * 創建 UI
     */
    createUI() {
        // 檢查是否已存在
        if (document.getElementById('photo-studio-panel')) return;
        
        // 創建面板（不創建觸發按鈕，改用整合在控制面板的按鈕）
        const panel = document.createElement('div');
        panel.id = 'photo-studio-panel';
        panel.className = 'photo-studio-panel';
        panel.innerHTML = `
            <div class="photo-studio-header">
                <h3>📸 產品攝影模式</h3>
                <button class="photo-close-btn" onclick="ProductPhotoStudio.close()">✕</button>
            </div>
            
            <div class="photo-studio-content">
                <!-- 背景選擇 -->
                <div class="photo-setting-group">
                    <label>背景：</label>
                    <div class="photo-radio-group">
                        <label><input type="radio" name="photo-bg" value="transparent" checked> 透明</label>
                        <label><input type="radio" name="photo-bg" value="white"> 純白</label>
                        <label><input type="radio" name="photo-bg" value="black"> 純黑</label>
                    </div>
                </div>
                
                <!-- 解析度選擇 -->
                <div class="photo-setting-group">
                    <label>解析度：</label>
                    <div class="photo-radio-group">
                        <label><input type="radio" name="photo-scale" value="1"> 1x</label>
                        <label><input type="radio" name="photo-scale" value="2" checked> 2x (推薦)</label>
                        <label><input type="radio" name="photo-scale" value="4"> 4x</label>
                    </div>
                </div>
                
                <!-- 預設角度 -->
                <div class="photo-setting-group">
                    <label>預設角度：</label>
                    <div class="photo-angle-buttons">
                        <button onclick="ProductPhotoStudio.captureAngle('front')">正面</button>
                        <button onclick="ProductPhotoStudio.captureAngle('side')">側面</button>
                        <button onclick="ProductPhotoStudio.captureAngle('top')">俯視</button>
                        <button onclick="ProductPhotoStudio.captureAngle('angle45')">45度</button>
                        <button onclick="ProductPhotoStudio.captureAngle('hero')">Hero Shot</button>
                    </div>
                </div>
                
                <!-- 當前視角 -->
                <div class="photo-setting-group">
                    <button class="photo-primary-btn" onclick="ProductPhotoStudio.captureCurrentView()">
                        📷 匯出當前視角
                    </button>
                </div>
                
                <!-- 批量匯出 -->
                <div class="photo-setting-group">
                    <button class="photo-secondary-btn" onclick="ProductPhotoStudio.captureAllAngles()">
                        📦 匯出所有角度 (5張)
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
    },
    
    /**
     * 綁定事件
     */
    bindEvents() {
        // 監聽設定變更
        document.addEventListener('change', (e) => {
            if (e.target.name === 'photo-bg') {
                this.settings.background = e.target.value;
            } else if (e.target.name === 'photo-scale') {
                this.settings.scale = parseInt(e.target.value);
            }
        });
    },
    
    /**
     * 打開面板
     */
    open() {
        const panel = document.getElementById('photo-studio-panel');
        if (panel) {
            panel.style.display = 'block';
        }
    },
    
    /**
     * 關閉面板
     */
    close() {
        const panel = document.getElementById('photo-studio-panel');
        if (panel) {
            panel.style.display = 'none';
        }
    },
    
    /**
     * 核心：匯出產品照片
     */
    exportProductPhoto(angle = 'current') {
        // 從 window 讀取（因為 design-studio 有暴露）
        const mainMesh = window.mainMesh || this.mainMesh;
        const bailMesh = window.bailMesh || this.bailMesh;
        
        if (!mainMesh) {
            this.showToast('請先生成作品');
            return;
        }
        
        // 儲存原始狀態
        const originalSize = this.renderer.getSize(new THREE.Vector2());
        const originalBg = this.scene.background;
        const originalCameraPos = this.camera.position.clone();
        const originalCameraRot = this.camera.rotation.clone();
        
        try {
            // 1. 提高解析度
            this.renderer.setSize(
                originalSize.x * this.settings.scale,
                originalSize.y * this.settings.scale
            );
            
            // 2. 設定背景
            if (this.settings.background === 'transparent') {
                this.scene.background = null;
            } else if (this.settings.background === 'white') {
                this.scene.background = new THREE.Color(0xffffff);
            } else if (this.settings.background === 'black') {
                this.scene.background = new THREE.Color(0x000000);
            }
            
            // 3. 隱藏輔助元素
            if (this.gridHelper) this.gridHelper.visible = false;
            if (this.axesHelper) this.axesHelper.visible = false;
            
            // 4. 設定角度（使用區域變數 mainMesh）
            if (angle !== 'current') {
                this.setProductAngle(angle, mainMesh);
            }
            
            // 5. 渲染
            this.renderer.render(this.scene, this.camera);
            
            // 6. 匯出
            const dataURL = this.renderer.domElement.toDataURL('image/png');
            
            // 7. 下載
            const a = document.createElement('a');
            a.href = dataURL;
            const letter1 = document.getElementById('letter1').value || 'A';
            const letter2 = document.getElementById('letter2').value || 'B';
            const angleName = angle === 'current' ? 'custom' : angle;
            const scaleName = this.settings.scale + 'x';
            const bgName = this.settings.background === 'transparent' ? 'transparent' : this.settings.background;
            a.download = `DUET_${letter1}${letter2}_${angleName}_${scaleName}_${bgName}.png`;
            a.click();
            
            this.showToast(`✅ 已匯出 ${scaleName} ${angleName === 'custom' ? '自訂角度' : angleName}`);
            
        } finally {
            // 8. 恢復原始狀態
            this.renderer.setSize(originalSize.x, originalSize.y);
            this.scene.background = originalBg;
            if (this.gridHelper) this.gridHelper.visible = true;
            if (this.axesHelper) this.axesHelper.visible = true;
            
            if (angle !== 'current') {
                this.camera.position.copy(originalCameraPos);
                this.camera.rotation.copy(originalCameraRot);
                this.controls.update();
            }
            
            this.renderer.render(this.scene, this.camera);
        }
    },
    
    /**
     * 設定產品角度
     */
    setProductAngle(angle, mainMesh) {
        // 使用傳入的 mainMesh 或從 window 讀取
        const mesh = mainMesh || window.mainMesh || this.mainMesh;
        if (!mesh) return;
        
        mesh.geometry.computeBoundingBox();
        const bbox = mesh.geometry.boundingBox;
        const center = bbox.getCenter(new THREE.Vector3());
        const size = bbox.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 2.5;
        
        const angles = {
            'front': { pos: [0, -distance, 0] },
            'side': { pos: [distance, 0, 0] },
            'top': { pos: [0, 0, distance] },
            'angle45': { pos: [distance, -distance, distance * 0.7] },
            'hero': { pos: [distance * 0.8, -distance * 1.2, distance * 0.6] }
        };
        
        const config = angles[angle];
        if (config) {
            this.camera.position.set(
                center.x + config.pos[0],
                center.y + config.pos[1],
                center.z + config.pos[2]
            );
            this.camera.lookAt(center);
            this.controls.update();
        }
    },
    
    /**
     * 單個角度匯出
     */
    captureAngle(angle) {
        this.exportProductPhoto(angle);
    },
    
    /**
     * 當前視角匯出
     */
    captureCurrentView() {
        this.exportProductPhoto('current');
    },
    
    /**
     * 批量匯出所有角度
     */
    async captureAllAngles() {
        const mainMesh = window.mainMesh || this.mainMesh;
        if (!mainMesh) {
            this.showToast('請先生成作品');
            return;
        }
        
        const angles = ['front', 'side', 'top', 'angle45', 'hero'];
        
        this.showToast('開始批量匯出...');
        
        for (const angle of angles) {
            await new Promise(resolve => {
                this.exportProductPhoto(angle);
                setTimeout(resolve, 300);
            });
        }
        
        this.showToast(`✅ 已匯出 ${angles.length} 張產品照片`);
    },
    
    /**
     * 顯示提示（使用現有的 showToast 或 alert）
     */
    showToast(message) {
        if (typeof showToast === 'function') {
            showToast(message);
        } else {
            alert(message);
        }
    }
};
