/**
 * DUET 環境設定配置
 * 必須在其他 JS 之前引用
 */

// 後端網址
const PRODUCTION_BACKEND_URL = 'https://duet-backend-wlw8.onrender.com';
const STAGING_BACKEND_URL = 'https://duet-backend-staging-ye5v.onrender.com';
const ENV_STORAGE_KEY = 'duet_deploy_env';

/**
 * 取得當前環境（優先順序：URL > localStorage > 預設）
 */
function getCurrentEnv() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlEnv = urlParams.get('env');
    
    // 第一優先：URL 有 env 參數
    if (urlEnv === 'staging' || urlEnv === 'production') {
        localStorage.setItem(ENV_STORAGE_KEY, urlEnv);
        return urlEnv;
    }
    
    // 第二優先：檢查 localStorage
    const storedEnv = localStorage.getItem(ENV_STORAGE_KEY);
    if (storedEnv === 'staging' || storedEnv === 'production') {
        return storedEnv;
    }
    
    // 第三優先：預設為正式環境
    return 'production';
}

// 初始化環境
const currentEnv = getCurrentEnv();
const backendUrl = currentEnv === 'staging' ? STAGING_BACKEND_URL : PRODUCTION_BACKEND_URL;

// 設定全域變數（只使用 window，避免重複定義）
window.BACKEND_URL = backendUrl;
window.CURRENT_ENV = currentEnv;

console.log(`[config] 環境: ${currentEnv}, 後端: ${BACKEND_URL}`);

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
