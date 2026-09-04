/**
 * DUET Content Pipeline — 「分享我的作品」按鈕（Phase 6）
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
    var EXPLAINER_HOLD_MS = 4500; // 說明框顯示後停留多久才開始收攏
    var CONFIRM_HOLD_MS = 2200; // 分享完成後「已分享」文字停留多久
    var RESTORY_HINT_HOLD_MS = 5000; // 故事完成後的提醒停留多久

    var btn = null;
    var labelEl = null;
    var explainer = null;
    var restoryHint = null;
    var shown = false;
    var busy = false;
    var hasSharedOnce = false;
    var originalLabelHTML = '';

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

        // 先等使用者把焦點放到作品上，才顯示說明框；停留幾秒後收攏淡出，
        // 同時按鈕在自己的定位淡入——兩個獨立元素交叉淡出/淡入，
        // 製造「說明框收攏成按鈕」的錯覺。
        setTimeout(function () {
            explainer.classList.add('visible');
            setTimeout(function () {
                explainer.classList.add('collapsing');
                btn.classList.add('entering', 'settled');
            }, EXPLAINER_HOLD_MS);
        }, INITIAL_SETTLE_DELAY_MS);
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

    function setBusy(isBusy) {
        busy = isBusy;
        if (isBusy) {
            btn.classList.add('busy');
            btn.disabled = true;
        } else {
            btn.classList.remove('busy');
            btn.disabled = false;
        }
    }

    function showTemporaryLabel(html) {
        labelEl.innerHTML = html;
        setTimeout(function () {
            labelEl.innerHTML = originalLabelHTML;
        }, CONFIRM_HOLD_MS);
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

    function captureAndUploadAssets(designId) {
        // 商品照/轉檯短片的擷取跟上傳不影響分享按鈕本身的狀態（不讓使用者
        // 等這個——擷取轉檯短片要花幾秒錄影時間），在背景默默進行就好。
        if (typeof window.__captureProductAssets !== 'function') return;
        window.__captureProductAssets()
            .then(function (assets) {
                if (!assets) return;
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
        if (busy) return;
        if (!window.DesignRecorder || !window.CONTENT_URL) return;

        setBusy(true);

        var designId = window.DesignRecorder.designId;
        var timeline = window.DesignRecorder.export({
            camera: (typeof getCamera === 'function') ? getCamera() : undefined,
        });

        var payload = {
            designId: designId,
            snapshot: buildSnapshot(),
            timeline: timeline,
            story: window.finalDesignStory || null,
        };

        fetch(window.CONTENT_URL + '/ingest/experience', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
            .then(function (res) { return res.json(); })
            .then(function () {
                setBusy(false);
                hasSharedOnce = true;
                showTemporaryLabel('已分享<br>✓');
                captureAndUploadAssets(designId);
            })
            .catch(function (err) {
                console.warn('[share-button] ingest 失敗:', err);
                setBusy(false);
                showTemporaryLabel('稍後<br>再試');
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

        // 附加在既有的故事確認按鈕上（不動它原本的 handler，跟 Recorder
        // 監聽同一個按鈕的模式一致）。
        var storyBtn = document.getElementById('confirm-story-card');
        if (storyBtn) storyBtn.addEventListener('click', onStoryConfirmedNudge);

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
