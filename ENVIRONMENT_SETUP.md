# 環境變量設置指南（後端代理版）

本專案已改為 **後端代理** 方式呼叫 Gemini：  
前端 `wearing-preview.js` **不再持有** Gemini API key，而是呼叫後端 `BACKEND_URL` 的 `/api/tryon`。

---

## 架構說明（為什麼這樣才安全）

- **前端（GitHub Pages）**：只呼叫你的後端 `https://...onrender.com/api/tryon`
- **後端（Render）**：從環境變量讀 `GEMINI_API_KEY`，再去呼叫 Google Gemini

✅ 結果：**API key 不會出現在前端原始碼、也不會出現在瀏覽器 Network**（因為是後端代為呼叫）

---

## Render 設置（必做）

在 Render 的後端服務（你的 `duet-backend-...`）設定環境變量：

1. Render Dashboard → 選你的 service
2. 左側 **Environment**
3. **Add Environment Variable**
4. 新增：
   - **Key**：`GEMINI_API_KEY`
   - **Value**：你的 Gemini API key（請勿貼進 GitHub / 前端檔案）
5. 重新部署（Deploy / Restart）

---

## 本地開發（可選）

本地跑後端時，設定環境變量：

```bash
export GEMINI_API_KEY="YOUR_GEMINI_API_KEY_HERE"
```

---

## GitHub Pages 設定（你問的那題）

因為 key 不再需要 GitHub Secrets / GitHub Actions 生成檔案，所以：

- **GitHub Pages 建議改回**：`Deploy from a branch`（通常選 `main` + `/root`）
- 你先前在 GitHub 設的 `GEMINI_API_KEY` secret：**可以刪除或保留**，但這套後端代理架構下不再使用

---

## 重要安全提醒

如果你的 Gemini key 曾經出現在 GitHub commit / 前端檔案或對外對話內容中，請視為已外洩：

1. 立即在 Google AI Studio **撤銷舊 key、建立新 key**
2. 新 key 只放在 Render 的 `GEMINI_API_KEY`
