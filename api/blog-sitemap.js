/**
 * DUET Blog sitemap /blog/sitemap.xml（vercel.json rewrite → 這支）
 * 每篇已發布文章動態列出；英文網址只列已經翻譯好的文章。robots.txt 有指向這裡。
 */
const { SITE, API, PUBLICATION, escapeHtml, fetchJson, postUrl, setCache } = require('./_blog-shared');

function entry(loc, publishedAt) {
    const lastmod = publishedAt ? `<lastmod>${escapeHtml(publishedAt.slice(0, 10))}</lastmod>` : '';
    return `  <url><loc>${escapeHtml(loc)}</loc>${lastmod}</url>`;
}

module.exports = async function handler(req, res) {
    const [zh, en] = await Promise.all([
        fetchJson(`${API}/publications/${PUBLICATION}/posts`),
        fetchJson(`${API}/publications/${PUBLICATION}/posts?lang=en`),
    ]);
    if (!zh.data || !Array.isArray(zh.data.posts)) {
        setCache(res, 'error');
        res.status(503).send('blog sitemap temporarily unavailable');
        return;
    }
    // 英文列表抓不到時只列中文，不影響中文網址被收錄
    const enPosts = (en.data && Array.isArray(en.data.posts)) ? en.data.posts : [];

    const urls = [
        `  <url><loc>${SITE}/blog</loc><changefreq>weekly</changefreq></url>`,
        `  <url><loc>${SITE}/blog?lang=en</loc><changefreq>weekly</changefreq></url>`,
        ...zh.data.posts.map(p => entry(SITE + postUrl(p.slug), p.published_at)),
        ...enPosts.map(p => entry(SITE + postUrl(p.slug) + '?lang=en', p.published_at)),
    ];

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    setCache(res, 'ok');
    res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`);
};
