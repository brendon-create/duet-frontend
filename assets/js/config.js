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
// ==========================================
(function() {
    // 重試次數
    const MAX_RETRIES = 3;
    let retryCount = 0;

    function tryWakeUpRender() {
        fetch(window.BACKEND_URL + '/health', {
            method: 'GET',
            cache: 'no-store'
        })
        .then(function(response) {
            if (response.ok) {
                console.log('✅ Render 已喚醒');
            } else {
                console.warn('⚠️ Render 喚醒失敗');
                // 重試
                if (retryCount < MAX_RETRIES) {
                    retryCount++;
                    console.log(`🔄 重試喚醒 Render (${retryCount}/${MAX_RETRIES})...`);
                    setTimeout(tryWakeUpRender, 2000);
                } else {
                    console.error('❌ Render 喚醒失敗，已達最大重試次數');
                }
            }
        })
        .catch(function(err) {
            console.warn('⚠️ Render 喚醒請求失敗:', err.message);
            // 重試
            if (retryCount < MAX_RETRIES) {
                retryCount++;
                console.log(`🔄 重試喚醒 Render (${retryCount}/${MAX_RETRIES})...`);
                setTimeout(tryWakeUpRender, 2000);
            } else {
                console.error('❌ Render 喚醒失敗，已達最大重試次數');
            }
        });
    }

    // 延遲 2 秒後發送請求（讓頁面先載入）
    setTimeout(tryWakeUpRender, 2000);
})();
