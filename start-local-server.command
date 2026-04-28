#!/bin/bash
# DUET 本機伺服器啟動腳本
# 雙擊此檔案即可執行

# 切換到此腳本所在目錄（即 frontend/ 資料夾）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "=================================="
echo "  DUET 本機伺服器"
echo "=================================="
echo ""
echo "目錄：$SCRIPT_DIR"
echo "啟動伺服器於 port 8080..."
echo ""

# 先在背景啟動伺服器
python3 -m http.server 8080 &
SERVER_PID=$!

# 等伺服器就緒
sleep 1.5

# 確認伺服器已啟動
if kill -0 $SERVER_PID 2>/dev/null; then
    echo "✅ 伺服器已啟動！PID: $SERVER_PID"
    echo ""
    echo "請在瀏覽器開啟："
    echo "  http://localhost:8080/hero-video-generator.html"
    echo "  http://localhost:8080/index.html"
    echo ""
    echo "（正在自動開啟瀏覽器...）"
    echo ""
    # 開啟瀏覽器
    open "http://localhost:8080/hero-video-generator.html"
else
    echo "❌ 伺服器啟動失敗，請確認 port 8080 沒有被其他程式佔用。"
fi

echo "按 Ctrl+C 停止伺服器"
echo ""

# 等待伺服器結束（按 Ctrl+C 時停止）
wait $SERVER_PID
