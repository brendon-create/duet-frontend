/**
 * DUET Content Pipeline — 參數面板重播擷取（Phase 6 擴充）
 *
 * 從時間軸重建出幾個「值得展示」的狀態（字母定案、字體切換、材質改變、
 * 墜頭調整），在一個隱藏的 iframe 裡重新載入同一份 design-studio.html，
 * 依序套用這些狀態（不模擬拖曳/點選過程，直接跳轉），每個狀態各拍一張
 * 「整個畫面」（面板 + 3D 模型）的合成截圖，回傳一組圖片給
 * design-share-button.js 上傳、後端接進影片生成流程。
 *
 * 用隱藏 iframe 而不是直接在使用者當下看的畫面上重播，是因為後者會讓
 * 使用者自己的螢幕在按下分享後突然快速閃過不同狀態，容易誤以為東西壞了。
 * iframe 會照使用者當下裝置的真實視窗尺寸載入，手機版分享出來的就自然是
 * 手機版排版，桌機版就是桌機版排版，不需要另外處理。
 *
 * 截圖用 html2canvas：一般 DOM 元素（滑軌、下拉選單）它讀得懂 CSS 直接重繪，
 * 但 WebGL 3D 畫布不是 CSS/DOM 能描述的內容，html2canvas 是靠讀取畫布當下
 * 的像素（canvas.toDataURL）來處理——WebGL 預設每幀畫完可能就把畫布內容
 * 清掉，所以這裡的重播頁面用 replayMode=1 網址參數，讓 3d-scene.js 開啟
 * preserveDrawingBuffer（見該檔案），畫面內容才會確實留著讓截圖讀到。
 */
(function () {
    'use strict';

    if (!window.DUET_FEATURE_RECORDER) return;
    // 隱藏 iframe 裡的那份分身頁面，不該再自己跑一次這整套重播邏輯
    if (new URLSearchParams(location.search).get('replayMode') === '1') return;

    var MAX_STATES = 6;
    var IFRAME_READY_TIMEOUT_MS = 20000;
    var SETTLE_DELAY_MS = 120; // generateModel 內部已有 50ms 重繪等待，這裡再留一點時間給合成

    var RELEVANT_TYPES = {
        LETTERS_SET: true,
        FONT_CHANGED: true,
        MATERIAL_CHANGED: true,
        SIZE_CHANGED: true,
        BAIL_ADJUSTED: true,
    };

    function clone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    // 時間軸的 events 只記錄「差異」（from/to），不是完整快照，所以用一個
    // 累加中的 state 物件依序套用每個 event 的 to 值，重建出每個時間點的
    // 完整狀態。用 finalState 當初始值是安全的——從頭到尾都沒被任何 event
    // 改過的欄位，它的值本來就等於 finalState，全程不變。
    function extractReplayStates(timeline) {
        if (!timeline || !timeline.finalState) return [];
        var state = clone(timeline.finalState);
        var checkpoints = [];

        (timeline.events || []).forEach(function (e) {
            if (!RELEVANT_TYPES[e.type]) return;
            switch (e.type) {
                case 'LETTERS_SET':
                    state.letter1 = e.to.letter1;
                    state.letter2 = e.to.letter2;
                    break;
                case 'FONT_CHANGED':
                    if (e.to.slot === 1) state.font1 = e.to.font;
                    else if (e.to.slot === 2) state.font2 = e.to.font;
                    break;
                case 'MATERIAL_CHANGED':
                    state.material = e.to.material;
                    state.plating = e.to.plating;
                    state.finish = e.to.finish;
                    break;
                case 'SIZE_CHANGED':
                    state.size = e.to;
                    break;
                case 'BAIL_ADJUSTED':
                    state.bail = { x: e.to.x, y: e.to.y, z: e.to.z, rotation: e.to.rotation };
                    break;
            }
            checkpoints.push({ type: e.type, state: clone(state) });
        });

        // 收斂連續同類型事件，只留每一段連續同類型的最後一筆（例如反覆調整
        // 墜頭好幾次，只需要最終定案的那個狀態，不需要每一次微調都show）。
        var collapsed = [];
        checkpoints.forEach(function (c) {
            if (collapsed.length && collapsed[collapsed.length - 1].type === c.type) {
                collapsed[collapsed.length - 1] = c;
            } else {
                collapsed.push(c);
            }
        });

        var picked = collapsed;
        if (collapsed.length > MAX_STATES) {
            picked = [];
            var stepSize = (collapsed.length - 1) / (MAX_STATES - 1);
            for (var i = 0; i < MAX_STATES; i++) {
                picked.push(collapsed[Math.round(i * stepSize)]);
            }
        }
        return picked.map(function (c) { return c.state; });
    }

    function createHiddenIframe() {
        var iframe = document.createElement('iframe');
        // 只能靠定位挪到畫面外，不能用 visibility:hidden——瀏覽器對 visibility:hidden
        // 的元素通常會直接暫停裡面的渲染迴圈（3D 動畫用的 requestAnimationFrame），
        // WebGL 畫布會整個沒有畫出任何一幀，preserveDrawingBuffer 也救不回來。
        iframe.style.cssText = 'position:fixed;left:-9999px;top:0;border:0;';
        iframe.style.width = window.innerWidth + 'px';
        iframe.style.height = window.innerHeight + 'px';
        var url = new URL(location.href);
        url.search = 'replayMode=1';
        iframe.src = url.toString();
        document.body.appendChild(iframe);
        return iframe;
    }

    function waitForIframeReady(iframe) {
        return new Promise(function (resolve, reject) {
            var settled = false;
            var timer = setTimeout(function () {
                if (!settled) { settled = true; reject(new Error('replay iframe 逾時未就緒')); }
            }, IFRAME_READY_TIMEOUT_MS);

            iframe.addEventListener('load', function () {
                var win = iframe.contentWindow;
                (function poll() {
                    if (settled) return;
                    if (win.fontsLoadedPromise && typeof win.__applyReplayState === 'function') {
                        win.fontsLoadedPromise
                            .catch(function () {}) // 字型載入失敗也繼續，不整個擋住重播
                            .then(function () {
                                if (settled) return;
                                settled = true;
                                clearTimeout(timer);
                                resolve(win);
                            });
                    } else {
                        setTimeout(poll, 100);
                    }
                })();
            });
        });
    }

    window.__captureReplayStates = async function (timeline) {
        var states = extractReplayStates(timeline);
        if (!states.length) return [];
        if (typeof window.html2canvas !== 'function') {
            console.warn('[replay-capture] html2canvas 未載入，略過參數面板重播');
            return [];
        }

        var iframe = createHiddenIframe();
        var images = [];
        try {
            var win = await waitForIframeReady(iframe);
            for (var i = 0; i < states.length; i++) {
                await win.__applyReplayState(states[i]);
                await new Promise(function (r) { setTimeout(r, SETTLE_DELAY_MS); });

                // html2canvas-pro 讀不到 WebGL 畫布內容（實測背景/面板都對，3D 模型
                // 整個空白），改成：面板+背景照片交給 html2canvas 截，3D 模型直接從
                // renderer.domElement 本人截圖（跟現有 __captureProductAssets 用的
                // 是同一種、已經驗證過可靠的方式），兩張圖疊在一起。3D 畫布本身是
                // alpha 透明背景（只有模型本體不透明），疊在最上層不會蓋住旁邊的
                // 面板，不需要處理精確的圖層順序。
                var domCanvas = await window.html2canvas(win.document.body, {
                    width: win.innerWidth,
                    height: win.innerHeight,
                    backgroundColor: null,
                    useCORS: true,
                });
                var outCanvas = document.createElement('canvas');
                outCanvas.width = domCanvas.width;
                outCanvas.height = domCanvas.height;
                var ctx = outCanvas.getContext('2d');
                ctx.drawImage(domCanvas, 0, 0);
                if (win.renderer && win.renderer.domElement) {
                    ctx.drawImage(win.renderer.domElement, 0, 0, outCanvas.width, outCanvas.height);
                }

                var blob = await new Promise(function (resolve) {
                    outCanvas.toBlob(resolve, 'image/jpeg', 0.9);
                });
                if (blob) images.push(blob);
            }
        } catch (e) {
            console.warn('[replay-capture] 參數面板重播失敗，略過這段:', e);
        } finally {
            // 只把 iframe 從畫面上移除，不保證瀏覽器會立刻釋放裡面渲染器佔用的
            // WebGL context（垃圾回收時機不保證）。瀏覽器對同一分頁能同時開啟
            // 的 WebGL context 數量有上限，重複分享幾次沒有主動釋放的話會慢慢
            // 洩漏，最後逼得瀏覽器搶主畫面那個 context 的資源、把主畫面的 3D
            // 渲染搞壞——用 WEBGL_lose_context 明確要求立刻釋放，不要等 GC。
            try {
                var iframeWin = iframe.contentWindow;
                if (iframeWin && iframeWin.renderer && typeof iframeWin.renderer.forceContextLoss === 'function') {
                    iframeWin.renderer.forceContextLoss();
                }
            } catch (e) {
                // iframe 可能已經在逾時/失敗的情況下被瀏覽器提早清掉，忽略
            }
            iframe.remove();
        }
        return images;
    };
})();
