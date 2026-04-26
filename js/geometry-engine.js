/**
 * geometry-engine.js - V3 幾何引擎
 *
 * 導出 fontMetaMap, loadedTTFBuffers, loadingTTFState, v3FontDataCache
 * 導出 initFontMeta(), loadTTFBuffer(), loadV3FontData()
 * 導出 createV3LetterGeometry(), convertOpentypeToThreejs()
 * 導出 opentypeCommandsToClipperPaths(), clipperOffset(), v3CommandsToClipperPath()
 */

// 快取：字體 ArrayBuffer（供 V3 pipeline 使用）
export const loadedTTFBuffers = {};

// 🔒 載入鎖定：防止同一字體重複 fetch（key: fontName, value: Promise）
export const loadingTTFState = {};

// 快取：fonts.json 的完整字體資料（含 offset_r）
export let fontMetaMap = {};

// V3 JSON 預處理資料快取
export const v3FontDataCache = new Map();

/**
 * 載入 fonts.json 並建立 name → meta 的查詢表
 * 包含 offset_r 欄位
 */
export async function initFontMeta() {
    try {
        const res = await fetch('fonts.json');
        const data = await res.json();
        const list = data.fonts || [];
        list.forEach(f => {
            const key = typeof f === 'string' ? f : f.name;
            fontMetaMap[key] = typeof f === 'string'
                ? { name: f, offset_r: 0, weight: 400 }
                : f;
        });
        console.log(`✅ [V3] fontMetaMap 建立完成，共 ${Object.keys(fontMetaMap).length} 種字體`);
    } catch (e) {
        console.warn('⚠️ [V3] 無法載入 fonts.json，offset_r 全部使用 0:', e.message);
    }
}

/**
 * 從後端 /assets/fonts/ttf/ 取得 TTF ArrayBuffer
 * 格式：FontName-Regular.ttf，例如 Alex_Brush-Regular.ttf
 * 🔒 加入載入鎖定，防止同一字體重複 fetch
 */
export async function loadTTFBuffer(fontName) {
    // 如果已載入，直接回傳
    if (loadedTTFBuffers[fontName]) return loadedTTFBuffers[fontName];

    // 🔒 如果正在載入中，等待該 Promise 完成
    if (loadingTTFState[fontName]) {
        console.log(`[V3] 等待字體載入中: ${fontName}`);
        return loadingTTFState[fontName];
    }

    const meta = fontMetaMap[fontName] || { weight: 400 };
    const weight = meta.weight || 400;
    // 檔名格式：Google Fonts 命名慣例 - FontName-Regular.ttf
    // 所有 weight 400 的字體都是 Regular 版本
    const style = weight === 400 ? 'Regular' : 'Bold';
    const fileName = fontName.replace(/ /g, '_') + '-' + style + '.ttf';
    const backendBase = window.BACKEND_URL || 'https://duet-backend-wlw8.onrender.com';
    const url = `${backendBase}/assets/fonts/ttf/${fileName}`;

    console.log(`[V3] 載入 TTF: ${url}`);

    // 🔒 設定載入鎖定（使用 Promise）
    loadingTTFState[fontName] = (async () => {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`TTF 載入失敗 (${res.status}): ${url}`);
            const buffer = await res.arrayBuffer();
            loadedTTFBuffers[fontName] = buffer;
            console.log(`✅ [V3] TTF 已快取: ${fontName}`);
            return buffer;
        } finally {
            // 載入完成後清除鎖定
            delete loadingTTFState[fontName];
        }
    })();

    return loadingTTFState[fontName];
}

/**
 * 將 opentype.js Path commands 轉為 Clipper 整數路徑陣列
 * 一個 glyph 可能包含多個子路徑（外輪廓 + 孔洞）
 * @param {Array} commands - opentype path.commands
 * @param {number} scale - 整數縮放因子（例如 1000）
 * @returns {Array} paths - ClipperLib.Paths（整數多邊形陣列）
 */
export function opentypeCommandsToClipperPaths(commands, scale) {
    const paths = [];
    let current = [];
    // 曲線平坦化精度（段數越多越精確，但效能越低）
    const CURVE_STEPS = 12;

    let cx = 0, cy = 0; // 目前游標位置

    for (const cmd of commands) {
        switch (cmd.type) {
            case 'M':
                // 開始新子路徑（先儲存上一個）
                if (current.length > 1) paths.push(current);
                current = [];
                cx = cmd.x; cy = cmd.y;
                current.push({ X: Math.round(cx * scale), Y: Math.round(cy * scale) });
                break;

            case 'L':
                cx = cmd.x; cy = cmd.y;
                current.push({ X: Math.round(cx * scale), Y: Math.round(cy * scale) });
                break;

            case 'Q': {
                // 二次貝茲曲線平坦化
                const x0 = cx, y0 = cy;
                const x1 = cmd.x1, y1 = cmd.y1;
                const x2 = cmd.x, y2 = cmd.y;
                for (let i = 1; i <= CURVE_STEPS; i++) {
                    const t = i / CURVE_STEPS;
                    const mt = 1 - t;
                    const px = mt * mt * x0 + 2 * mt * t * x1 + t * t * x2;
                    const py = mt * mt * y0 + 2 * mt * t * y1 + t * t * y2;
                    current.push({ X: Math.round(px * scale), Y: Math.round(py * scale) });
                }
                cx = x2; cy = y2;
                break;
            }

            case 'C': {
                // 三次貝茲曲線平坦化
                const x0 = cx, y0 = cy;
                const x1 = cmd.x1, y1 = cmd.y1;
                const x2 = cmd.x2, y2 = cmd.y2;
                const x3 = cmd.x, y3 = cmd.y;
                for (let i = 1; i <= CURVE_STEPS; i++) {
                    const t = i / CURVE_STEPS;
                    const mt = 1 - t;
                    const px = mt*mt*mt*x0 + 3*mt*mt*t*x1 + 3*mt*t*t*x2 + t*t*t*x3;
                    const py = mt*mt*mt*y0 + 3*mt*mt*t*y1 + 3*mt*t*t*y2 + t*t*t*y3;
                    current.push({ X: Math.round(px * scale), Y: Math.round(py * scale) });
                }
                cx = x3; cy = y3;
                break;
            }

            case 'Z':
                if (current.length > 1) {
                    // 確保路徑閉合（起點終點相同）
                    const first = current[0];
                    const last = current[current.length - 1];
                    if (first.X !== last.X || first.Y !== last.Y) {
                        current.push({ X: first.X, Y: first.Y });
                    }
                    paths.push(current);
                }
                current = [];
                break;
        }
    }
    // 處理未被 Z 關閉的最後一段
    if (current.length > 1) paths.push(current);

    return paths;
}

/**
 * 對 Clipper 路徑執行 Offset（膨脹）
 * 修復：先 Union 合併拓撲，再統一 offset，避免碎裂
 * @param {Array} paths - ClipperLib.Paths
 * @param {number} offsetUnits - 偏移量（Clipper 整數單位）
 * @returns {Array} 偏移後的 ClipperLib.Paths
 */
export function clipperOffset(paths, offsetUnits) {
    if (offsetUnits === 0) return paths;

    const ClipperLib = window.ClipperLib;

    // Step 1: CleanPolygons 移除自相交點，避免碎裂
    const cleaned = ClipperLib.Clipper.CleanPolygons(paths, 0.001);
    console.log(`[V3] Offset 前路徑數: ${paths.length}, CleanPolygons 後: ${cleaned.length}`);

    // 🔍 Debug: 列出每條路徑的方向
    cleaned.forEach((p, i) => {
        console.log(`[V3]   cleaned[${i}]: ${p.length}點, ${ClipperLib.Clipper.Orientation(p) ? 'CW' : 'CCW'}`);
    });

    // Step 2: 先 Union 合併所有路徑，建立正確的拓撲關係
    const co = new ClipperLib.Clipper();
    co.AddPaths(cleaned, ClipperLib.PolyType.ptSubject, true);

    const polyTree = new ClipperLib.PolyTree();
    co.Execute(
        ClipperLib.ClipType.ctUnion,
        polyTree,
        ClipperLib.PolyFillType.pftEvenOdd,
        ClipperLib.PolyFillType.pftEvenOdd
    );
    console.log(`[V3] Union PolyTree 根節點數: ${polyTree.Childs().length}`);

    // 🔍 Debug: 顯示 PolyTree 結構
    const dumpPolyTreeNode = (node, indent) => {
        const isHole = node.IsHole ? node.IsHole() : node.IsHole;
        const contour = node.Contour ? node.Contour() : node.Contour;
        console.log(`${indent}[${isHole ? '孔洞' : '外輪廓'} ${contour.length}點]`);
        const children = node.Childs ? node.Childs() : node.Childs;
        for (var i = 0; i < children.length; i++) {
            dumpPolyTreeNode(children[i], indent + '  ');
        }
    };
    console.log(`[V3] PolyTree 結構:`);
    for (var i = 0; i < polyTree.Childs().length; i++) {
        dumpPolyTreeNode(polyTree.Childs()[i], '  ');
    }

    // Step 3: 將 PolyTree 展平為路徑陣列，準備做 offset
    const flatPaths = [];
    const flattenPolyTreeToPaths = (node) => {
        if (node.Contour && node.Contour().length > 0) {
            flatPaths.push(node.Contour());
        }
        const children = node.Childs();
        for (var i = 0; i < children.length; i++) {
            flattenPolyTreeToPaths(children[i]);
        }
    };
    flattenPolyTreeToPaths(polyTree);
    console.log(`[V3] 展平後路徑數: ${flatPaths.length}`);
    flatPaths.forEach((p, i) => {
        console.log(`[V3]   flat[${i}]: ${p.length}點, ${ClipperLib.Clipper.Orientation(p) ? 'CW' : 'CCW'}`);
    });

    // Step 4: 對合併後的路徑做統一 offset（正向膨脹）
    const coOffset = new ClipperLib.ClipperOffset();
    coOffset.MiterLimit = 2.0;
    coOffset.AddPaths(flatPaths, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);

    const offsetResult = new ClipperLib.PolyTree();
    coOffset.Execute(offsetResult, offsetUnits); // 正值 = 向外膨脹

    // Step 5: 將 offset 後的 PolyTree 展平回傳
    const resultPaths = [];
    const flattenResult = (node) => {
        if (node.Contour && node.Contour().length > 0) {
            resultPaths.push(node.Contour());
        }
        const children = node.Childs();
        for (var i = 0; i < children.length; i++) {
            flattenResult(children[i]);
        }
    };
    flattenResult(offsetResult);
    console.log(`[V3] Offset 後路徑數: ${resultPaths.length}`);
    resultPaths.forEach((p, i) => {
        console.log(`[V3]   result[${i}]: ${p.length}點, ${ClipperLib.Clipper.Orientation(p) ? 'CW' : 'CCW'}`);
    });

    return resultPaths;
}

/**
 * 遞迴遍歷 PolyTree 節點，建立 THREE.Shape（含正確孔洞）
 * @param {ClipperLib.PolyNode} node - PolyTree 節點
 * @param {number} scale - 整數縮放因子（需除回）
 * @param {Array} allShapes - 收集結果的 Shape 陣列
 * @param {Object} container - 父節點的 Shape（孔洞會被加入這裡）
 */
function traversePolyTreeNode(node, scale, allShapes, container) {
    const ClipperLib = window.ClipperLib;

    if (!node) return;

    // 取得輪廓座標
    const pts = node.Contour().map(p => new THREE.Vector2(p.X / scale, p.Y / scale));

    if (!node.IsHole()) {
        // 外輪廓：建立新的 Shape
        const shape = new THREE.Shape(pts);
        allShapes.push(shape);
        console.log(`[V3] 建立 Shape: ${allShapes.length}`);

        // 遞迴處理子節點（可能是孔洞或嵌套輪廓）
        const children = node.Childs();
        for (var i = 0; i < children.length; i++) {
            traversePolyTreeNode(children[i], scale, allShapes, shape);
        }
    } else {
        // 孔洞：加入父節點的 holes
        if (container) {
            const holePath = new THREE.Path(pts);
            container.holes.push(holePath);
            console.log(`[V3] 加入孔洞至 Shape，孔洞數: ${container.holes.length}`);
        }

        // 遞迴處理子節點（孔洞內可能有嵌套實心）
        const children = node.Childs();
        for (var i = 0; i < children.length; i++) {
            traversePolyTreeNode(children[i], scale, allShapes, container);
        }
    }
}

/**
 * 使用 subPaths 的 isHole 資訊直接建立 THREE.Shape 陣列
 * 這個方法繞過 PolyTree 的 IsHole() 推斷，直接使用 JSON 中的 isHole 欄位
 *
 * @param {Array} finalPaths - Offset 後的 Clipper 路徑陣列
 * @param {Array} subPathsInfo - 原始的 subPaths 資訊（含 isHole 欄位）
 * @param {number} scale - 整數縮放因子（需除回）
 * @returns {Array} THREE.Shape[]
 */
function buildShapesFromSubPaths(finalPaths, subPathsInfo, scale) {
    const shapes = [];

    // 找出外輪廓（isHole = false）和孔洞（isHole = true）
    // 外輪廓應該只有一個（第一個是最大的）
    let outerShape = null;
    const holes = [];

    for (let i = 0; i < finalPaths.length; i++) {
        const path = finalPaths[i];
        const isHole = subPathsInfo[i]?.isHole ?? false;
        const pts = path.map(p => new THREE.Vector2(p.X / scale, p.Y / scale));

        if (!isHole) {
            // 外輪廓
            const shape = new THREE.Shape(pts);
            shapes.push(shape);
            if (!outerShape || path.length > (outerShape.shape ? outerShape.path.length : 0)) {
                outerShape = { shape, path };
            }
            console.log(`[V3] 建立外輪廓 Shape: ${shapes.length}`);
        } else {
            // 孔洞
            holes.push(pts);
            console.log(`[V3] 加入孔洞: ${holes.length}`);
        }
    }

    // 將孔洞加入外輪廓
    // 用第一個點做 ray casting，找出真正包含這個 hole 的 outer shape
    function pointInShape(pt, shapePts) {
        let inside = false;
        for (let i = 0, j = shapePts.length - 1; i < shapePts.length; j = i++) {
            const xi = shapePts[i].x, yi = shapePts[i].y;
            const xj = shapePts[j].x, yj = shapePts[j].y;
            if (((yi > pt.y) !== (yj > pt.y)) && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        return inside;
    }

    if (shapes.length === 1) {
        for (const holePts of holes) {
            shapes[0].holes.push(new THREE.Path(holePts));
        }
    } else if (shapes.length > 1) {
        // 多個外輪廓：把每個 hole 加進真正包含它的那個 outer
        for (const holePts of holes) {
            const testPt = holePts[0]; // 用第一個點測試
            let matched = false;
            for (const shape of shapes) {
                if (pointInShape(testPt, shape.getPoints())) {
                    shape.holes.push(new THREE.Path(holePts));
                    matched = true;
                    break;
                }
            }
            // 若找不到包含它的 outer（理論上不應發生），加入最大的
            if (!matched && outerShape) {
                outerShape.shape.holes.push(new THREE.Path(holePts));
            }
        }
    }

    console.log(`[V3] Shape 數量：${shapes.length}，孔洞數：${shapes.reduce((s, sh) => s + sh.holes.length, 0)}`);
    return shapes;
}

/**
 * 將 Clipper 路徑陣列重新組裝成 THREE.Shape 陣列
 * 使用 PolyTree + IsHole() 進行正確的孔洞偵測
 * @param {Array} clipperPaths - 偏移後的 ClipperLib.Paths 或 PolyTree
 * @param {number} scale - 整數縮放因子（需除回）
 * @returns {Array} THREE.Shape[]
 */
export function clipperPathsToThreeShapes(clipperPaths, scale) {
    const ClipperLib = window.ClipperLib;
    const shapes = [];

    if (clipperPaths.length === 0) {
        return shapes;
    }

    // 檢查是否為 PolyTree（若是，Childs 是方法）
    var rootChildren;
    var isPolyTree = false;

    try {
        rootChildren = clipperPaths.Childs();
        if (rootChildren && rootChildren.length !== undefined) {
            isPolyTree = true;
        }
    } catch (e) {
        // 不是 PolyTree，是普通的 Paths 陣列
        rootChildren = null;
    }

    if (isPolyTree) {
        // 直接遍歷 PolyTree
        console.log(`[V3] PolyTree 根節點數: ${rootChildren.length}`);

        for (var i = 0; i < rootChildren.length; i++) {
            var child = rootChildren[i];
            // 🔍 Debug: 列出每個根節點的輪廓點數和是否為孔洞
            console.log(`[V3]   根節點[${i}]: 點數=${child.Contour().length}, IsHole=${child.IsHole()}`);
            // 根節點的 container 是 null（最外層不需要加入孔洞）
            traversePolyTreeNode(child, scale, shapes, null);
        }
    } else {
        // 普通 Paths 陣列：兩步 union
        // Step A：每個 subpath 分別做 even-odd union，清理自交多邊形，
        //         輸出標準 winding（outer=CW，hole=CCW）
        const allCleaned = [];
        const flattenPT = (node) => {
            const c = node.Contour ? node.Contour() : [];
            if (c.length > 0) allCleaned.push(c);
            const ch = node.Childs ? node.Childs() : [];
            for (let k = 0; k < ch.length; k++) flattenPT(ch[k]);
        };
        for (let pi = 0; pi < clipperPaths.length; pi++) {
            const coA = new ClipperLib.Clipper();
            coA.AddPath(clipperPaths[pi], ClipperLib.PolyType.ptSubject, true);
            const ptA = new ClipperLib.PolyTree();
            coA.Execute(ClipperLib.ClipType.ctUnion, ptA,
                ClipperLib.PolyFillType.pftEvenOdd,
                ClipperLib.PolyFillType.pftEvenOdd);
            flattenPT(ptA);
        }

        // Step B：non-zero union，合并重疊外框（保留重疊部分），同時保留洞
        //         outer(CW,+1) + outer(CW,+1) 重疊 → winding=2≠0 → 填充（不消失）
        //         outer(CW,+1) + hole(CCW,-1)    → winding=0   → 不填充（洞保留）
        const coB = new ClipperLib.Clipper();
        coB.AddPaths(allCleaned, ClipperLib.PolyType.ptSubject, true);
        const polyTree = new ClipperLib.PolyTree();
        coB.Execute(ClipperLib.ClipType.ctUnion, polyTree,
            ClipperLib.PolyFillType.pftNonZero,
            ClipperLib.PolyFillType.pftNonZero);

        console.log(`[V3] PolyTree 根節點數: ${polyTree.Childs().length}`);

        // 遍歷 PolyTree 的根節點
        var rootChildren = polyTree.Childs();
        for (var i = 0; i < rootChildren.length; i++) {
            var child = rootChildren[i];
            traversePolyTreeNode(child, scale, shapes, null);
        }
    }

    console.log(`[V3] Shape 數量：${shapes.length}，孔洞數：${shapes.reduce((s, sh) => s + sh.holes.length, 0)}`);
    return shapes;
}

/**
 * Fallback：使用 Orientation 排序（舊方法）
 * 當 PolyTree 方法失敗時使用
 */
function clipperPathsToThreeShapes_OldFallback(clipperPaths, scale) {
    const ClipperLib = window.ClipperLib;
    const shapes = [];
    let currentShape = null;

    // 先排序：外輪廓優先（CW），孔洞（CCW）跟在後面
    const sorted = [...clipperPaths].sort((a, b) => {
        const aOuter = ClipperLib.Clipper.Orientation(a) ? 0 : 1;
        const bOuter = ClipperLib.Clipper.Orientation(b) ? 0 : 1;
        return aOuter - bOuter;
    });

    for (const path of sorted) {
        const pts = path.map(p => new THREE.Vector2(p.X / scale, p.Y / scale));
        const isCW = ClipperLib.Clipper.Orientation(path);

        if (isCW) {
            // 外輪廓：建立新 Shape
            currentShape = new THREE.Shape(pts);
            shapes.push(currentShape);
        } else {
            // 孔洞：掛在最近的外輪廓上
            if (currentShape) {
                const hole = new THREE.Path(pts);
                currentShape.holes.push(hole);
            } else {
                console.warn('[V3] 孔洞路徑找不到對應的外輪廓，跳過');
            }
        }
    }

    return shapes;
}

/**
 * 載入 V3 預處理過的字體 JSON 資料
 * 使用快取避免重複載入
 *
 * @param {string} fontName - 字體名稱
 * @returns {Promise<object>} - 字體資料物件
 */
export async function loadV3FontData(fontName) {
    if (v3FontDataCache.has(fontName)) {
        return v3FontDataCache.get(fontName);
    }

    // 將空格置換為底線，並進行 URL 編碼
    const fileName = fontName.replace(/ /g, '_');
    const jsonUrl = `assets/v3-data/${encodeURIComponent(fileName)}.json`;
    console.log(`[V3] 載入預處理字體資料：${jsonUrl}`);

    try {
        const response = await fetch(jsonUrl);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const fontData = await response.json();
        v3FontDataCache.set(fontName, fontData);
        console.log(`[V3] 字體資料載入成功：${fontName}，glyphs 數量：${Object.keys(fontData.glyphs).length}`);
        return fontData;
    } catch (err) {
        console.error(`[V3] 載入字體資料失敗：${fontName}`, err);
        throw err;
    }
}

/**
 * 將 V3 JSON 的路徑點轉換為 Clipper 路徑
 * JSON 中的路徑已經過離散化處理（貝茲曲線已轉為線段）
 *
 * @param {Array} points - JSON 中的 path 陣列
 * @param {number} CLIP_SCALE - 縮放因子
 * @returns {Array} - Clipper 路徑格式
 */
function v3PathToClipperPath(points, CLIP_SCALE, targetHeight) {
    const path = [];
    for (const pt of points) {
        // 先乘以 targetHeight 將歸一化座標轉為實際 mm，再轉 Clipper 整數單位
        // 例如：pt.x = 0.5, targetHeight = 10, CLIP_SCALE = 100000
        // X = 0.5 * 10 * 100000 = 500000（代表 5mm）
        path.push({
            X: Math.round(pt.x * targetHeight * CLIP_SCALE),
            Y: Math.round(pt.y * targetHeight * CLIP_SCALE)
        });
    }
    return path;
}

/**
 * 將 v3-data JSON v2 格式（commands 曲線命令）轉為高精度 Clipper 路徑
 * v2 格式保留原始貝茲控制點，Q 用 24 段、C 用 36 段離散化
 */
export function v3CommandsToClipperPath(input, CLIP_SCALE, targetHeight) {
    const path = [];
    let cx = 0, cy = 0;
    const STEPS_Q = 24;
    const STEPS_C = 36;

    // 縮放因子：統一乘以 10000 再轉為整數，避免 Clipper 運算時幾何體碎裂
    const SCALE = 10000;

    const push = (x, y) => path.push({
        X: Math.round(x * targetHeight * SCALE),
        Y: Math.round(y * targetHeight * SCALE)
    });

    console.log(`[V3] v3CommandsToClipperPath: input.length=${input.length}`);

    // V3 格式：commands = [{type: "M/L/Q/C", x, y, ...}, ...]
    // M/L 只讀取 x, y；Q 讀取 x1, y1, x, y；C 讀取 x1, y1, x2, y2, x, y
    // 追蹤上一個 push 的座標，過濾零長度線段
    let lastPushedX = null, lastPushedY = null;

    for (const cmd of input) {
        switch (cmd.type) {
            case 'M':
            case 'L':
                // M/L 只讀取 x, y，不要讀取 x1 欄位（避免 NaN）
                // 跳過零長度線段（M->L 或 L->L 座標相同的情況）
                cx = cmd.x;
                cy = cmd.y;
                if (lastPushedX !== null && cx === lastPushedX && cy === lastPushedY) {
                    // 座標相同，更新 lastPushed 但不 push（避免重複點）
                    lastPushedX = cx;
                    lastPushedY = cy;
                    break;
                }
                push(cx, cy);
                lastPushedX = cx;
                lastPushedY = cy;
                break;
            case 'Q':
                // Q: 二次貝茲，讀取 x1, y1 (控制點) 與 x, y (終點)
                for (let i = 1; i <= STEPS_Q; i++) {
                    const t = i / STEPS_Q, mt = 1 - t;
                    push(
                        mt * mt * cx + 2 * mt * t * cmd.x1 + t * t * cmd.x,
                        mt * mt * cy + 2 * mt * t * cmd.y1 + t * t * cmd.y
                    );
                }
                cx = cmd.x;
                cy = cmd.y;
                break;
            case 'C':
                // C: 三次貝茲，讀取 x1, y1, x2, y2 (控制點) 與 x, y (終點)
                for (let i = 1; i <= STEPS_C; i++) {
                    const t = i / STEPS_C, mt = 1 - t;
                    push(
                        mt * mt * mt * cx + 3 * mt * mt * t * cmd.x1 + 3 * mt * t * t * cmd.x2 + t * t * t * cmd.x,
                        mt * mt * mt * cy + 3 * mt * mt * t * cmd.y1 + 3 * mt * t * t * cmd.y2 + t * t * t * cmd.y
                    );
                }
                cx = cmd.x;
                cy = cmd.y;
                break;
            case 'Z':
                // Auto-Close Path：檢查最後一點是否等於第一點，若否則自動封閉
                if (path.length > 0) {
                    const first = path[0];
                    const last = path[path.length - 1];
                    if (first.X !== last.X || first.Y !== last.Y) {
                        path.push({ X: first.X, Y: first.Y });
                    }
                }
                break;
        }
    }
    return path;
}

/**
 * V3 核心：從預處理 JSON 資料產生字母幾何體
 *
 * Pipeline（歸一化版）：
 *   1. 載入 v3-data JSON（已預處理好 metrics 和路徑，歸一化為 0-1 範圍）
 *   2. 取出 glyph 路徑（已離散化），乘以 targetHeight 轉為實際 mm，再轉 Clipper 路徑
 *   3. 執行 Clipper Offset（依 fonts.json 的 offset_r，直接為 mm 單位）
 *   4. 轉回 THREE.Shape（含孔洞）
 *   5. ExtrudeGeometry 擠出
 *   6. Y 軸 180 度旋轉（Y-up → Z-up）
 *   7. geometry.center() 置中
 *
 * @param {string} fontName - 字體名稱（對應 fonts.json）
 * @param {string} letter - 單一字母字符
 * @param {number} targetHeight - 目標高度（mm）
 * @param {number} depthFactor - 擠出深度係數（預設 18）
 * @returns {THREE.BufferGeometry}
 */
export async function createV3LetterGeometry(fontName, letter, targetHeight, depthFactor = 18) {
    console.log(`[V3] 開始生成字母 "${letter}"，字體：${fontName}，目標高度：${targetHeight}mm`);

    // ── 步驟 1：載入 V3 預處理 JSON ───────────────────────────
    const fontData = await loadV3FontData(fontName);
    const { fontHeight, glyphs } = fontData;

    // 取得字元的 charCode
    const charCode = letter.charCodeAt(0);
    const glyphKey = String(charCode);
    const glyphData = glyphs[glyphKey];

    if (!glyphData) {
        throw new Error(`[V3] 字體 "${fontName}" 找不到字母 "${letter}" (charCode: ${charCode}) 的 glyph`);
    }

    // ── 步驟 2：取出路徑資料 ──────
    // v2.1: glyphData.subPaths = [{commands, isHole}, ...]
    // v2: glyphData.commands = [{type: "M", x, y}, ...]
    // v1: glyphData.path = [{x, y}, ...]（沒有 type 欄位）
    const CLIP_SCALE = 10000;

    let clipperPaths = [];
    let subPathsInfo = null;

    if (glyphData.subPaths && glyphData.subPaths.length > 0) {
        // v2.1 格式：使用 subPaths，直接用 isHole 欄位
        console.log(`[V3] Glyph 資料：v2.1 (subPaths)，子路徑數=${glyphData.subPaths.length}`);

        for (let i = 0; i < glyphData.subPaths.length; i++) {
            const sp = glyphData.subPaths[i];
            const path = v3CommandsToClipperPath(sp.commands, CLIP_SCALE, targetHeight);
            clipperPaths.push(path);
            console.log(`[V3]   subPath[${i}]: ${path.length}點, isHole=${sp.isHole}`);
        }
        subPathsInfo = glyphData.subPaths;
    } else {
        // 舊格式 fallback
        const pathInput = glyphData.commands || glyphData.path;
        if (!pathInput || pathInput.length === 0) {
            throw new Error(`[V3] 字體 "${fontName}" 字母 "${letter}" 沒有路徑資料`);
        }
        console.log(`[V3] Glyph 資料：${glyphData.commands ? 'v2' : 'v1'}，資料點數=${pathInput.length}`);
        clipperPaths = [v3CommandsToClipperPath(pathInput, CLIP_SCALE, targetHeight)];
    }

    if (clipperPaths.length === 0 || clipperPaths[0].length === 0) {
        throw new Error(`[V3] 字母 "${letter}" 轉換 Clipper 路徑失敗，paths 為空`);
    }

    // ── 步驟 3：Clipper Offset（座標已縮放到實際 mm）────────────
    const meta = fontMetaMap[fontName] || { offset_r: 0 };
    const offsetR = meta.offset_r || 0;

    let finalPaths = clipperPaths;
    if (offsetR > 0) {
        // 座標已乘以 targetHeight 變成實際 mm，offset 直接 = offsetR * CLIP_SCALE
        // 例如：offsetR = 0.1mm, CLIP_SCALE = 10000 → offsetUnits = 1000（代表 0.1mm）
        const offsetUnits = offsetR * CLIP_SCALE;
        console.log(`[V3] 執行 Offset：offset_r=${offsetR}mm，換算=${offsetUnits.toFixed(1)} Clipper 單位`);
        finalPaths = clipperOffset(clipperPaths, offsetUnits);
        console.log(`[V3] Offset 完成，路徑數：${clipperPaths.length} → ${finalPaths.length}`);
    } else {
        console.log(`[V3] 字體 "${fontName}" offset_r=0，跳過 Offset`);
    }

    // ── 步驟 4：轉回 THREE.Shape（含孔洞）──────────────────
    // 統一用 clipperPathsToThreeShapes（內部做 union pftEvenOdd → PolyTree）
    // 這樣能正確處理：自交多邊形、winding 方向錯誤、多外框重疊等所有情況
    const shapes = clipperPathsToThreeShapes(finalPaths, CLIP_SCALE);

    if (shapes.length === 0) {
        throw new Error(`[V3] 字母 "${letter}" 轉換 THREE.Shape 失敗`);
    }

    console.log(`[V3] Shape 數量：${shapes.length}，孔洞數：${shapes.reduce((s, sh) => s + sh.holes.length, 0)}`);

    // ── 步驟 5：ExtrudeGeometry 擠出 ─────────────────────────
    // depth = fontHeight * depthFactor，歸一化後 fontHeight 約 1.x
    // curveSegments 提升到 16-20 解決邊緣折線問題（工業級平滑度）
    const depth = fontHeight * depthFactor;
    const extrudeSettings = {
        depth: depth,
        bevelEnabled: false,
        curveSegments: 20
    };
    let geo = new THREE.ExtrudeGeometry(shapes, extrudeSettings);

    // ⚠️ 方向修正：這是為了把 OpenType Y-up 座標轉為 Web 座標
    // Y-up → Z-up 方向校正
    geo.rotateX(Math.PI);

    // B. 確認幾何體方向：在 return 之前印出 BBox
    geo.computeBoundingBox();
    const bbox = geo.boundingBox;
    console.log(`✅ [V3] 字母 "${letter}" 幾何體生成完成`);
    console.log(`   BBox: x=[${bbox.min.x.toFixed(2)},${bbox.max.x.toFixed(2)}] y=[${bbox.min.y.toFixed(2)},${bbox.max.y.toFixed(2)}] z=[${bbox.min.z.toFixed(2)},${bbox.max.z.toFixed(2)}]`);
    console.log(`   size: ${(bbox.max.x-bbox.min.x).toFixed(2)} x ${(bbox.max.y-bbox.min.y).toFixed(2)} x ${(bbox.max.z-bbox.min.z).toFixed(2)}`);
    return geo;
}

// 從 opentype.js 字體轉換為 Three.js typeface 格式
export function convertOpentypeToThreejs(opentypeFont, fontName) {
    const glyphs = {};
    const resolution = 1000;
    const scale = resolution / opentypeFont.unitsPerEm;

    // 獲取所有需要的字符
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (const char of chars) {
        const glyph = opentypeFont.charToGlyph(char);
        if (!glyph || glyph.index === 0) continue;

        // 使用原始單位獲取路徑，然後手動縮放
        const path = glyph.getPath(0, 0, opentypeFont.unitsPerEm);
        const commands = [];

        for (const cmd of path.commands) {
            switch (cmd.type) {
                case 'M':
                    commands.push({ type: 'm', args: [cmd.x * scale, cmd.y * scale] });
                    break;
                case 'L':
                    commands.push({ type: 'l', args: [cmd.x * scale, cmd.y * scale] });
                    break;
                case 'Q':
                    commands.push({ type: 'q', args: [cmd.x1 * scale, cmd.y1 * scale, cmd.x * scale, cmd.y * scale] });
                    break;
                case 'C':
                    commands.push({ type: 'b', args: [cmd.x1 * scale, cmd.y1 * scale, cmd.x2 * scale, cmd.y2 * scale, cmd.x * scale, cmd.y * scale] });
                    break;
                case 'Z':
                    commands.push({ type: 'z', args: [] });
                    break;
            }
        }

        // 將 commands 轉換為 'o' 格式（Three.js typeface 格式）
        let o = '';
        for (const cmd of commands) {
            o += cmd.type;
            if (cmd.args.length > 0) {
                o += ' ' + cmd.args.map(n => Math.round(n)).join(' ') + ' ';
            }
        }

        glyphs[char] = {
            ha: Math.round((glyph.advanceWidth || opentypeFont.unitsPerEm * 0.5) * scale),
            x_min: Math.round((glyph.xMin || 0) * scale),
            x_max: Math.round((glyph.xMax || glyph.advanceWidth || opentypeFont.unitsPerEm * 0.5) * scale),
            o: o.trim()
        };
    }

    return {
        glyphs: glyphs,
        familyName: fontName,
        ascender: Math.round(opentypeFont.ascender * scale),
        descender: Math.round(opentypeFont.descender * scale),
        underlinePosition: Math.round((opentypeFont.tables.post?.underlinePosition || -100) * scale),
        underlineThickness: Math.round((opentypeFont.tables.post?.underlineThickness || 50) * scale),
        boundingBox: {
            xMin: Math.round((opentypeFont.tables.head?.xMin || 0) * scale),
            yMin: Math.round((opentypeFont.tables.head?.yMin || 0) * scale),
            xMax: Math.round((opentypeFont.tables.head?.xMax || 1000) * scale),
            yMax: Math.round((opentypeFont.tables.head?.yMax || 1000) * scale)
        },
        resolution: resolution,
        original_font_information: {
            format: 0,
            copyright: '',
            fontFamily: fontName,
            fontSubfamily: 'Regular',
            uniqueID: fontName,
            fullName: fontName,
            version: '1.0',
            postScriptName: fontName.replace(/ /g, '')
        }
    };
}