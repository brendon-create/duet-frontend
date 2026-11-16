/**
 * DUET Blog 列表頁 /blog（vercel.json rewrite → 這支）
 * 每次請求向 BCCT 公開 API 抓已發布文章，伺服器端組好整頁 HTML。
 */
const { SITE, API, PUBLICATION, escapeHtml, localMedia, fetchJson, postUrl, formatDate, renderPage, setCache } = require('../_blog-shared');

function card(p) {
    const cover = p.cover_image_url
        ? `<div class="post-card-cover"><img src="${escapeHtml(localMedia(p.cover_image_url))}" alt="${escapeHtml(p.title)}" loading="lazy"></div>`
        : '';
    const meta = [p.tag, formatDate(p.published_at)].filter(Boolean).map(escapeHtml).join(' · ');
    return `<a class="post-card" href="${escapeHtml(postUrl(p.slug))}" lang="zh-TW">
    ${cover}
    ${meta ? `<span class="eyebrow">${meta}</span>` : ''}
    <h2>${escapeHtml(p.title)}</h2>
    ${p.excerpt ? `<p>${escapeHtml(p.excerpt)}</p>` : ''}
    <span class="read-more" data-i18n="blog.readMore">閱讀全文</span>
</a>`;
}

module.exports = async function handler(req, res) {
    const { status, data } = await fetchJson(`${API}/publications/${PUBLICATION}/posts`);
    const posts = (data && Array.isArray(data.posts)) ? data.posts : null;

    const hero = `<section class="blog-hero">
    <div class="eyebrow">DUET Journal</div>
    <h1>Blog</h1>
    <p data-i18n="blog.subtitle">關於字母、設計，與兩個人的故事</p>
</section>`;

    let content;
    if (!posts) {
        content = `<div class="notice" data-i18n="blog.error">文章暫時無法載入，請稍後再試。</div>`;
    } else if (posts.length === 0) {
        content = `<div class="notice" data-i18n="blog.empty">第一篇文章正在準備中，敬請期待。</div>`;
    } else {
        content = `<section class="post-grid">${posts.map(card).join('\n')}</section>`;
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    setCache(res, posts ? 'ok' : 'error');
    res.status(posts ? 200 : (status === 0 ? 503 : 502)).send(renderPage({
        title: 'Blog — DUET by BCAG',
        description: 'DUET 的設計故事、字母靈感與客製墜飾背後的工藝。',
        canonical: `${SITE}/blog`,
        body: hero + content,
    }));
};
