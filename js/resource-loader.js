/**
 * resource-loader.js - 字體載入系統
 *
 * 導出 availableFonts, fontsLoadedResolve, fontsLoadedPromise
 * 導出 loadFontsFromJSON(), initAvailableFonts()
 */

// 可用字體清單（從外部 JSON 載入）
export let availableFonts = [];

// 字體載入完成的 Promise（供其他地方 await）
export let fontsLoadedResolve;
export const fontsLoadedPromise = new Promise(resolve => { fontsLoadedResolve = resolve; });

/**
 * 從外部 JSON 檔案載入字體庫
 */
export async function loadFontsFromJSON() {
    try {
        const response = await fetch('fonts.json');
        const data = await response.json();
        return data.fonts || [];
    } catch (error) {
        console.error('❌ 載入字體庫失敗，使用內建列表:', error);
        // Fallback: 使用內建字體列表
        return [
            "Abel", "Abril Fatface", "Advent Pro", "Alegreya", "Alex Brush",
            "Alfa Slab One", "Alice", "Allura", "Amatic SC", "Amiri",
            "Anton", "Arapey", "Archivo", "Armata", "Artifika",
            "Arvo", "Audiowide", "Average", "Baloo 2", "Bangers",
            "Bebas Neue", "Belgrano", "Bentham", "Bitter", "Bree Serif",
            "Bubblegum Sans", "Bungee", "Cabin", "Cantata One", "Caudex",
            "Caveat", "Chivo", "Cinzel", "Comfortaa", "Commissioner",
            "Cookie", "Copse", "Cormorant Garamond", "Courier Prime", "Coustard",
            "Creepster", "Cutive Mono", "DM Serif Text", "Dancing Script", "Dosis",
            "EB Garamond", "Eczar", "Encode Sans", "Fauna One", "Fira Code",
            "Fira Sans", "Fjalla One", "Fugaz One", "Gelasio", "Gloria Hallelujah",
            "Great Vibes", "Handlee", "Hind", "Holtwood One SC", "Inconsolata",
            "Indie Flower", "Jost", "Kalam", "Kanit", "Karla",
            "Lexend", "Lobster", "Merriweather", "Neuton", "Nunito",
            "Old Standard TT", "Orbitron", "Oswald", "Outfit", "Pacifico",
            "Passion One", "Pathway Gothic One", "Patrick Hand", "Paytone One", "Playfair Display",
            "Poppins", "Prata", "Quicksand", "Righteous", "Rubik",
            "Russo One", "Sacramento", "Secular One", "Shadows Into Light", "Share Tech Mono",
            "Shrikhand", "Sniglet", "Space Grotesk", "Space Mono", "Spectral",
            "Tangerine", "Titan One", "Varela Round", "Vollkorn", "Zilla Slab"
        ];
    }
}

/**
 * 初始化可用字體清單：一律從 fonts.json 載入（方便後續變更字體清單）
 */
export async function initAvailableFonts() {
    try {
        console.log('🔍 從 fonts.json 載入字體清單...');
        availableFonts = await loadFontsFromJSON();
        console.log(`✅ 共有 ${availableFonts.length} 種字體可用`);
        if (typeof window.loadGoogleFonts === 'function') window.loadGoogleFonts();
    } catch (error) {
        console.error('❌ 載入 fonts.json 失敗:', error);
        availableFonts = await loadFontsFromJSON().catch(() => []);
        if (typeof window.loadGoogleFonts === 'function') window.loadGoogleFonts();
    }
}

// 初始化：載入字體庫（fonts.json），並在載入完成後觸發 Google Fonts 預載
// 使用 setTimeout 0 延遲，確保主模組的 window.loadGoogleFonts 已設定完成
(async function initializeFonts() {
    const loaded = await loadFontsFromJSON();
    console.log(`✅ 字體庫已載入：${loaded.length} 種字體`);
    availableFonts = loaded;
    // 等主模組設定 window.loadGoogleFonts 後再呼叫（ES module import 順序問題）
    setTimeout(() => {
        if (typeof window.loadGoogleFonts === 'function') window.loadGoogleFonts();
    }, 0);
    if (fontsLoadedResolve) fontsLoadedResolve();
})();