/**
 * DUET Blog — 三支 serverless function（列表 / 文章 / sitemap）共用的工具與版型。
 *
 * 文章由 BCCT 後台撰寫發布，這邊只讀公開 API、在伺服器端組好整頁 HTML
 * （跟 /d/<code> 分享頁同一種做法），讓 LINE/FB 預覽與搜尋引擎拿得到內容。
 * 檔名底線開頭，Vercel 不會把它當成獨立的 function。
 */

const SITE = 'https://duet.brendonchen.com';
const API = 'https://bcct-world.com/api/public';
const PUBLICATION = 'duet';

// 後台存的 DUET 圖片網址是正式網域；轉成相對路徑，staging/預覽網址也能透過
// 同一條 /media/blog 轉址（vercel.json）讀到圖片。
const MEDIA_ABS = SITE + '/media/blog/';

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function localMedia(url) {
    return url && url.startsWith(MEDIA_ABS) ? url.slice(SITE.length) : url;
}

// 回傳 { status, data }；網路錯誤 status = 0
async function fetchJson(url) {
    try {
        const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!resp.ok) return { status: resp.status, data: null };
        return { status: 200, data: await resp.json() };
    } catch (e) {
        return { status: 0, data: null };
    }
}

function postUrl(slug) {
    return '/blog/' + encodeURIComponent(slug);
}

// 台灣時間 YYYY.MM.DD
function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(d);
    return parts.replace(/-/g, '.');
}

/* ===== 內文白名單過濾 =====
 * 後台存檔時已清理過，這裡再過一次：只留下後台允許的標籤，屬性也只留白名單，
 * 網址只接受 http(s)/站內路徑；iframe 只接受 YouTube / Vimeo 的嵌入網址。 */
const ALLOWED = {
    p: [], h2: [], h3: [], blockquote: [], strong: [], b: [], em: [], i: [],
    ul: [], ol: [], li: [], br: [], span: [], div: [],
    a: ['href', 'title', 'target'],
    img: ['src', 'alt', 'width', 'height'],
    iframe: ['src', 'title', 'allow', 'allowfullscreen'],
};
const VOID_TAGS = new Set(['br', 'img']);
const IFRAME_SRC = /^https:\/\/(www\.youtube\.com\/embed\/|www\.youtube-nocookie\.com\/embed\/|player\.vimeo\.com\/video\/)/;

function decodeBasicEntities(s) {
    return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function safeUrl(url, tag) {
    url = url.trim();
    if (tag === 'iframe') return IFRAME_SRC.test(url) ? url : '';
    if (/^https?:\/\//i.test(url) || /^\/(?!\/)/.test(url)) return localMedia(url);
    if (tag === 'a' && (/^mailto:/i.test(url) || url.startsWith('#'))) return url;
    return '';
}

function sanitizeBody(html) {
    const src = String(html || '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<(script|style|noscript|template|object|embed|svg|math)\b[\s\S]*?<\/\1\s*>/gi, '');

    return src.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^<>]*)>|[<>]/g, (m, closing, tag, attrs) => {
        if (!tag) return m === '<' ? '&lt;' : '&gt;';
        tag = tag.toLowerCase();
        if (!(tag in ALLOWED)) return '';
        if (closing) return VOID_TAGS.has(tag) ? '' : `</${tag}>`;

        const out = [];
        const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
        let a;
        while ((a = re.exec(attrs))) {
            const name = a[1].toLowerCase();
            if (!ALLOWED[tag].includes(name)) continue;
            if (name === 'allowfullscreen') { out.push('allowfullscreen'); continue; }
            let val = decodeBasicEntities(a[2] ?? a[3] ?? a[4] ?? '');
            if (name === 'href' || name === 'src') {
                val = safeUrl(val, tag);
                if (!val) continue;
            }
            if (name === 'target') {
                if (val !== '_blank') continue;
                out.push('target="_blank" rel="noopener"');
                continue;
            }
            out.push(`${name}="${escapeHtml(val)}"`);
        }
        if ((tag === 'img' || tag === 'iframe') && !out.some(x => x.startsWith('src='))) return '';
        if (tag === 'img') out.push('loading="lazy"');
        return `<${tag}${out.length ? ' ' + out.join(' ') : ''}>`;
    });
}

/* ===== 版型（導覽列、頁尾與首頁 index.html 一致） ===== */
const STYLES = `
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: 'Inter', -apple-system, "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif;
    background-color: #FAF8F5; color: #2C2A26; line-height: 1.6;
    font-variant-numeric: lining-nums;
}
h1, h2, h3 {
    font-family: 'Cormorant Garamond', Georgia, "PingFang TC", "Noto Serif TC", serif;
    font-weight: 500; font-variant-numeric: lining-nums;
}
a { color: inherit; }

/* 導覽列 */
nav {
    display: flex; justify-content: space-between; align-items: center;
    padding: 24px 80px; position: sticky; top: 0; background-color: #FAF8F5;
    z-index: 100; border-bottom: 1px solid rgba(44, 42, 38, 0.08);
}
.logo-container { display: flex; align-items: baseline; gap: 8px; text-decoration: none; color: #2C2A26; }
.logo { font-size: 20px; font-weight: 600; letter-spacing: 2px; font-family: 'Cantata One', serif; }
.logo-subtitle { font-size: 10px; letter-spacing: 1px; color: #8B8680; margin-top: 4px; font-family: 'Libre Caslon Text', serif; font-style: italic; }
.nav-links { display: flex; align-items: center; gap: 40px; list-style: none; }
.nav-links a { text-decoration: none; color: #2C2A26; font-size: 14px; position: relative; }
.nav-links a::after {
    content: ''; position: absolute; bottom: -4px; left: 0; width: 0; height: 1px;
    background-color: #2C2A26; transition: width 0.3s ease;
}
.nav-links a:hover::after, .nav-links a[aria-current="page"]::after { width: 100%; }
.lang-toggle-btn {
    background: transparent; border: 1px solid rgba(44,42,38,0.25); color: #2C2A26;
    padding: 6px 14px; border-radius: 20px; font-size: 12px; letter-spacing: 1px;
    cursor: pointer; font-family: inherit;
}
#mobile-lang-btn { display: none; padding: 5px 12px; }
.cta-button {
    display: inline-block; padding: 12px 28px; border: 1.5px solid #2C2A26;
    background-color: #2C2A26; color: #FAF8F5; font-size: 14px; cursor: pointer;
    transition: all 0.3s ease; font-family: 'Inter', sans-serif; font-weight: 500;
    letter-spacing: 0.5px; text-decoration: none;
}
.cta-button:hover { background-color: #FAF8F5; color: #2C2A26; box-shadow: 0 8px 24px rgba(44, 42, 38, 0.12); }
.hamburger { display: none; flex-direction: column; gap: 5px; cursor: pointer; padding: 8px; z-index: 1001; }
.hamburger span { width: 24px; height: 2px; background-color: #2C2A26; transition: all 0.3s ease; }
.hamburger.active span:nth-child(1) { transform: rotate(45deg) translate(5px, 5px); }
.hamburger.active span:nth-child(2) { opacity: 0; }
.hamburger.active span:nth-child(3) { transform: rotate(-45deg) translate(5px, -5px); }

/* 頁尾 */
footer { background-color: #2C2A26; color: #A39E97; padding: 80px; }
.footer-content { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 60px; margin-bottom: 60px; }
.footer-brand h3 { font-size: 18px; color: #FAF8F5; margin-bottom: 12px; font-weight: 600; font-family: 'Cantata One', serif; }
.footer-brand .subtitle { font-size: 11px; letter-spacing: 1px; color: #8B8680; margin-bottom: 16px; }
.footer-brand p { font-size: 13px; line-height: 1.6; color: #8B8680; }
.footer-section h4 { font-family: 'Inter', sans-serif; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; color: #FAF8F5; margin-bottom: 20px; font-weight: 600; }
.footer-section ul { list-style: none; }
.footer-section ul li { margin-bottom: 12px; }
.footer-section ul li a { color: #A39E97; text-decoration: none; font-size: 13px; transition: color 0.3s ease; }
.footer-section ul li a:hover { color: #FAF8F5; }
.footer-bottom {
    border-top: 1px solid rgba(250, 248, 245, 0.1); padding-top: 40px;
    display: flex; justify-content: space-between; align-items: center; font-size: 12px;
}
.footer-bottom p { color: #8B8680; }
.footer-socials { display: flex; gap: 20px; }
.footer-socials a { color: #A39E97; text-decoration: none; }
.footer-socials a:hover { color: #FAF8F5; }

/* 共用區塊 */
main { min-height: 60vh; }
.eyebrow { font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: #8B8680; }
.blog-hero { text-align: center; padding: 96px 24px 64px; }
.blog-hero h1 { font-size: 64px; letter-spacing: 2px; line-height: 1.1; margin: 12px 0 16px; }
.blog-hero p { font-size: 16px; color: #6B665F; }
.notice { text-align: center; padding: 40px 24px 120px; color: #6B665F; font-size: 15px; }
.notice a { display: inline-block; margin-top: 20px; }

/* 列表 */
.post-grid {
    display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 56px 40px;
    max-width: 1200px; margin: 0 auto; padding: 0 80px 120px;
}
.post-card { text-decoration: none; color: inherit; display: block; }
.post-card-cover { aspect-ratio: 4 / 3; overflow: hidden; background: #EFEBE5; margin-bottom: 20px; }
.post-card-cover img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.6s ease; }
.post-card:hover .post-card-cover img { transform: scale(1.04); }
.post-card .eyebrow { margin-bottom: 10px; display: block; }
.post-card h2 { font-size: 24px; line-height: 1.35; margin-bottom: 12px; }
.post-card p {
    font-size: 14px; color: #6B665F; line-height: 1.75; margin-bottom: 14px;
    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.post-card .read-more { font-size: 13px; letter-spacing: 0.5px; border-bottom: 1px solid #2C2A26; padding-bottom: 2px; }

/* 文章 */
.post { max-width: 760px; margin: 0 auto; padding: 56px 24px 0; }
.back-link { font-size: 13px; color: #8B8680; text-decoration: none; letter-spacing: 0.5px; }
.back-link:hover { color: #2C2A26; }
.post-header { text-align: center; margin: 48px 0 40px; }
.post-header h1 { font-size: 44px; line-height: 1.3; margin: 14px 0 18px; }
.post-meta { font-size: 13px; color: #8B8680; letter-spacing: 0.5px; }
.post-cover { max-width: 1040px; margin: 0 auto 56px; padding: 0 24px; }
.post-cover img { width: 100%; display: block; }
.post-body { font-size: 17px; line-height: 1.95; color: #3A3732; letter-spacing: 0.2px; }
.post-body > * + * { margin-top: 1.4em; }
.post-body h2 { font-size: 30px; line-height: 1.4; margin-top: 2.2em; color: #2C2A26; }
.post-body h3 { font-size: 23px; line-height: 1.45; margin-top: 1.8em; color: #2C2A26; }
.post-body a { text-decoration: underline; text-underline-offset: 3px; }
.post-body img { width: 100%; height: auto; display: block; }
.post-body blockquote {
    border-left: 1px solid #2C2A26; padding: 4px 0 4px 24px;
    font-family: 'Cormorant Garamond', Georgia, "PingFang TC", serif; font-size: 21px;
    font-style: italic; color: #2C2A26; line-height: 1.7;
}
.post-body ul, .post-body ol { padding-left: 1.4em; }
.post-body li + li { margin-top: 0.5em; }
.post-body iframe { width: 100%; height: auto; aspect-ratio: 16 / 9; border: 0; display: block; }
.post-cta {
    margin: 96px auto 120px; max-width: 760px; padding: 56px 24px 0;
    border-top: 1px solid rgba(44, 42, 38, 0.12); text-align: center;
}
.post-cta h2 { font-size: 30px; margin-bottom: 28px; }

/* 響應式（斷點與首頁相同） */
@media (max-width: 1024px) {
    .post-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 0 40px 100px; }
    .footer-content { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 768px) {
    nav { padding: 16px 24px; }
    #mobile-lang-btn { display: inline-block; margin-left: auto; margin-right: 6px; }
    .nav-links .lang-toggle-btn { display: none; }
    .hamburger { display: flex; }
    .nav-links {
        position: fixed; top: 60px; left: 0; right: 0; background-color: #FAF8F5;
        flex-direction: column; align-items: stretch; padding: 24px; gap: 0;
        border-bottom: 1px solid rgba(44, 42, 38, 0.08); display: none; z-index: 1000;
    }
    .nav-links.active { display: flex; }
    .nav-links > li { border-bottom: 1px solid rgba(44, 42, 38, 0.08); }
    .nav-links > li:last-child { border-bottom: none; }
    .nav-links a { display: block; padding: 16px 0; font-size: 16px; }
    .nav-links a::after { display: none; }
    .nav-links .cta-button { width: 100%; text-align: center; padding: 16px; margin-top: 8px; }
    footer { padding: 60px 24px; }
    .footer-bottom { flex-direction: column; gap: 16px; }
    .blog-hero { padding: 64px 20px 44px; }
    .blog-hero h1 { font-size: 48px; }
    .post-header h1 { font-size: 32px; }
    .post-body { font-size: 16px; }
    .post-cover { padding: 0; margin-bottom: 40px; }
}
@media (max-width: 640px) {
    nav { padding: 16px 20px; }
    .post-grid { grid-template-columns: minmax(0, 1fr); padding: 0 20px 80px; gap: 48px; }
    .footer-content { grid-template-columns: 1fr; }
}
`;

const POSTHOG = `!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys onSessionId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
posthog.init('phc_ouDRrx6CU24mFEBcGk5HV4tgGPV8dySaJ7Y4Fot8Qm2k', { api_host: 'https://us.i.posthog.com', person_profiles: 'identified_only', persistence: 'localStorage' });`;

/**
 * 組整頁 HTML。
 * opts: { title, description, canonical, ogImage, ogType, jsonLd, robots, body }
 * title/description 傳原始字串（這裡負責跳脫）；body 是已組好的 HTML。
 */
function renderPage(opts) {
    const title = escapeHtml(opts.title);
    const desc = escapeHtml(opts.description || '');
    const ogImage = escapeHtml(opts.ogImage || SITE + '/assets/images/og-cover.jpg');
    const canonical = opts.canonical ? escapeHtml(opts.canonical) : '';
    const jsonLd = opts.jsonLd
        ? `<script type="application/ld+json">${JSON.stringify(opts.jsonLd).replace(/</g, '\\u003c')}</script>`
        : '';

    return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<script src="/assets/js/meta-pixel.js"></script>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<link rel="icon" type="image/png" href="/assets/images/logo/favicon.png">
${desc ? `<meta name="description" content="${desc}">` : ''}
${canonical ? `<link rel="canonical" href="${canonical}">` : ''}
${opts.robots ? `<meta name="robots" content="${opts.robots}">` : ''}
<meta property="og:type" content="${opts.ogType || 'website'}">
<meta property="og:title" content="${title}">
${desc ? `<meta property="og:description" content="${desc}">` : ''}
<meta property="og:image" content="${ogImage}">
${canonical ? `<meta property="og:url" content="${canonical}">` : ''}
<meta property="og:locale" content="zh_TW">
<meta property="og:site_name" content="DUET by BCAG">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
${desc ? `<meta name="twitter:description" content="${desc}">` : ''}
<meta name="twitter:image" content="${ogImage}">
${jsonLd}
<script src="/assets/js/config.js"></script>
<script src="/assets/js/translations.js"></script>
<script>${POSTHOG}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cantata+One&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400;1,500&family=Inter:wght@300;400;500&family=Libre+Caslon+Text:ital@1&display=swap" rel="stylesheet">
<style>${STYLES}</style>
</head>
<body>
<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=2611432972696612&ev=PageView&noscript=1" /></noscript>
<nav>
    <a class="logo-container" href="/">
        <div class="logo">DUET</div>
        <div class="logo-subtitle">by BCAG</div>
    </a>
    <button class="lang-toggle-btn" id="mobile-lang-btn" onclick="window.toggleLanguage()">EN</button>
    <div class="hamburger" onclick="document.getElementById('navLinks').classList.toggle('active');this.classList.toggle('active');">
        <span></span><span></span><span></span>
    </div>
    <ul class="nav-links" id="navLinks">
        <li><a href="/#story" data-i18n="nav.story">品牌故事</a></li>
        <li><a href="/#process" data-i18n="nav.process">設計流程</a></li>
        <li><a href="/#gallery" data-i18n="nav.gallery">作品展示</a></li>
        <li><a href="/#faq" data-i18n="nav.faq">常見問題</a></li>
        <li><a href="/blog" data-i18n="nav.blog" aria-current="page">Blog</a></li>
        <li><a href="/order-tracker.html" data-i18n="nav.order">訂單查詢</a></li>
        <li><button class="lang-toggle-btn" onclick="window.toggleLanguage()">EN</button></li>
        <li><button class="cta-button" data-i18n="nav.start">免費開始設計</button></li>
    </ul>
</nav>

<main>
${opts.body}
</main>

<footer>
    <div class="footer-content">
        <div class="footer-brand">
            <h3>DUET</h3>
            <div class="subtitle">BY BCAG</div>
            <p data-i18n="footer.brand.body">為你的故事，鑄造永恆的交織。以數位精密工藝與傳統手作技藝，創造獨一無二的專屬珠寶。</p>
        </div>
        <div class="footer-section">
            <h4 data-i18n="footer.services">服務</h4>
            <ul>
                <li><a href="/design-studio" class="start-design-link" data-i18n="footer.svc1">開始設計</a></li>
                <li><a href="/order-tracker.html" data-i18n="footer.svc2">訂單查詢</a></li>
                <li><a href="#" data-i18n="footer.svc3">保固服務</a></li>
            </ul>
        </div>
        <div class="footer-section">
            <h4 data-i18n="footer.explore">探索</h4>
            <ul>
                <li><a href="/#story" data-i18n="footer.exp1">品牌故事</a></li>
                <li><a href="/#process" data-i18n="footer.exp2">設計流程</a></li>
                <li><a href="/#gallery" data-i18n="footer.exp3">作品展示</a></li>
                <li><a href="/blog" data-i18n="footer.exp4">Blog</a></li>
            </ul>
        </div>
        <div class="footer-section">
            <h4 data-i18n="footer.contact">聯絡</h4>
            <ul>
                <li><a href="mailto:service@brendonchen.com">service@brendonchen.com</a></li>
                <li><a href="https://www.instagram.com/duet_by_bcag/" target="_blank" rel="noopener">Instagram</a></li>
                <li><a href="https://www.threads.net/@duet_by_bcag" target="_blank" rel="noopener">Threads</a></li>
                <li><a href="https://www.facebook.com/profile.php?id=61589147812820" target="_blank" rel="noopener">Facebook</a></li>
                <li style="margin-top:16px;"><a href="https://lin.ee/7MW6Tjf" target="_blank" rel="noopener"><img src="https://scdn.line-apps.com/n/line_add_friends/btn/zh-Hant.png" alt="加入好友" height="30" style="opacity:0.85;display:block;"></a></li>
            </ul>
        </div>
    </div>
    <div class="footer-bottom">
        <p>© 2026 DUET by BCAG. All rights reserved.</p>
        <div class="footer-socials">
            <a href="/privacy.html" data-i18n="footer.privacy">隱私權政策</a>
            <a href="/terms.html" data-i18n="footer.terms">使用條款</a>
        </div>
    </div>
</footer>

<script>
(function () {
    // 開始設計：跟首頁一樣帶 env 參數，staging 網址才會接到 staging 後端
    function goDesign(e) {
        e.preventDefault();
        var env = window.CURRENT_ENV || 'production';
        window.location.href = '/design-studio.html?env=' + env;
    }
    document.querySelectorAll('.cta-button, .start-design-link').forEach(function (el) {
        el.addEventListener('click', goDesign);
    });
    if (typeof window.initLanguage === 'function') window.initLanguage();
})();
</script>
</body>
</html>`;
}

function setCache(res, kind) {
    // API 本身已有約 5 分鐘快取，這裡只多 60 秒，避免發布後等太久
    if (kind === 'error') res.setHeader('Cache-Control', 'no-store');
    else res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
}

module.exports = {
    SITE, API, PUBLICATION,
    escapeHtml, localMedia, fetchJson, postUrl, formatDate, sanitizeBody, renderPage, setCache,
};
