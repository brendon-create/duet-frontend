/**
 * DUET Blog sitemap /blog/sitemap.xml（vercel.json rewrite → 這支）
 * 每篇已發布文章動態列出；robots.txt 有指向這裡。
 */
const { SITE, API, PUBLICATION, escapeHtml, fetchJson, postUrl, setCache } = require('./_blog-shared');

module.exports = async function handler(req, res) {
    const { data } = await fetchJson(`${API}/publications/${PUBLICATION}/posts`);
    if (!data || !Array.isArray(data.posts)) {
        setCache(res, 'error');
        res.status(503).send('blog sitemap temporarily unavailable');
        return;
    }

    const urls = [`  <url><loc>${SITE}/blog</loc><changefreq>weekly</changefreq></url>`].concat(
        data.posts.map(p => {
            const lastmod = p.published_at ? `<lastmod>${escapeHtml(p.published_at.slice(0, 10))}</lastmod>` : '';
            return `  <url><loc>${escapeHtml(SITE + postUrl(p.slug))}</loc>${lastmod}</url>`;
        })
    );

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    setCache(res, 'ok');
    res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`);
};
