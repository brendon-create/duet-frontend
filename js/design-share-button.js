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
 */
(function () {
    'use strict';

    if (!window.DUET_FEATURE_RECORDER) return; // 跟 Recorder 共用同一個開關

    var ENTER_DELAY_MS = 3000; // 出現後停留多久才開始飛
    var CONFIRM_HOLD_MS = 2200; // 分享完成後「已分享」文字停留多久

    var btn = null;
    var labelEl = null;
    var shown = false;
    var busy = false;
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
        btn.classList.add('entering');
        setTimeout(function () {
            btn.classList.add('flying');
        }, ENTER_DELAY_MS);
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

    function handleClick() {
        if (busy) return;
        if (!window.DesignRecorder || !window.CONTENT_URL) return;

        setBusy(true);

        var timeline = window.DesignRecorder.export({
            camera: (typeof getCamera === 'function') ? getCamera() : undefined,
        });

        var payload = {
            designId: window.DesignRecorder.designId,
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
                showTemporaryLabel('已分享<br>✓');
            })
            .catch(function (err) {
                console.warn('[share-button] ingest 失敗:', err);
                setBusy(false);
                showTemporaryLabel('稍後<br>再試');
            });
    }

    function init() {
        btn = document.getElementById('share-my-design-btn');
        if (!btn) return;
        labelEl = btn.querySelector('.share-btn-label');
        originalLabelHTML = labelEl.innerHTML;

        btn.addEventListener('click', handleClick);

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
