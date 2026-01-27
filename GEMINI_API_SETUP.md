# Gemini API 設置指南

## 取得 API Key

1. 前往 [Google AI Studio](https://aistudio.google.com/apikey)
2. 登入您的 Google 帳號
3. 點擊「Get API Key」
4. 複製產生的 API Key

## 設置 API Key（後端代理版）

本專案已改為 **後端代理**：前端不再持有 API key，改由 Render 後端在伺服器端呼叫 Gemini。

### Render 設定（必做）

1. Render Dashboard → 選你的後端 service（`duet-backend-...`）
2. 左側 **Environment**
3. 新增環境變量：
   - **Key**：`GEMINI_API_KEY`
   - **Value**：你的 Gemini API key
4. 重新部署（Deploy / Restart）

完成後，前端 `wearing-preview.js` 會呼叫 `BACKEND_URL/api/tryon`，由後端代為呼叫 Gemini。

## 安全注意事項

⚠️ **重要**：API Key 是敏感資訊，請勿提交到公開的 Git 儲存庫。

✅ 建議做法：
- **只放在後端環境變量**（Render 的 `GEMINI_API_KEY`）
- 如曾經出現在 GitHub commit / 前端檔案 / 對外對話內容中，請立即撤銷舊 key 並建立新 key

## 功能說明

設置完成後，佩戴模擬功能將：
- 自動捕獲 3D 墜子渲染圖
- 使用 Gemini AI 將墜子合成到模特照片上
- 生成逼真的項鍊鏈條和光影效果
- 支持三種視角切換（半身、鎖骨、特寫）
- 支持上傳自己的照片

## 測試

1. 設置 API Key 後重新載入頁面
2. 在左側控制面板完成商品設計
3. 點擊「Generate」生成 3D 模型
4. 右側佩戴模擬區域將自動顯示 AI 合成的佩戴效果

## 疑難排解

如果遇到問題，請查看瀏覽器 Console：
- `❌ tryon 服務回應失敗` - 後端沒有設置 `GEMINI_API_KEY` 或後端無法連線到 Google
- `❌ AI 合成失敗` - 檢查網路連接和 API Key 是否有效
- `⚠️ 等待商品生成` - 需先生成 3D 模型
