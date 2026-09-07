/**
 * DUET 環境設定配置
 * 必須在其他 JS 之前引用
 */

// 後端網址
const PRODUCTION_BACKEND_URL = 'https://duet-backend-wlw8.onrender.com';
const STAGING_BACKEND_URL = 'https://duet-backend-staging-ye5v.onrender.com';
const ENV_STORAGE_KEY = 'duet_deploy_env';

// Content Pipeline 網址（目前只有 staging 版本存在，production 版本要等正式
// 上線那天才會建立；production 環境下 window.DUET_FEATURE_RECORDER 本來就是
// false，不會真的用到這個值）
const STAGING_CONTENT_URL = 'https://duet-content-pipeline-staging.onrender.com';

/**
 * 取得當前環境（優先順序：URL > localStorage > 預設）
 *
 * 注意：在正式域名（duet.brendonchen.com）上，
 * 除非 URL 明確帶 ?env=staging，否則永遠使用 production，
 * 並清除 localStorage 中殘留的 staging 設定，防止測試環境污染。
 */
function getCurrentEnv() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlEnv = urlParams.get('env');

    // 正式域名：只允許 URL 明確指定 staging，否則強制 production
    if (window.location.hostname === 'duet.brendonchen.com') {
        if (urlEnv === 'staging') {
            localStorage.setItem(ENV_STORAGE_KEY, 'staging');
            return 'staging';
        }
        // 清除可能殘留的 staging localStorage，回到 production
        localStorage.removeItem(ENV_STORAGE_KEY);
        return 'production';
    }

    // 其他域名（Vercel preview、localhost）：URL > localStorage > 預設
    if (urlEnv === 'staging' || urlEnv === 'production') {
        localStorage.setItem(ENV_STORAGE_KEY, urlEnv);
        return urlEnv;
    }

    const storedEnv = localStorage.getItem(ENV_STORAGE_KEY);
    if (storedEnv === 'staging' || storedEnv === 'production') {
        return storedEnv;
    }

    return 'production';
}

// 初始化環境
const currentEnv = getCurrentEnv();
const backendUrl = currentEnv === 'staging' ? STAGING_BACKEND_URL : PRODUCTION_BACKEND_URL;

// 設定全域變數（只使用 window，避免重複定義）
window.BACKEND_URL = backendUrl;
window.CURRENT_ENV = currentEnv;

// Content Pipeline — Design Event Recorder 開關（Phase 1）：staging 開、正式關
window.DUET_FEATURE_RECORDER = (currentEnv === 'staging');
window.CONTENT_URL = (currentEnv === 'staging') ? STAGING_CONTENT_URL : '';

console.log(`[config] 環境: ${currentEnv}, 後端: ${BACKEND_URL}`);

// ==========================================
// 時區安全的時間顯示（admin/order-tracker/distributor 共用）
//
// 後端很多時間戳是用 Python datetime.now().isoformat() 寫的，Render 伺服器
// 系統時區是 UTC，naive datetime 序列化後的字串完全沒有時區標記（沒有 Z
// 或 +08:00 這種後綴）。瀏覽器解析這種字串時，依照規範會直接當成「瀏覽器
// 本地時間」，於是 UTC 的數字被原封不動當成台灣時間顯示，實際上晚了 8
// 小時。這裡明確判斷字串有沒有帶時區資訊，含時間但沒有時區的字串視為
// UTC（補上 Z），再用 Asia/Taipei 時區格式化——不管使用者裝置本身設成
// 哪個時區，畫面上看到的都是台灣時間。
//
// 只針對「含時間」的字串處理：純日期字串（例如 "2026-10-15"，沒有 T）
// 依照規範本來就會被當成 UTC 午夜，不受這個問題影響，直接放行不做任何
// 轉換（這類值通常也是後端存成不含時間的 DATE 欄位，不需要時區轉換）。
// ==========================================
function _duetNormalizeTz(isoString) {
    var hasTime = isoString.indexOf('T') !== -1;
    var hasTz = /Z$|[+-]\d{2}:?\d{2}$/.test(isoString);
    return (hasTime && !hasTz) ? isoString + 'Z' : isoString;
}

window.formatTaiwanTime = function (isoString, opts) {
    if (!isoString) return '-';
    var d = new Date(_duetNormalizeTz(isoString));
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('zh-TW', Object.assign({ timeZone: 'Asia/Taipei' }, opts || {}));
};

window.formatTaiwanDate = function (isoString, opts) {
    if (!isoString) return '-';
    var d = new Date(_duetNormalizeTz(isoString));
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('zh-TW', Object.assign({ timeZone: 'Asia/Taipei' }, opts || {}));
};

// ==========================================
// Render 保持喚醒（每次頁面載入時發送請求到 /health）
// 注意：Render 從休眠到啟動需要 30-60 秒，
// 此請求只負責「發送喚醒訊號」，不等待成功回應
// ==========================================
(function() {
    // 檢查是否已經嘗試過喚醒（同一個 session 內只喚醒一次）
    if (window.sessionStorage && window.sessionStorage.getItem('render_wake_requested')) {
        return;
    }

    // 標記已發送喚醒請求
    if (window.sessionStorage) {
        window.sessionStorage.setItem('render_wake_requested', 'true');
    }

    // 延遲 2 秒後發送請求（讓頁面先載入）
    setTimeout(function() {
        fetch(window.BACKEND_URL + '/health', {
            method: 'GET',
            cache: 'no-store'
        })
        .then(function(response) {
            if (response.ok) {
                console.log('✅ Render 已在運作中');
            } else {
                console.log('📡 Render 喚醒請求已發送（正在啟動中...）');
            }
        })
        .catch(function(err) {
            // 請求失敗不代表 Render 沒有被喚醒
            // 可能只是還在啟動中，下次 request 會成功
            console.log('📡 Render 喚醒請求已發送（請稍候...）');
        });
    }, 2000);
})();
