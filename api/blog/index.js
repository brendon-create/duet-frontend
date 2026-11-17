/**
 * DUET Blog 列表頁 /blog、/blog?lang=en（vercel.json rewrite → 這支）
 * 每次請求向 BCCT 公開 API 抓已發布文章，伺服器端組好整頁 HTML。
 * 英文列表只會有已經翻譯好的文章（API 端就過濾掉了）。
 */
const { SITE, API, PUBLICATION, T, getLang, withLang, escapeHtml, localMedia, fetchJson, postUrl, formatDate, renderPage, setCache } = require('../_blog-shared');

function card(p, lang) {
    const cover = p.cover_image_url
        ? `<div class="post-card-cover"><img src="${escapeHtml(localMedia(p.cover_image_url))}" alt="${escapeHtml(p.title)}" loading="lazy"></div>`
        : '';
    const meta = [p.tag, formatDate(p.published_at, lang)].filter(Boolean).map(escapeHtml).join(' · ');
    return `<a class="post-card" href="${escapeHtml(withLang(postUrl(p.slug), lang))}">
    ${cover}
    ${meta ? `<span class="eyebrow">${meta}</span>` : ''}
    <h2>${escapeHtml(p.title)}</h2>
    ${p.excerpt ? `<p>${escapeHtml(p.excerpt)}</p>` : ''}
    <span class="read-more">${escapeHtml(T(lang, 'blog.readMore'))}</span>
</a>`;
}

module.exports = async function handler(req, res) {
    const lang = getLang(req);
    const { status, data } = await fetchJson(
        `${API}/publications/${PUBLICATION}/posts${lang === 'en' ? '?lang=en' : ''}`
    );
    const posts = (data && Array.isArray(data.posts)) ? data.posts : null;

    const hero = `<section class="blog-hero">
    <div class="eyebrow">DUET Journal</div>
    <h1>Blog</h1>
    <p>${escapeHtml(T(lang, 'blog.subtitle'))}</p>
</section>`;

    let content;
    if (!posts) {
        content = `<div class="notice">${escapeHtml(T(lang, 'blog.error'))}</div>`;
    } else if (posts.length === 0) {
        content = `<div class="notice">${escapeHtml(T(lang, 'blog.empty'))}</div>`;
    } else {
        content = `<section class="post-grid">${posts.map(p => card(p, lang)).join('\n')}</section>`;
    }

    const alternates = { zh: `${SITE}/blog`, en: `${SITE}/blog?lang=en` };
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    setCache(res, posts ? 'ok' : 'error');
    res.status(posts ? 200 : (status === 0 ? 503 : 502)).send(renderPage({
        lang,
        title: 'Blog — DUET by BCAG',
        description: T(lang, 'blog.metaDesc'),
        canonical: alternates[lang],
        alternates,
        switchHref: withLang('/blog', lang === 'en' ? 'zh' : 'en'),
        body: hero + content,
    }));
};
