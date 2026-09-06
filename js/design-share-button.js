/**
 * DUET Content Pipeline — 「分享這個作品」按鈕（Phase 6）
 *
 * 出現條件：兩個字母都已選定 + 至少選過一次字體 + generateModel() 成功完成過
 * 一次（用 window.letter1BBox 有值當代理判斷——BBox 只有模型算完才會被設定）。
 * 動畫：先在畫面偏中央處出現，停留幾秒，飛到 saved-versions 下方定位（CSS 用
 * transform 位移 + 2.2s 緩動，跟既有 #bg-switcher-hint 同一種技巧）。
 * 點擊：呼叫 /ingest/experience，帶 designId、時間軸、目前狀態快照、設計理念。
 * 可重複點擊——每次都是「從進入設計流程到當下」的完整過程。
 *
 * ⚠️ 目前範圍：只做「出現 + 動畫 + 觸發 ingest」。Phase 5 的影片 job 還不存在，
 * 所以這裡刻意不做「等影片生成好」的完整體驗（不呈現一個轉不停但永遠不會
 * 完成的假進度）。按下去現在只代表「把目前的設計資料分享出去」，環形進度條
 * 用來反映這次網路請求本身的等待，不是影片生成進度。
 *
 * 故事完成後的分享提醒：完整版設計理念要送出作品、問完字體選擇原因、使用者
 * 確認過才會生成，通常晚於按鈕第一次出現的時間點——早期分享的人 99% 沒有故事
 * 可以放進影片。如果使用者「之前已經分享過」、現在才確認故事，代表他錯過了
 * 讓故事進到分享內容的機會，這裡在故事確認的當下（使用者剛完成一件事、不是
 * 打斷設計流程）給一個低調的提醒 + 按鈕短暫強調光暈，邀請他更新分享。沒分享
 * 過的人不會看到這個提醒（按鈕本身就是邀請，不需要重複講）。
 *
 * Phase 4：ingest 成功後，在背景呼叫 window.__captureProductAssets()
 * （定義在 design-studio.html 的 module script 裡，因為需要直接存取
 * mainMesh/ringMesh/bailMesh，跟 getCamera 要橋接是同一個原因），把商品照
 * + 轉檯短片上傳到 CONTENT。不影響按鈕本身的狀態（不讓使用者等錄影的
 * 幾秒鐘），失敗只記 console，不影響分享本身已經成功這件事。
 */
(function () {
    'use strict';

    if (!window.DUET_FEATURE_RECORDER) return; // 跟 Recorder 共用同一個開關

    // AI 諮詢完成回到 design-studio 時，字母/字體/模型是頁面載入當下就用程式
    // 直接還原好的，「作品完整」這個條件幾乎立刻成立——如果說明框在那個當下
    // 馬上跳出來，使用者的眼睛根本還沒對焦到頁面上，會完全錯過。所以條件滿足
    // 後先等一段時間，確保使用者已經看得到自己的作品，才開始顯示說明框。
    var INITIAL_SETTLE_DELAY_MS = 3000;
    var RESTORY_HINT_HOLD_MS = 5000; // 故事完成後的提醒停留多久
    var STATUS_POLL_INTERVAL_MS = 4000; // 輪詢影片是否生成完成的間隔
    var READY_PULSE_MS = 1600; // 生成完成時「明顯變化」快閃提示要跑多久（對應 CSS ready-pulse 動畫時長）

    var btn = null;
    var labelEl = null;
    var explainer = null;
    var restoryHint = null;
    var shown = false;
    var hasSharedOnce = false;
    var originalLabelHTML = '';

    // idle：還沒按過或上一輪已經看過分享頁；preparing：ingest+背景生成/上傳
    // 進行中，輪詢 /status；ready：影片跟分享頁都好了，按鈕改成入口。
    var state = 'idle';
    var shareCode = null;
    var pollTimer = null;

    function isDesignComplete() {
        var letter1 = document.getElementById('letter1');
        var letter2 = document.getElementById('letter2');
        if (!letter1 || !letter2 || !letter1.value || !letter2.value) return false;
        // 模型至少成功算完一次的代理判斷：letter1BBox 只有 generateModel() 跑完才會設定
        return !!(window.letter1BBox && window.letter2BBox);
    }

    function showButton() {
        if (shown) return;
        shown = true;

        // 先等使用者把焦點放到作品上，才顯示說明框；使用者按下框裡的
        // 「知道了」才收攏淡出、按鈕在自己的定位淡入（見 dismissExplainer）
        // ——不是自動計時消失，讓使用者自己決定看完了沒。
        setTimeout(function () {
            explainer.classList.add('visible');
        }, INITIAL_SETTLE_DELAY_MS);
    }

    function dismissExplainer() {
        explainer.classList.add('collapsing');
        btn.classList.add('entering', 'settled');
    }

    function currentFont(slot) {
        var select = document.getElementById('font' + slot + '-select');
        if (select) return select.value;
        var btnEl = document.getElementById('font' + slot + '-btn');
        return btnEl ? btnEl.getAttribute('data-selected') : null;
    }

    function buildSnapshot() {
        return {
            letter1: document.getElementById('letter1').value,
            letter2: document.getElementById('letter2').value,
            font1: currentFont(1),
            font2: currentFont(2),
            material: document.getElementById('material').value,
            plating: document.getElementById('plating').value,
            finish: document.getElementById('finish').value,
            size: parseInt(document.getElementById('size').value, 10) || null,
            bail: {
                x: parseFloat(document.getElementById('ringX').value) || 0,
                y: parseFloat(document.getElementById('ringY').value) || 0,
                z: parseFloat(document.getElementById('ringZ').value) || 0,
                rotation: parseFloat(document.getElementById('ringRotation').value) || 0,
            },
        };
    }

    function stopPolling() {
        if (pollTimer) {
            clearTimeout(pollTimer);
            pollTimer = null;
        }
    }

    // 影片組裝沒有真實進度可回報（ffmpeg 沒辦法給精確百分比），這裡只能
    // 每隔幾秒問一次「好了沒」，不是即時推播。輪詢的是 design_id 不是
    // shareCode——分享頁 code 在 ingest 當下就建好了，但影片本身還沒。
    //
    // designHash 是這次 ingest 當下算出的版本號：後端 content_assets 裡
    // 「有沒有影片」這件事本身不能拿來判斷好了沒，因為重新分享時舊影片
    // 本來就還在（新影片做好前，「有影片」這個條件從一開始就成立）。帶著
    // 這次的 designHash 一起問，/status 才能正確分辨「有影片」是舊的還是
    // 這次要的那一版（見 app.py /status 用檔名比對版本）。
    function pollStatus(designId, designHash) {
        var url = window.CONTENT_URL + '/status/' + designId;
        if (designHash) url += '?hash=' + encodeURIComponent(designHash);
        fetch(url)
            .then(function (res) { return res.json(); })
            .then(function (data) {
                if (state !== 'preparing') return; // 使用者可能已經離開這個狀態，別再誤觸發
                if (data && data.success && data.ready && data.shareCode) {
                    shareCode = data.shareCode;
                    enterReadyState();
                    return;
                }
                pollTimer = setTimeout(function () { pollStatus(designId, designHash); }, STATUS_POLL_INTERVAL_MS);
            })
            .catch(function () {
                // 查詢本身失敗（網路瞬斷之類）不代表生成失敗，過一輪再試，
                // 不要讓使用者卡在「製作中」但其實已經好了卻不知道。
                pollTimer = setTimeout(function () { pollStatus(designId, designHash); }, STATUS_POLL_INTERVAL_MS);
            });
    }

    function enterPreparingState() {
        state = 'preparing';
        watchArmed = false;
        btn.classList.remove('ready-pulse');
        btn.classList.add('busy', 'preparing');
        btn.disabled = true;
        labelEl.innerHTML = '分享內容<br>製作中';
    }

    function enterReadyState() {
        stopPolling();
        state = 'ready';
        watchArmed = false; // 還沒被按過「前往分享」，先不要偵測變動（見下方說明）
        btn.classList.remove('busy', 'preparing');
        btn.classList.add('ready-pulse');
        btn.disabled = false;
        labelEl.innerHTML = '前往<br>分享';
        setTimeout(function () {
            btn.classList.remove('ready-pulse');
        }, READY_PULSE_MS);
    }

    // 分享期間（preparing）畫面被改了幾次都不管——反正真正決定內容的是
    // 使用者下次按下「分享」那一刻的畫面，中途改幾次都無所謂。「前往分享」
    // 狀態本身也還不開始偵測——一直要等到使用者真的按下「前往分享」那一刻
    // （代表這版內容已經被看過/分享出去了），之後的改動才要當下立刻觸發
    // 變回「分享這個作品」。不能一進入 ready 狀態就開始偵測：那樣會變成
    // 使用者根本還沒點開分享頁看過剛做好的這版，就已經被判定「過時」。
    // 純瀏覽器端 JSON 字串比對，不用問後端，欄位跟 buildSnapshot() 完全
    // 一致，涵蓋所有會影響外觀的參數。
    var lastSharedSnapshotJSON = null;
    var watchArmed = false;

    function checkVersionChanged() {
        if (state !== 'ready' || !watchArmed) return;
        if (lastSharedSnapshotJSON !== null && JSON.stringify(buildSnapshot()) !== lastSharedSnapshotJSON) {
            backToIdle();
        }
    }

    function backToIdle() {
        stopPolling();
        state = 'idle';
        watchArmed = false;
        btn.classList.remove('busy', 'preparing', 'ready-pulse');
        btn.disabled = false;
        labelEl.innerHTML = originalLabelHTML;
    }

    function openSharePage() {
        // 一律照按下去的意思做——開啟已經做好的分享頁，不管內容新不新。
        window.open(location.origin + '/d/' + shareCode, '_blank');

        // 按下當下先直接比對一次（這時 watchArmed 還是 false，不能走
        // checkVersionChanged() 那個有 guard 的路徑，這裡要無條件比對）
        // ——涵蓋「使用者還沒點過前往分享、但這之前就已經改了設計」的
        // 情況。不一樣就變回分享這個作品；一樣的話，從這一刻開始才武裝
        // 變動偵測，在這之前的改動都不算數（使用者還沒看過/分享出去這
        // 一版），之後任何一次改動才要當下立刻觸發變回。
        if (lastSharedSnapshotJSON !== null && JSON.stringify(buildSnapshot()) !== lastSharedSnapshotJSON) {
            backToIdle();
            return;
        }
        watchArmed = true;
    }

    function uploadOneAsset(designId, assetType, blob) {
        if (!blob) return Promise.resolve();
        var ext = blob.type.indexOf('mp4') !== -1 ? 'mp4' : (assetType === 'turntable' ? 'webm' : 'jpg');
        var form = new FormData();
        form.append('assetType', assetType);
        form.append('pipelineVersion', '1.0');
        form.append('file', blob, assetType + '.' + ext);
        return fetch(window.CONTENT_URL + '/assets/' + designId, { method: 'POST', body: form })
            .then(function (res) { return res.json(); })
            .catch(function (err) {
                console.warn('[share-button] ' + assetType + ' 上傳失敗:', err);
            });
    }

    var MODEL_SETTLE_POLL_MS = 150; // 等 generateModel() 跑完再擷取的輪詢間隔
    var MODEL_SETTLE_MAX_WAIT_MS = 15000; // 保險上限，避免萬一卡住就永遠不擷取

    // generateModel() 是非同步的（字體幾何運算要花時間），如果使用者剛改完
    // 字母/字型就馬上按分享，畫面上的 mainMesh 可能還是重繪前的舊模型——這時
    // 擷取到的商品照/轉檯短片會是上一版作品，不是使用者剛剛改完的這版。
    // window.isModelGenerating 是 design-studio.html 橋接出來的旗標（跟
    // window.mainMesh 同一種做法），這裡等它變 false 才真的開始擷取。
    function waitForModelSettled() {
        return new Promise(function (resolve) {
            var waited = 0;
            (function check() {
                if (!window.isModelGenerating || waited >= MODEL_SETTLE_MAX_WAIT_MS) {
                    resolve();
                    return;
                }
                waited += MODEL_SETTLE_POLL_MS;
                setTimeout(check, MODEL_SETTLE_POLL_MS);
            })();
        });
    }

    function captureAndUploadAssets(designId) {
        // 商品照/轉檯短片的擷取跟上傳不影響分享按鈕本身的狀態（不讓使用者
        // 等這個——擷取轉檯短片要花幾秒錄影時間），在背景默默進行就好。
        if (typeof window.__captureProductAssets !== 'function') return;
        waitForModelSettled()
            .then(function () { return window.__captureProductAssets(); })
            .then(function (assets) {
                if (!assets) {
                    console.warn('[share-button] __captureProductAssets 回傳空值，略過商品照/轉檯上傳');
                    return;
                }
                return Promise.all([
                    uploadOneAsset(designId, 'hero', assets.hero),
                    uploadOneAsset(designId, 'front', assets.front),
                    uploadOneAsset(designId, 'detail', assets.detail),
                    uploadOneAsset(designId, 'turntable', assets.turntable),
                ]);
            })
            .catch(function (err) {
                console.warn('[share-button] 商品照/轉檯擷取失敗:', err);
            });
    }

    function handleClick() {
        if (state === 'preparing') return;
        if (state === 'ready') {
            openSharePage();
            return;
        }
        if (!window.DesignRecorder || !window.CONTENT_URL) return;

        var designId = window.DesignRecorder.designId;
        var timeline = window.DesignRecorder.export({
            camera: (typeof getCamera === 'function') ? getCamera() : undefined,
        });
        var snapshot = buildSnapshot();

        var payload = {
            designId: designId,
            snapshot: snapshot,
            timeline: timeline,
            story: window.finalDesignStory || null,
        };

        // 記下這次分享對應的版本，供「按下前往分享」那一刻比對畫面有沒有變過。
        lastSharedSnapshotJSON = JSON.stringify(snapshot);

        enterPreparingState();

        fetch(window.CONTENT_URL + '/ingest/experience', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
            .then(function (res) { return res.json(); })
            .then(function (data) {
                hasSharedOnce = true;
                captureAndUploadAssets(designId);
                pollStatus(designId, data && data.designHash);
            })
            .catch(function (err) {
                console.warn('[share-button] ingest 失敗:', err);
                backToIdle();
            });
    }

    function onStoryConfirmedNudge() {
        // 只在「之前已經分享過」的情況才提醒——沒分享過的人，按鈕本身
        // 就已經是邀請了，不需要另外講。完全不打斷設計流程，純粹是
        // 低調的提示 + 按鈕短暫的強調光暈。
        if (!hasSharedOnce || !restoryHint) return;
        restoryHint.classList.add('visible');
        btn.classList.add('nudge');
        setTimeout(function () {
            restoryHint.classList.remove('visible');
            btn.classList.remove('nudge');
        }, RESTORY_HINT_HOLD_MS);
    }

    function init() {
        btn = document.getElementById('share-my-design-btn');
        explainer = document.getElementById('share-explainer');
        restoryHint = document.getElementById('share-restory-hint');
        if (!btn || !explainer) return;
        labelEl = btn.querySelector('.share-btn-label');
        originalLabelHTML = labelEl.innerHTML;

        btn.addEventListener('click', handleClick);

        var explainerOkBtn = document.getElementById('share-explainer-ok');
        if (explainerOkBtn) explainerOkBtn.addEventListener('click', dismissExplainer);

        // 附加在既有的故事確認按鈕上（不動它原本的 handler，跟 Recorder
        // 監聽同一個按鈕的模式一致）。
        var storyBtn = document.getElementById('confirm-story-card');
        if (storyBtn) storyBtn.addEventListener('click', onStoryConfirmedNudge);

        // 「前往分享」狀態期間即時偵測作品變動：letter1/letter2/size/
        // material/plating/finish/font1-select/font2-select 用代理監聽
        // document 的 change（font-select 是重新選字型後才動態產生的
        // <select>，用代理不用在建立當下另外加監聽器）；ringX/Y/Z/Rotation
        // 用代理監聽 input（拖曳滑桿）。checkVersionChanged() 內部已經檢查
        // state !== 'ready' 就直接跳過，preparing/idle 期間完全不受影響。
        var CHANGE_WATCH_IDS = {
            letter1: 1, letter2: 1, size: 1, material: 1, plating: 1, finish: 1,
            'font1-select': 1, 'font2-select': 1,
        };
        var INPUT_WATCH_IDS = { ringX: 1, ringY: 1, ringZ: 1, ringRotation: 1 };
        document.addEventListener('change', function (e) {
            if (e.target && CHANGE_WATCH_IDS[e.target.id]) checkVersionChanged();
        });
        document.addEventListener('input', function (e) {
            if (e.target && INPUT_WATCH_IDS[e.target.id]) checkVersionChanged();
        });

        // 字型選擇視窗的「確認」是另一條變更途徑：confirmFontSelection()
        // 直接用程式碼設定 letter1/letter2/font1-select/font2-select 的
        // .value，不會觸發原生 change 事件，上面那兩個代理監聽器看不到
        // 這條路徑，額外在「確認」按鈕本身掛一個監聽器。
        var fontConfirmBtn = document.getElementById('confirm-btn');
        if (fontConfirmBtn) fontConfirmBtn.addEventListener('click', checkVersionChanged);

        // 用輪詢判斷「作品是否已成形」，不掛在任何既有函式上（不動既有 code）。
        var checkInterval = setInterval(function () {
            if (isDesignComplete()) {
                showButton();
                clearInterval(checkInterval);
            }
        }, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
