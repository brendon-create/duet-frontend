// ==========================================
// Three.js 3D 渲染模組
// 從 design-studio.html 完整提取，不做任何修改
// ==========================================

// 全域變數
let scene, camera, renderer, controls, envMap;
let mainMesh = null, bailMesh = null;

// ==========================================
// 場景初始化
// ==========================================
function initScene() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.up.set(0, 0, 1); // Z-up 系統
    // 從物件前方稍微偏右上，15度俯角觀看 45 度夾角
    camera.position.set(60, -85, 18);  // 拉遠鏡頭（原: 50, -70, 15）
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.getElementById('viewport').appendChild(renderer.domElement);
    // 暴露 renderer, scene, camera 給全局，供佩戴模擬使用
    window.renderer = renderer;
    window.scene = scene;
    window.camera = camera;

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0, 0);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.25);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(5, 5, 10);
    scene.add(directionalLight);

    const rgbeLoader = new RGBELoader();
    const hdrUrl = 'https://cdn.jsdelivr.net/gh/brendon-create/duet-frontend@cd8d6bc/assets/images/hdr/studio_small_08_1k.hdr';

    console.log('🔄 開始載入 HDR:', hdrUrl);

    rgbeLoader.load(
        hdrUrl,
        (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            envMap = texture;
            scene.environment = envMap;
            console.log('✅ HDR 環境貼圖載入成功');
            showInitialSphere();
        },
        undefined,  // onProgress
        (error) => {
            console.error('❌ HDR 載入失敗:', error);
            console.error('   URL:', hdrUrl);
            console.error('   球體將顯示但缺少環境反射');
            showInitialSphere();  // 失敗也要顯示球體
        }
    );

    window.addEventListener('resize', onResize);
}

function showInitialSphere() {
    const geometry = new THREE.SphereGeometry(7.5, 64, 64);
    const material = getMaterial('silver925', 'glossy', 'none');  // 預設：925銀，亮面，無電鍍
    mainMesh = new THREE.Mesh(geometry, material);
    scene.add(mainMesh);

    bailMesh = createBail();
    updateBailPosition();
}

// ==========================================
// 材質管理
// ==========================================
function getMaterial(materialType, finish, plating = 'none') {
    const materialParams = {
        roughness: finish === 'glossy' ? 0.1 : (finish === 'matte' ? 0.6 : 0.3),
        metalness: 1.0,
        envMap: envMap,
        envMapIntensity: 2.5
    };

    // 根據材質設定顏色
    if (materialType === 'silver925') {
        materialParams.color = new THREE.Color(0xe8e8e8);  // 925 銀白色
    } else if (materialType === 'gold18k') {
        materialParams.color = new THREE.Color(0xffd700);  // 18K 金黃色
    }

    // 根據電鍍調整顏色
    if (plating === 'white') {
        materialParams.color = new THREE.Color(0xf5f5f5);  // 白 K 金 - 偏白但保留金屬質感
    } else if (plating === 'rose') {
        materialParams.color = new THREE.Color(0xffb6c1);  // 玫瑰金 - 柔和粉金色
    }

    return new THREE.MeshStandardMaterial(materialParams);
}

// ==========================================
// 模型生成
// ==========================================
async function generateModel() {
    console.log('🔨 開始生成 3D 模型');

    const letter1 = document.getElementById('letter1').value;
    const letter2 = document.getElementById('letter2').value;
    const font1Name = document.getElementById('font1').value;
    const font2Name = document.getElementById('font2').value;
    const size = parseFloat(document.getElementById('size').value);

    if (!letter1 || !letter2 || !font1Name || !font2Name) {
        alert('請完整選擇字母與字體');
        return;
    }

    console.log(`📝 模型參數:`, { letter1, letter2, font1Name, font2Name, size });

    try {
        // 載入字體
        const [font1, font2] = await Promise.all([
            loadFont(font1Name),
            loadFont(font2Name)
        ]);

        if (!font1 || !font2) {
            alert('字體載入失敗');
            return;
        }

        // 生成字母幾何
        console.log('🔤 生成字母 1:', letter1);
        const geom1 = new THREE.TextGeometry(letter1, {
            font: font1,
            size: size,
            depth: 2,
            curveSegments: 12,
            bevelEnabled: false
        });

        console.log('🔤 生成字母 2:', letter2);
        const geom2 = new THREE.TextGeometry(letter2, {
            font: font2,
            size: size,
            depth: 2,
            curveSegments: 12,
            bevelEnabled: false
        });

        // 計算 bounding box
        geom1.computeBoundingBox();
        geom2.computeBoundingBox();

        const bbox1 = geom1.boundingBox;
        const bbox2 = geom2.boundingBox;

        console.log('📦 字母 1 bounding box:', {
            min: { x: bbox1.min.x, y: bbox1.min.y, z: bbox1.min.z },
            max: { x: bbox1.max.x, y: bbox1.max.y, z: bbox1.max.z }
        });
        console.log('📦 字母 2 bounding box:', {
            min: { x: bbox2.min.x, y: bbox2.min.y, z: bbox2.min.z },
            max: { x: bbox2.max.x, y: bbox2.max.y, z: bbox2.max.z }
        });

        // 讓兩個字母在原點相交
        const offset1X = -(bbox1.max.x + bbox1.min.x) / 2;
        const offset1Y = -(bbox1.max.y + bbox1.min.y) / 2;

        const offset2X = -(bbox2.max.x + bbox2.min.x) / 2;
        const offset2Y = -(bbox2.max.y + bbox2.min.y) / 2;

        geom1.translate(offset1X, offset1Y, 0);
        geom2.translate(offset2X, offset2Y, 0);

        // 建立 Mesh
        const tempMesh1 = new THREE.Mesh(geom1);
        const tempMesh2 = new THREE.Mesh(geom2);

        // 旋轉第二個字母 90 度（繞 Z 軸）
        tempMesh2.rotation.z = Math.PI / 2;
        tempMesh2.updateMatrix();
        geom2.applyMatrix4(tempMesh2.matrix);

        console.log('🔀 執行 CSG Intersection...');

        // 使用 three-bvh-csg 執行 Intersection
        const csgEvaluator = new Evaluator();
        csgEvaluator.useGroups = false;
        csgEvaluator.attributes = ['position', 'normal'];

        const brushA = new Brush(geom1);
        const brushB = new Brush(geom2);

        const result = csgEvaluator.evaluate(brushA, brushB, INTERSECTION);

        console.log('✅ Intersection 完成');
        console.log('   - Vertices:', result.attributes.position.count);
        console.log('   - Triangles:', result.index ? result.index.count / 3 : 0);

        // 檢查 geometry 是否有效
        if (!result.attributes.position || result.attributes.position.count === 0) {
            console.error('❌ 生成的幾何為空！');
            alert('字母無交集，請調整字母或字體選擇');
            return;
        }

        // 計算法向量（若缺失）
        if (!result.attributes.normal) {
            console.log('⚠️ 缺少法向量，正在重新計算...');
            result.computeVertexNormals();
        }

        // 移除舊 mesh
        if (mainMesh) {
            scene.remove(mainMesh);
            mainMesh.geometry.dispose();
            if (Array.isArray(mainMesh.material)) {
                mainMesh.material.forEach(m => m.dispose());
            } else {
                mainMesh.material.dispose();
            }
        }

        // 建立新 mesh
        const material = getMaterial(
            document.getElementById('material').value,
            document.getElementById('finish').value,
            document.getElementById('plating').value
        );

        mainMesh = new THREE.Mesh(result, material);
        mainMesh.castShadow = true;
        mainMesh.receiveShadow = true;

        // 計算 bounding box
        result.computeBoundingBox();
        const finalBBox = result.boundingBox;

        console.log('📦 最終模型 bounding box:', {
            min: { x: finalBBox.min.x, y: finalBBox.min.y, z: finalBBox.min.z },
            max: { x: finalBBox.max.x, y: finalBBox.max.y, z: finalBBox.max.z }
        });

        // 儲存 bounding box 到 mainMesh（供其他函數使用）
        mainMesh.userData.boundingBox = {
            min: { x: finalBBox.min.x, y: finalBBox.min.y, z: finalBBox.min.z },
            max: { x: finalBBox.max.x, y: finalBBox.max.y, z: finalBBox.max.z },
            width: finalBBox.max.x - finalBBox.min.x,
            height: finalBBox.max.y - finalBBox.min.y,
            depth: finalBBox.max.z - finalBBox.min.z
        };

        scene.add(mainMesh);

        console.log('✅ 模型已加入場景');

        // 更新 bail 位置
        updateBailPosition();

    } catch (error) {
        console.error('❌ 模型生成錯誤:', error);
        console.error('   錯誤訊息:', error.message);
        console.error('   錯誤堆疊:', error.stack);
        alert(`模型生成失敗: ${error.message}`);
    }
}

// ==========================================
// 字體轉換與載入
// ==========================================
function convertOpentypeToThreejs(opentypeFont, fontName) {
    const scale = 100;
    const glyphs = {};

    for (let charCode = 32; charCode < 127; charCode++) {
        const char = String.fromCharCode(charCode);
        const glyph = opentypeFont.charToGlyph(char);

        if (!glyph || !glyph.path) continue;

        const shapes = [];
        const commands = glyph.path.commands;

        let currentShape = null;
        let currentPath = null;

        for (const cmd of commands) {
            const x = cmd.x !== undefined ? cmd.x / scale : 0;
            const y = cmd.y !== undefined ? cmd.y / scale : 0;

            if (cmd.type === 'M') {
                if (currentPath) {
                    if (currentPath.curves.length > 0) {
                        currentShape.holes.push(currentPath);
                    }
                }

                currentShape = new THREE.Shape();
                currentPath = null;
                currentShape.moveTo(x, y);

            } else if (cmd.type === 'L') {
                currentShape.lineTo(x, y);

            } else if (cmd.type === 'Q') {
                const x1 = cmd.x1 / scale;
                const y1 = cmd.y1 / scale;
                currentShape.quadraticCurveTo(x1, y1, x, y);

            } else if (cmd.type === 'C') {
                const x1 = cmd.x1 / scale;
                const y1 = cmd.y1 / scale;
                const x2 = cmd.x2 / scale;
                const y2 = cmd.y2 / scale;
                currentShape.bezierCurveTo(x1, y1, x2, y2, x, y);

            } else if (cmd.type === 'Z') {
                if (currentPath) {
                    currentShape.holes.push(currentPath);
                    currentPath = null;
                }
            }
        }

        if (currentShape && currentShape.curves.length > 0) {
            shapes.push(currentShape);
        }

        const ha = glyph.advanceWidth ? glyph.advanceWidth / scale : 0;

        glyphs[char] = { ha, o: 'n', _cachedOutline: shapes };
    }

    const fontData = {
        glyphs: glyphs,
        familyName: fontName,
        ascender: opentypeFont.ascender / scale,
        descender: opentypeFont.descender / scale,
        underlineThickness: opentypeFont.tables.post.underlineThickness / scale,
        boundingBox: {
            xMin: opentypeFont.tables.head.xMin / scale,
            yMin: opentypeFont.tables.head.yMin / scale,
            xMax: opentypeFont.tables.head.xMax / scale,
            yMax: opentypeFont.tables.head.yMax / scale
        },
        resolution: 1000,
        original_font_information: opentypeFont.names
    };

    return new THREE.Font(fontData);
}

async function loadFont(fontName) {
    if (window.fontCache && window.fontCache[fontName]) {
        console.log(`✅ 從快取載入字體: ${fontName}`);
        return window.fontCache[fontName];
    }

    try {
        console.log(`📥 開始載入字體: ${fontName}`);

        const fontUrl = `https://cdn.jsdelivr.net/gh/brendon-create/duet-frontend@latest/assets/fonts/${fontName}.ttf`;
        console.log(`   URL: ${fontUrl}`);

        const opentypeFont = await opentype.load(fontUrl);
        console.log(`✅ Opentype 字體載入成功: ${fontName}`);

        const threejsFont = convertOpentypeToThreejs(opentypeFont, fontName);
        console.log(`✅ 轉換為 Three.js 字體: ${fontName}`);

        // 快取字體
        if (!window.fontCache) {
            window.fontCache = {};
        }
        window.fontCache[fontName] = threejsFont;

        return threejsFont;
    } catch (error) {
        console.error(`❌ 載入字體失敗: ${fontName}`, error);
        console.error('   錯誤訊息:', error.message);
        console.error('   錯誤堆疊:', error.stack);
        return null;
    }
}

// ==========================================
// Bail 吊環處理
// ==========================================
function createBail() {
    const geometry = new THREE.CylinderGeometry(0.8, 0.8, 4, 32);
    const material = new THREE.MeshStandardMaterial({
        color: 0xe8e8e8,
        metalness: 1.0,
        roughness: 0.1,
        envMap: envMap,
        envMapIntensity: 2.5
    });

    const bail = new THREE.Mesh(geometry, material);
    bail.rotation.x = Math.PI / 2;

    scene.add(bail);
    return bail;
}

function updateBailPosition() {
    if (!bailMesh || !mainMesh) return;

    const bailRelativeX = parseFloat(document.getElementById('bail-x')?.value || 0);
    const bailRelativeY = parseFloat(document.getElementById('bail-y')?.value || 0);
    const bailRelativeZ = parseFloat(document.getElementById('bail-z')?.value || 0);
    const bailRotation = parseFloat(document.getElementById('bail-rotation')?.value || 0);

    let topZ = 1;
    if (mainMesh.userData.boundingBox) {
        topZ = mainMesh.userData.boundingBox.max.z;
    } else if (mainMesh.geometry.boundingBox) {
        topZ = mainMesh.geometry.boundingBox.max.z;
    }

    const finalZ = topZ + bailRelativeZ;

    bailMesh.position.set(bailRelativeX, bailRelativeY, finalZ);
    bailMesh.rotation.z = (bailRotation * Math.PI) / 180;
}

// ==========================================
// 材質更新
// ==========================================
function updateMaterial() {
    if (!mainMesh) return;

    const newMaterial = getMaterial(
        document.getElementById('material').value,
        document.getElementById('finish').value,
        document.getElementById('plating').value
    );

    if (Array.isArray(mainMesh.material)) {
        mainMesh.material.forEach(m => m.dispose());
    } else {
        mainMesh.material.dispose();
    }

    mainMesh.material = newMaterial;
}

// ==========================================
// 視窗調整與動畫
// ==========================================
function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    if (controls) {
        controls.update();
    }

    // 檢查模型是否有旋轉動畫
    if (mainMesh && document.getElementById('auto-rotate')?.checked) {
        mainMesh.rotation.z += 0.005;
    }

    if (bailMesh && document.getElementById('auto-rotate')?.checked) {
        bailMesh.rotation.z += 0.005;
    }

    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}
