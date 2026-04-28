/**
 * hero-showcase.js
 * 影片擦洗互動 — 滑鼠懸停時自動暫停並跟隨移動方向擦洗，
 * 離開後恢復慢速自動播放。觸控裝置仍需手指滑動。
 */
(function () {
    'use strict';

    var AUTOPLAY_RATE   = 0.35;   // 自動播放速率（0.35x 慢速）
    var SCRUB_SPEED     = 0.018;  // 每 px 對應的秒數
    var HINT_HIDE_DELAY = 1500;   // 滑鼠進入後幾ms隱藏提示

    function initHeroShowcase() {
        var video    = document.getElementById('hero-video');
        var showcase = document.getElementById('hero-showcase');
        var hint     = document.getElementById('hero-drag-hint');

        if (!video || !showcase) return;

        var lastX       = 0;
        var hintTimer   = null;
        var hintVisible = true;
        var isHovering  = false;

        // 影片載入後開始慢速播放
        video.addEventListener('loadedmetadata', function () {
            video.playbackRate = AUTOPLAY_RATE;
            video.play().catch(function () {});
        });

        video.addEventListener('ended', function () {
            video.currentTime = 0;
            video.play().catch(function () {});
        });

        // ── 桌面：懸停即擦洗，無需點擊 ──────────────────────────
        showcase.addEventListener('mouseenter', function (e) {
            isHovering = true;
            lastX      = e.clientX;
            video.pause();
            showcase.classList.add('scrubbing');
            hideHint();
        });

        showcase.addEventListener('mousemove', function (e) {
            if (!isHovering) return;
            var dx = e.clientX - lastX;
            scrub(dx);
            lastX = e.clientX;
        });

        showcase.addEventListener('mouseleave', function () {
            if (!isHovering) return;
            isHovering = false;
            showcase.classList.remove('scrubbing');
            video.playbackRate = AUTOPLAY_RATE;
            video.play().catch(function () {});
        });

        // ── 觸控：手指滑動擦洗 ───────────────────────────────────
        var isTouching = false;
        var lastTouchX = 0;

        showcase.addEventListener('touchstart', function (e) {
            if (e.touches.length !== 1) return;
            isTouching = true;
            lastTouchX = e.touches[0].clientX;
            video.pause();
            showcase.classList.add('scrubbing');
            hideHint();
        }, { passive: true });

        showcase.addEventListener('touchmove', function (e) {
            if (!isTouching || e.touches.length !== 1) return;
            var dx     = e.touches[0].clientX - lastTouchX;
            scrub(dx);
            lastTouchX = e.touches[0].clientX;
        }, { passive: true });

        showcase.addEventListener('touchend', function () {
            if (!isTouching) return;
            isTouching = false;
            showcase.classList.remove('scrubbing');
            video.playbackRate = AUTOPLAY_RATE;
            video.play().catch(function () {});
        });

        // ── 核心擦洗邏輯 ─────────────────────────────────────────
        function scrub(dx) {
            if (!video.duration) return;
            var newTime = video.currentTime - dx * SCRUB_SPEED;
            if (newTime < 0)              newTime = video.duration + newTime;
            if (newTime > video.duration) newTime = newTime - video.duration;
            video.currentTime = newTime;
        }

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
