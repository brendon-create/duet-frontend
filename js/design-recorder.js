/**
 * DUET Content Pipeline — Design Event Recorder（Phase 1）
 *
 * 記錄使用者在 design-studio.html 的設計過程，供日後（Phase 5+）生成
 * 設計短片 replay 使用。規格見 DUET_內容管線_定案規格_v2.md §4.2、§5 Phase 1。
 *
 * 範圍（Phase 1）：只記錄、只匯出，不呼叫任何後端、不送出任何網路請求。
 * 開關由 window.DUET_FEATURE_RECORDER 控制；關閉時本檔案完全不建立
 * window.DesignRecorder、不掛任何監聽器，對頁面零影響。
 *
 * 不依賴 Three.js 或任何 ES module；純粹透過 addEventListener 附加在
 * design-studio.html 既有的靜態表單元素上，不修改、不覆寫任何既有的
 * handler（同一元素上可以掛多個 change 監聽器，這是這個 codebase 既有
 * 的寫法，#material 本身就掛了兩個）。
 *
 * 字體下拉選單（#font1-select / #font2-select）是動態建立、且每次使用者
 * 重新選字體都會整個重新賦值 onchange 的元素，所以字體改用事件代理
 * （document 上的單一 change 監聽 + 過濾 target id），不受動態建立/
 * 重新賦值影響，也只需要在 init() 註冊一次。
 */
(function () {
    'use strict';

    if (!window.DUET_FEATURE_RECORDER) return; // 開關關閉：完全不建立、不掛任何東西
    if (window.DesignRecorder) return; // 避免重複載入時互相覆蓋
    // replayMode：隱藏 iframe 重播用的分身頁面，不需要（也不該）自己再記錄一份時間軸
    if (new URLSearchParams(location.search).get('replayMode') === '1') return;

    var SCHEMA_VERSION = '1.1';
    var RECORDER_VERSION = '1.0.0';
    var BAIL_DEBOUNCE_MS = 400;

    var startedAt = null;
    var sessionId = null;
    var initialized = false;
    var events = [];
    var hasStory = false;
    var bailDebounceTimer = null;

    // 各追蹤欄位的「上一次已知值」，用來組出事件的 from/to，
    // 也用來過濾「值沒變」的重複觸發（例如 blur 造成的多餘 change）。
    var lastLetters = null;
    var lastFonts = { 1: null, 2: null };
    var lastMaterial = null;
    var lastSize = null;
    var lastBail = null;

    function elapsedMs() {
        return Date.now() - startedAt;
    }

    function record(type, from, to) {
        events.push({ t: elapsedMs(), type: type, from: from, to: to });
    }

    function fieldValue(id) {
        var el = document.getElementById(id);
        return el ? el.value : null;
    }

    function currentFont(slot) {
        // 尚未選過字體前是按鈕（data-selected 存目前值）；選過之後會換成 <select>。
        var select = document.getElementById('font' + slot + '-select');
        if (select) return select.value;
        var btn = document.getElementById('font' + slot + '-btn');
        return btn ? btn.getAttribute('data-selected') : null;
    }

    function currentMaterialState() {
        return {
            material: fieldValue('material'),
            plating: fieldValue('plating'),
            finish: fieldValue('finish')
        };
    }

    function currentBailState() {
        return {
            x: parseFloat(fieldValue('ringX')) || 0,
            y: parseFloat(fieldValue('ringY')) || 0,
            z: parseFloat(fieldValue('ringZ')) || 0,
            rotation: parseFloat(fieldValue('ringRotation')) || 0
        };
    }

    function sameMaterial(a, b) {
        return a && b && a.material === b.material && a.plating === b.plating && a.finish === b.finish;
    }

    function sameBail(a, b) {
        return a && b && a.x === b.x && a.y === b.y && a.z === b.z && a.rotation === b.rotation;
    }

    // 把 camera 位置換算成方位角/仰角（純算術，不依賴 Three.js 的 Spherical）。
    // camera 的 target 固定是原點（跟現有縮圖渲染邏輯的假設一致）。
    function cameraToSpherical(camera) {
        if (!camera || !camera.position) return null;
        var x = camera.position.x, y = camera.position.y, z = camera.position.z;
        var radius = Math.sqrt(x * x + y * y + z * z);
        if (!radius) return null;
        return {
            azimuth: Math.atan2(y, x) * (180 / Math.PI),
            polar: Math.acos(z / radius) * (180 / Math.PI)
        };
    }

    // ---- 事件 handler ----

    function onLettersChange() {
        var to = { letter1: fieldValue('letter1'), letter2: fieldValue('letter2') };
        if (lastLetters && lastLetters.letter1 === to.letter1 && lastLetters.letter2 === to.letter2) return;
        record('LETTERS_SET', lastLetters, to);
        lastLetters = to;
    }

    function onSizeChange() {
        var to = parseInt(fieldValue('size'), 10);
        if (lastSize === to) return;
        record('SIZE_CHANGED', lastSize, to);
        lastSize = to;
    }

    function onMaterialChange() {
        var to = currentMaterialState();
        if (sameMaterial(lastMaterial, to)) return;
        record('MATERIAL_CHANGED', lastMaterial, to);
        lastMaterial = to;
    }

    function onFontChange(e) {
        var slot = e.target && e.target.id === 'font1-select' ? 1
            : e.target && e.target.id === 'font2-select' ? 2
            : null;
        if (!slot) return;
        var font = e.target.value;
        if (lastFonts[slot] === font) return;
        record('FONT_CHANGED', { slot: slot, font: lastFonts[slot] }, { slot: slot, font: font });
        lastFonts[slot] = font;
    }

    function onBailInput() {
        clearTimeout(bailDebounceTimer);
        bailDebounceTimer = setTimeout(function () {
            var to = currentBailState();
            if (sameBail(lastBail, to)) return;
            record('BAIL_ADJUSTED', lastBail, to);
            lastBail = to;
        }, BAIL_DEBOUNCE_MS);
    }

    function onFontConfirmClick() {
        // 字體選擇器的「確認」按鈕背後是直接用 JS 設定 letter1/letter2/font1/
        // font2 的值（不是使用者操作下拉選單），不會觸發原生 change 事件，onLettersChange
        // /onFontChange 都不會被叫到。延後一輪事件迴圈，等確認流程真正把值設定完
        // （含它自己呼叫的 generateModel）之後，主動比對目前值有沒有變化。
        setTimeout(function () {
            onLettersChange();
            [1, 2].forEach(function (slot) {
                var font = currentFont(slot);
                if (lastFonts[slot] === font) return;
                record('FONT_CHANGED', { slot: slot, font: lastFonts[slot] }, { slot: slot, font: font });
                lastFonts[slot] = font;
            });
        }, 0);
    }

    function onStoryConfirmed() {
        hasStory = true;
        record('STORY_SET', null, null);
    }

    function addListener(id, evtName, handler) {
        var el = document.getElementById(id);
        if (el) el.addEventListener(evtName, handler);
    }

    function init() {
        if (initialized) return;
        initialized = true;
        startedAt = Date.now();
        sessionId = crypto.randomUUID();

        // 記下初始值，避免第一次變更時把「頁面預設值」誤判成一次使用者操作。
        lastLetters = { letter1: fieldValue('letter1'), letter2: fieldValue('letter2') };
        lastSize = parseInt(fieldValue('size'), 10) || null;
        lastMaterial = currentMaterialState();
        lastBail = currentBailState();

        addListener('letter1', 'change', onLettersChange);
        addListener('letter2', 'change', onLettersChange);
        addListener('size', 'change', onSizeChange);
        addListener('material', 'change', onMaterialChange);
        addListener('plating', 'change', onMaterialChange);
        addListener('finish', 'change', onMaterialChange);
        addListener('ringX', 'input', onBailInput);
        addListener('ringY', 'input', onBailInput);
        addListener('ringZ', 'input', onBailInput);
        addListener('ringRotation', 'input', onBailInput);
        addListener('confirm-story-card', 'click', onStoryConfirmed);
        addListener('confirm-btn', 'click', onFontConfirmClick);

        // 字體選單是動態建立、onchange 會被重新賦值的元素，用事件代理。
        document.addEventListener('change', onFontChange);
    }

    function finalState(opts) {
        opts = opts || {};
        var material = currentMaterialState();
        return {
            letter1: fieldValue('letter1'),
            letter2: fieldValue('letter2'),
            font1: currentFont(1),
            font2: currentFont(2),
            material: material.material,
            plating: material.plating,
            finish: material.finish,
            size: parseInt(fieldValue('size'), 10) || null,
            bail: currentBailState(),
            letter1BBox: window.letter1BBox ? Object.assign({}, window.letter1BBox) : null,
            letter2BBox: window.letter2BBox ? Object.assign({}, window.letter2BBox) : null,
            camera: cameraToSpherical(opts.camera),
            hasStory: hasStory
        };
    }

    function countByType(type) {
        return events.filter(function (e) { return e.type === type; }).length;
    }

    function readAiConsultation() {
        var raw = null;
        try {
            raw = localStorage.getItem('duet_ai_consultation');
        } catch (e) {
            return { present: false, turnCount: 0 };
        }
        if (!raw) return { present: false, turnCount: 0 };
        try {
            var parsed = JSON.parse(raw);
            // 實際欄位是 conversationHistory（見 ai-consultant.html 存 localStorage 那段），
            // 不是原本猜的 conversation/messages。
            var turns = Array.isArray(parsed.conversationHistory) ? parsed.conversationHistory : [];
            return { present: turns.length > 0, turnCount: turns.length };
        } catch (e) {
            // 解析失敗不擋 export，當作沒有諮詢資料
            return { present: false, turnCount: 0 };
        }
    }

    function exportTimeline(opts) {
        if (!initialized) return null;

        var fontChanges1 = 0, fontChanges2 = 0;
        events.forEach(function (e) {
            if (e.type === 'FONT_CHANGED' && e.to) {
                if (e.to.slot === 1) fontChanges1++;
                else if (e.to.slot === 2) fontChanges2++;
            }
        });

        return {
            schemaVersion: SCHEMA_VERSION,
            recorderVersion: RECORDER_VERSION,
            sessionId: sessionId,
            startedAt: new Date(startedAt).toISOString(),
            completedAt: new Date().toISOString(),
            durationMs: elapsedMs(),
            aiConsultation: readAiConsultation(),
            events: events.slice(),
            finalState: finalState(opts),
            counts: {
                fontChanges1: fontChanges1,
                fontChanges2: fontChanges2,
                bailAdjustments: countByType('BAIL_ADJUSTED'),
                materialChanges: countByType('MATERIAL_CHANGED')
            }
        };
    }

    window.DesignRecorder = {
        init: init,
        export: exportTimeline,
        get designId() { return sessionId; }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
