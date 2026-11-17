/**
 * DUET Blog 文章頁 /blog/<slug>、/blog/<slug>?lang=en（vercel.json rewrite → 這支）
 * - slug 可能是中文；不存在的 slug 回真正的 404
 * - 英文版還沒翻譯好（API 回 404）但中文版存在 → 302 轉回中文網址
 */
const { SITE, API, PUBLICATION, T, getLang, withLang, escapeHtml, localMedia, fetchJson, postUrl, formatDate, sanitizeBody, renderPage, setCache } = require('../_blog-shared');

function decodeSlug(raw) {
    try { return decodeURIComponent(raw); } catch (e) { return raw; }
}

function fetchPost(slug, lang) {
    return fetchJson(`${API}/posts/${encodeURIComponent(slug)}?publication=${PUBLICATION}${lang === 'en' ? '&lang=en' : ''}`);
}

function messagePage(res, lang, httpStatus, key) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    setCache(res, httpStatus === 404 ? 'ok' : 'error');
    res.status(httpStatus).send(renderPage({
        lang,
        title: 'Blog — DUET by BCAG',
        robots: 'noindex',
        body: `<section class="blog-hero"><div class="eyebrow">DUET Journal</div><h1>Blog</h1></section>
<div class="notice">${escapeHtml(T(lang, key))}<br><a href="${withLang('/blog', lang)}" class="cta-button">${escapeHtml(T(lang, 'blog.backToBlog'))}</a></div>`,
    }));
}

module.exports = async function handler(req, res) {
    const lang = getLang(req);
    const slug = decodeSlug(String(req.query.slug || ''));
    if (!slug) return messagePage(res, lang, 404, 'blog.notFound');

    let p, hasEn;
    if (lang === 'en') {
        const en = await fetchPost(slug, 'en');
        if (!en.data || !en.data.post) {
            if (en.status !== 404) return messagePage(res, lang, 503, 'blog.error');
            const zh = await fetchPost(slug, 'zh');
            if (zh.data && zh.data.post) {
                // 英文版還沒翻好，先看中文
                setCache(res, 'ok');
                res.setHeader('Location', postUrl(slug));
                res.status(302).end();
                return;
            }
            return messagePage(res, lang, zh.status === 404 ? 404 : 503, zh.status === 404 ? 'blog.notFound' : 'blog.error');
        }
        p = en.data.post;
        hasEn = true;
    } else {
        // 同時查英文版，有翻好才輸出 hreflang，不多花等待時間
        const [zh, en] = await Promise.all([fetchPost(slug, 'zh'), fetchPost(slug, 'en')]);
        if (!zh.data || !zh.data.post) {
            return messagePage(res, lang, zh.status === 404 ? 404 : 503, zh.status === 404 ? 'blog.notFound' : 'blog.error');
        }
        p = zh.data.post;
        hasEn = !!(en.data && en.data.post);
    }

    const zhUrl = SITE + postUrl(p.slug || slug);
    const enUrl = zhUrl + '?lang=en';
    const url = lang === 'en' ? enUrl : zhUrl;
    const title = p.seo_title || p.title;
    const description = p.seo_description || p.excerpt || '';
    const meta = [p.tag, formatDate(p.published_at, lang), p.author_name].filter(Boolean).map(escapeHtml).join(' · ');

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
        inLanguage: lang === 'en' ? 'en' : 'zh-TW',
    };

    const body = `<article>
<div class="post">
    <a class="back-link" href="${withLang('/blog', lang)}">${escapeHtml(T(lang, 'blog.back'))}</a>
    <header class="post-header">
        ${meta ? `<div class="post-meta">${meta}</div>` : ''}
        <h1>${escapeHtml(p.title)}</h1>
        ${lang === 'en' ? `<p class="ai-note">${escapeHtml(T('en', 'blog.aiNote'))}</p>` : ''}
    </header>
</div>
${p.cover_image_url ? `<div class="post-cover"><img src="${escapeHtml(localMedia(p.cover_image_url))}" alt="${escapeHtml(p.title)}"></div>` : ''}
<div class="post">
    <div class="post-body">${sanitizeBody(p.body_markdown)}</div>
</div>
</article>
<section class="post-cta">
    <h2>${escapeHtml(T(lang, 'blog.ctaTitle'))}</h2>
    <button class="cta-button">${escapeHtml(T(lang, 'nav.start'))}</button>
</section>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    setCache(res, 'ok');
    res.status(200).send(renderPage({
        lang,
        title: `${title} | DUET`,
        description,
        canonical: url,
        alternates: hasEn ? { zh: zhUrl, en: enUrl } : null,
        // 英文版還沒翻好時按 EN 也沒關係：英文網址會 302 回中文
        switchHref: withLang(postUrl(p.slug || slug), lang === 'en' ? 'zh' : 'en'),
        ogType: 'article',
        ogImage: p.cover_image_url,
        jsonLd,
        body,
    }));
};
