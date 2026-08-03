/**
 * Meta Pixel（Facebook Pixel）基礎程式碼
 * Pixel ID: 2611432972696612（與嘖嘖募資頁面共用同一顆 Pixel）
 *
 * 同時負責攔截網址上的 fbclid（Facebook 點擊識別碼），存進 localStorage，
 * 讓使用者從嘖嘖 Banner 進站、完成設計後回跳嘖嘖時，能把 fbclid 帶回去，
 * 讓嘖嘖頁面上的 Pixel 能歸因回同一次廣告點擊。
 */
!function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
    t = b.createElement(e); t.async = !0; t.src = v;
    s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
}(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

fbq('init', '2611432972696612');
fbq('track', 'PageView');

// 攔截並保存網址上的 fbclid（供之後回跳嘖嘖頁面時帶回）
(function () {
    var FBCLID_STORAGE_KEY = 'duet_fbclid';
    try {
        var fbclid = new URLSearchParams(window.location.search).get('fbclid');

        // 備援：嘖嘖 Banner 連結是固定網址、無法動態帶參數，
        // 退而求其次改讀 referrer（上一頁網址）裡的 fbclid，
        // 但這要看嘖嘖頁面自己的 referrer 政策設定，不保證一定抓得到。
        if (!fbclid && document.referrer) {
            try {
                fbclid = new URL(document.referrer).searchParams.get('fbclid');
            } catch (e) {
                // referrer 不是合法網址時忽略
            }
        }

        if (fbclid) {
            localStorage.setItem(FBCLID_STORAGE_KEY, fbclid);
        }
    } catch (e) {
        // localStorage 不可用（例如無痕模式限制）時靜默忽略，不影響其他功能
    }
})();

/**
 * 把先前保存的 fbclid 附加到指定網址（用於回跳嘖嘖等外部頁面）。
 * 找不到 fbclid 時，回傳原始網址不做任何更動。
 */
window.appendStoredFbclid = function (url) {
    try {
        var fbclid = localStorage.getItem('duet_fbclid');
        if (!fbclid) return url;
        var u = new URL(url, window.location.href);
        u.searchParams.set('fbclid', fbclid);
        return u.toString();
    } catch (e) {
        return url;
    }
};
