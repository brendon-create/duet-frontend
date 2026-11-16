/**
 * DUET Blog 文章頁 /blog/<slug>（vercel.json rewrite → 這支）
 * slug 可能是中文；不存在的 slug 回真正的 404。
 */
const { SITE, API, PUBLICATION, escapeHtml, localMedia, fetchJson, formatDate, sanitizeBody, renderPage, setCache } = require('../_blog-shared');

function decodeSlug(raw) {
    try { return decodeURIComponent(raw); } catch (e) { return raw; }
}

function messagePage(res, httpStatus, i18nKey, text) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    setCache(res, httpStatus === 404 ? 'ok' : 'error');
    res.status(httpStatus).send(renderPage({
        title: 'Blog — DUET by BCAG',
        robots: 'noindex',
        body: `<section class="blog-hero"><div class="eyebrow">DUET Journal</div><h1>Blog</h1></section>
<div class="notice"><span data-i18n="${i18nKey}">${text}</span><br><a href="/blog" class="cta-button" data-i18n="blog.backToBlog">回到 Blog</a></div>`,
    }));
}

module.exports = async function handler(req, res) {
    const slug = decodeSlug(String(req.query.slug || ''));
    if (!slug) return messagePage(res, 404, 'blog.notFound', '找不到這篇文章，可能已經下架或網址有誤。');

    const { status, data } = await fetchJson(
        `${API}/posts/${encodeURIComponent(slug)}?publication=${PUBLICATION}`
    );
    const p = data && data.post;
    if (!p) {
        if (status === 404) return messagePage(res, 404, 'blog.notFound', '找不到這篇文章，可能已經下架或網址有誤。');
        return messagePage(res, 503, 'blog.error', '文章暫時無法載入，請稍後再試。');
    }

    const url = `${SITE}/blog/${encodeURIComponent(p.slug || slug)}`;
    const title = p.seo_title || p.title;
    const description = p.seo_description || p.excerpt || '';
    const date = formatDate(p.published_at);
    const meta = [p.tag, date, p.author_name].filter(Boolean).map(escapeHtml).join(' · ');

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: p.title,
        description,
        image: p.cover_image_url || undefined,
        datePublished: p.published_at || undefined,
        author: p.author_name ? { '@type': 'Person', name: p.author_name } : undefined,
        publisher: {
            '@type': 'Organization',
            name: 'DUET by BCAG',
            logo: { '@type': 'ImageObject', url: `${SITE}/assets/images/logo/favicon.png` },
        },
        mainEntityOfPage: url,
        inLanguage: 'zh-TW',
    };

    const body = `<article lang="zh-TW">
<div class="post">
    <a class="back-link" href="/blog" data-i18n="blog.back">← 所有文章</a>
    <header class="post-header">
        ${meta ? `<div class="post-meta">${meta}</div>` : ''}
        <h1>${escapeHtml(p.title)}</h1>
    </header>
</div>
${p.cover_image_url ? `<div class="post-cover"><img src="${escapeHtml(localMedia(p.cover_image_url))}" alt="${escapeHtml(p.title)}"></div>` : ''}
<div class="post">
    <div class="post-body">${sanitizeBody(p.body_markdown)}</div>
</div>
</article>
<section class="post-cta">
    <h2 data-i18n="blog.ctaTitle">把你們的故事，交織成一件作品</h2>
    <button class="cta-button" data-i18n="nav.start">免費開始設計</button>
</section>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    setCache(res, 'ok');
    res.status(200).send(renderPage({
        title: `${title} | DUET`,
        description,
        canonical: url,
        ogType: 'article',
        ogImage: p.cover_image_url,
        jsonLd,
        body,
    }));
};
