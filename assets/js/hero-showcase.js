/**
 * hero-showcase.js
 * 影片擦洗互動 — 滑鼠懸停時暫停並跟隨移動方向擦洗，
 * 離開後恢復慢速自動播放。觸控裝置需手指滑動。
 * scrub 更新透過 requestAnimationFrame 批次合併，避免跳格。
 */
(function () {
    'use strict';

    var AUTOPLAY_RATE   = 0.6;    // 自動播放速率（0.6x，比 0.35x 流暢但仍有莊重感）
    var SCRUB_SPEED     = 0.018;  // 每 px 對應的秒數
    var HINT_HIDE_DELAY = 1500;

    function initHeroShowcase() {
        var video    = document.getElementById('hero-video');
        var showcase = document.getElementById('hero-showcase');
        var hint     = document.getElementById('hero-drag-hint');

        if (!video || !showcase) return;

        var hintTimer   = null;
        var hintVisible = true;
        var isHovering  = false;
        var isTouching  = false;

        // RAF 批次合併 scrub 更新，避免每個 event 都 seek 造成跳格
        var pendingDx   = 0;
        var rafPending  = false;

        function flushScrub() {
            rafPending = false;
            if (pendingDx === 0) return;
            if (!video.duration) { pendingDx = 0; return; }
            var newTime = video.currentTime - pendingDx * SCRUB_SPEED;
            if (newTime < 0)              newTime += video.duration;
            if (newTime > video.duration) newTime -= video.duration;
            video.currentTime = newTime;
            pendingDx = 0;
        }

        function queueScrub(dx) {
            pendingDx += dx;
            if (!rafPending) {
                rafPending = true;
                requestAnimationFrame(flushScrub);
            }
        }

        // 影片載入後開始自動播放
        video.addEventListener('loadedmetadata', function () {
            video.playbackRate = AUTOPLAY_RATE;
            video.play().catch(function () {});
        });

        video.addEventListener('ended', function () {
            video.currentTime = 0;
            video.play().catch(function () {});
        });

        // ── 桌面：懸停即擦洗，無需點擊 ──────────────────────────
        var lastX = 0;

        showcase.addEventListener('mouseenter', function (e) {
            isHovering = true;
            lastX      = e.clientX;
            pendingDx  = 0;
            video.pause();
            showcase.classList.add('scrubbing');
            hideHint();
        });

        showcase.addEventListener('mousemove', function (e) {
            if (!isHovering) return;
            queueScrub(e.clientX - lastX);
            lastX = e.clientX;
        });

        showcase.addEventListener('mouseleave', function () {
            if (!isHovering) return;
            isHovering = false;
            pendingDx  = 0;
            showcase.classList.remove('scrubbing');
            video.playbackRate = AUTOPLAY_RATE;
            video.play().catch(function () {});
        });

        // ── 觸控：手指滑動擦洗 ───────────────────────────────────
        var lastTouchX = 0;

        showcase.addEventListener('touchstart', function (e) {
            if (e.touches.length !== 1) return;
            isTouching = true;
            lastTouchX = e.touches[0].clientX;
            pendingDx  = 0;
            video.pause();
            showcase.classList.add('scrubbing');
            hideHint();
        }, { passive: true });

        showcase.addEventListener('touchmove', function (e) {
            if (!isTouching || e.touches.length !== 1) return;
            queueScrub(e.touches[0].clientX - lastTouchX);
            lastTouchX = e.touches[0].clientX;
        }, { passive: true });

        showcase.addEventListener('touchend', function () {
            if (!isTouching) return;
            isTouching = false;
            pendingDx  = 0;
            showcase.classList.remove('scrubbing');
            video.playbackRate = AUTOPLAY_RATE;
            video.play().catch(function () {});
        });

        // ── 提示文字 ─────────────────────────────────────────────
        function hideHint() {
            if (!hint || !hintVisible) return;
            clearTimeout(hintTimer);
            hintTimer = setTimeout(function () {
                if (hint) hint.style.opacity = '0';
                hintVisible = false;
            }, HINT_HIDE_DELAY);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHeroShowcase);
    } else {
        initHeroShowcase();
    }
})();
