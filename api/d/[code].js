/**
 * DUET Content Pipeline — 分享頁（Phase 6）
 *
 * /d/<code>（見 vercel.json 的 rewrite）落在這支 serverless function，跟
 * CONTENT API 拿這個設計的公開資料（GET /share/<code>），組出含 per-design
 * OG 標籤（og:image 用 hero 圖、og:title 用兩個字母）的完整 HTML 直接回傳
 * ——不像規格原本設想的「edge function 注入 OG + 另外一個靜態殼」兩步，
 * 這裡直接一步做完，比較單純、少一個活動部件。
 *
 * 存取模型（規格 §5 Phase 6 review P1-10）：連結制（unlisted）。code 本身
 * 是 CSPRNG 產生，不可預測；撤下或不存在都回同一種「找不到」畫面，不讓人
 * 從回應差異分辨兩者。
 */

// 目前 CONTENT 只有一個 instance（原本叫 staging，尚未拆出獨立 production），
// 之後正式上線、CONTENT 有專屬網域時要記得更新這裡（跟 assets/js/config.js
// 的 STAGING_CONTENT_URL 是同一個東西，但那個是瀏覽器端 JS 讀不到，這裡是
// server-side function，需要自己的一份）。
const CONTENT_URL = 'https://duet-content-pipeline-staging.onrender.com';

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function notFoundPage() {
    return `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>找不到這個分享頁 | DUET</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    background:#0a0908; color:rgba(255,255,255,0.85); font-family:-apple-system,BlinkMacSystemFont,"PingFang TC","Microsoft JhengHei",sans-serif;
    text-align:center; padding:24px; }
  a { color:#d4af37; }
</style></head>
<body><div>
  <p style="font-size:18px;">這個分享頁不存在，或已經被收回了。</p>
  <p><a href="/">回到 DUET</a></p>
</div></body></html>`;
}

const DEFAULT_TAGLINE = '這是我設計的作品，你也想試試看嗎？';

function sharePage(data, code) {
    const letters = `${escapeHtml(data.letter1 || '').toUpperCase()} &amp; ${escapeHtml(data.letter2 || '').toUpperCase()}`;
    const heroUrl = escapeHtml(data.heroUrl || '');
    const videoUrl = escapeHtml(data.videoUrl || '');
    const tagline = escapeHtml(data.message || DEFAULT_TAGLINE);
    const pageTitle = `${letters} — DUET`;
    const ogDescription = '自選字母、字型、材質，設計專屬你的 DUET 客製墜飾。';

    return `<!doctype html>
<html lang="zh-Hant"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${pageTitle}</title>
<meta property="og:type" content="website">
<meta property="og:title" content="${pageTitle}">
<meta property="og:description" content="${ogDescription}">
${heroUrl ? `<meta property="og:image" content="${heroUrl}">` : ''}
<meta name="robots" content="noindex">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cantata+One&family=Libre+Caslon+Text:ital@1&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; color: rgba(255,255,255,0.92);
    font-family: -apple-system, BlinkMacSystemFont, "PingFang TC", "Microsoft JhengHei", sans-serif;
    background: #0a0908 url('/assets/images/backgrounds/Toscana.png') center/cover no-repeat fixed;
    display: flex; align-items: center; justify-content: center; padding: 24px;
  }
  .brand-logo {
    position: fixed; top: 20px; left: 20px; z-index: 1;
    display: flex; align-items: baseline; gap: 6px;
  }
  .brand-logo .logo {
    font-size: 16px; font-weight: 600; letter-spacing: 1.5px;
    font-family: 'Cantata One', serif; color: rgba(255,255,255,0.92);
  }
  .brand-logo .logo-subtitle {
    font-size: 9px; letter-spacing: 0.5px; color: rgba(255,255,255,0.5);
    font-family: 'Libre Caslon Text', serif; font-style: italic;
  }
  .card {
    width: 100%; max-width: 420px;
    background: rgba(10, 9, 8, 0.72);
    border: 1px solid rgba(212, 175, 55, 0.35);
    border-radius: 20px;
    backdrop-filter: blur(14px) saturate(120%);
    -webkit-backdrop-filter: blur(14px) saturate(120%);
    box-shadow: 0 8px 40px 0 rgba(0,0,0,0.5);
    padding: 24px;
    text-align: center;
  }
  video, .poster-img {
    width: 100%; border-radius: 14px; display: block; background: #000;
    aspect-ratio: 9 / 16; object-fit: cover;
  }
  h1 {
    font-size: 28px; font-weight: 500; letter-spacing: 2px; margin: 20px 0 8px;
    color: #fff;
  }
  .tagline-row {
    display: flex; align-items: center; justify-content: center; gap: 6px;
    margin: 0 0 4px;
  }
  .tagline {
    font-size: 14px; color: rgba(255,255,255,0.65);
    letter-spacing: 0.3px; margin: 0;
  }
  .tagline-edit-btn {
    background: none; border: none; color: rgba(255,255,255,0.55);
    font-size: 19px; cursor: pointer; padding: 4px 6px; line-height: 1;
    display: inline-block; transform: scaleX(-1); /* 筆尖預設朝右，鏡射成朝左 */
  }
  .tagline-edit-btn:hover { color: rgba(212,175,55,0.9); }
  .tagline-input {
    width: 100%; font-size: 14px; color: #fff; letter-spacing: 0.3px;
    background: rgba(255,255,255,0.06); border: 1px solid rgba(212,175,55,0.5);
    border-radius: 8px; padding: 6px 10px; text-align: center;
    font-family: inherit;
  }
  .cta-primary {
    display: block; width: 100%; margin-top: 20px; padding: 14px 20px;
    background: linear-gradient(135deg, #d4af37 0%, #aa8a2e 100%);
    color: #0a0908; font-size: 15px; font-weight: 600; letter-spacing: 0.5px;
    border: none; border-radius: 12px; text-decoration: none; cursor: pointer;
  }
  .secondary-row {
    display: flex; gap: 10px; margin-top: 12px;
  }
  .cta-secondary {
    flex: 1; padding: 11px 12px; font-size: 13px;
    background: rgba(255,255,255,0.03); color: rgba(255,255,255,0.85);
    border: 1px solid rgba(212,175,55,0.4); border-radius: 10px;
    text-decoration: none; cursor: pointer;
  }

</style>
</head>
<body>
  <div class="brand-logo"><span class="logo">DUET</span><span class="logo-subtitle">by BCAG</span></div>
  <div class="card">
    ${videoUrl
        ? `<video id="hero-video" poster="${heroUrl}" preload="none" controls playsinline src="${videoUrl}" class="poster-img"></video>`
        : (heroUrl ? `<img src="${heroUrl}" class="poster-img" alt="">` : '')}
    <h1>${letters}</h1>
    <div class="tagline-row">
      <p class="tagline" id="tagline">${tagline}</p>
      <button class="tagline-edit-btn" id="tagline-edit-btn" type="button" title="編輯這句話">✎</button>
    </div>
    <a class="cta-primary" href="/">設計你自己的 DUET</a>
    <div class="secondary-row">
      <button class="cta-secondary" id="download-btn" type="button" data-url="${videoUrl || heroUrl}" data-ext="${videoUrl ? 'mp4' : 'jpg'}">下載影片</button>
      <button class="cta-secondary" id="share-page-btn" type="button">分享這個頁面</button>
    </div>
  </div>
  <script>
    // 影片存在跟這個頁面不同網域（Supabase），純用 <a download> 在跨網域
    // 情況下不保證會真的跳出存檔對話框，很多瀏覽器會直接當成一般連結
    // 開啟播放。改成用 fetch 把檔案抓成 blob，再用「同網域」的 blob: 網址
    // 觸發下載——瀏覽器對 blob: 網址的 download 屬性才會確實遵守。
    document.getElementById('download-btn').addEventListener('click', function () {
      var btn = this;
      var original = btn.textContent;
      var url = btn.getAttribute('data-url');
      var ext = btn.getAttribute('data-ext');
      if (!url) return;
      btn.textContent = '下載中…';
      fetch(url)
        .then(function (res) { return res.blob(); })
        .then(function (blob) {
          var blobUrl = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = blobUrl;
          a.download = 'duet.' + ext;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(function () { URL.revokeObjectURL(blobUrl); }, 30000);
          btn.textContent = original;
        })
        .catch(function () {
          btn.textContent = '下載失敗，請重試';
          setTimeout(function () { btn.textContent = original; }, 2200);
        });
    });

    // 分享者自己編輯 tagline 那句話：點鉛筆變成輸入框，Enter/失焦存檔，
    // Esc 取消。存檔用的是 code 本身當驗證（跟撤下同一個信任模型），
    // 誰都能改，但只有拿到連結的人知道 code。
    document.getElementById('tagline-edit-btn').addEventListener('click', function () {
      var p = document.getElementById('tagline');
      var row = p.parentElement;
      var currentText = p.textContent;
      var input = document.createElement('input');
      input.className = 'tagline-input';
      input.value = currentText;
      input.maxLength = 80;
      row.replaceChild(input, p);
      this.style.display = 'none';
      var editBtn = this;

      function finishEdit(save) {
        var newText = input.value.trim();
        var newP = document.createElement('p');
        newP.className = 'tagline';
        newP.id = 'tagline';
        newP.textContent = save && newText ? newText : currentText;
        row.replaceChild(newP, input);
        editBtn.style.display = '';
        if (save && newText && newText !== currentText) {
          fetch('${CONTENT_URL}/share/${escapeHtml(code)}/message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: newText }),
          }).catch(function () {});
        }
      }

      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); finishEdit(true); }
        if (e.key === 'Escape') { finishEdit(false); }
      });
      input.addEventListener('blur', function () { finishEdit(true); });
      input.focus();
      input.select();
    });

    document.getElementById('share-page-btn').addEventListener('click', function () {
      var btn = this;
      var original = btn.textContent;
      (navigator.clipboard ? navigator.clipboard.writeText(location.href) : Promise.reject())
        .then(function () { btn.textContent = '連結已複製'; })
        .catch(function () { btn.textContent = '複製失敗，請手動複製網址'; })
        .then(function () { setTimeout(function () { btn.textContent = original; }, 2200); });
    });
  </script>
</body></html>`;
}

module.exports = async function handler(req, res) {
    const code = req.query.code;
    if (!code) {
        res.status(400).send('missing code');
        return;
    }

    let data = null;
    try {
        const resp = await fetch(`${CONTENT_URL}/share/${encodeURIComponent(code)}`);
        if (resp.ok) {
            const json = await resp.json();
            if (json && json.success) data = json;
        }
    } catch (e) {
        // CONTENT 打不到，跟「這個 code 真的不存在」用同一種畫面呈現，
        // 對訪客來說沒有差別，不需要另外分兩種錯誤畫面。
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');

    if (!data) {
        res.status(404).send(notFoundPage());
        return;
    }
    res.status(200).send(sharePage(data, code));
};
