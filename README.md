# DUET 客製化首飾 - 前端介面

這是 DUET 系列客製化首飾的前端介面，使用 GitHub Pages 託管。

## 網站結構

- `index.html` - DUET 主頁面（AI 諮詢、字體選擇、3D 預覽）
- `design-concept.html` - 設計理念展示頁面

## 技術棧

- **Three.js** - 3D 渲染引擎
- **Claude AI** - AI 諮詢對話
- **後端 API** - https://duet-backend-wlw8.onrender.com

## 部署

本專案透過 GitHub Pages 自動部署到：
- **開發環境**: https://brendon-create.github.io/duet-frontend/
- **正式環境**: https://duet.brendonchen.com

## 本地開發

```bash
# 使用任何靜態伺服器即可
python3 -m http.server 8000
# 或
npx serve
```

然後訪問 http://localhost:8000

## 注意事項

- 本 Repository 為 Public（GitHub Pages Free Plan 要求）
- 敏感資訊（API Keys、憑證）皆存放於後端 Private Repository
- 前端僅包含公開的 HTML/CSS/JavaScript

## License

**Copyright © 2025 Brendon Chen. All rights reserved.**

This code is proprietary and confidential. It is made publicly available for 
transparency and portfolio purposes only. No permission is granted to use, copy, 
modify, or distribute this software.

For licensing inquiries: brendon.chen@mac.com
