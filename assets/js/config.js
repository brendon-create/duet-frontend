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
