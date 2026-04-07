#!/usr/bin/env python3
"""
字體同步腳本 - 從 esm.sh 獲取 typeface.json 並存儲到本地

使用方法：
    python font_sync.py              # 下載所有字體
    python font_sync.py Arial         # 下載特定字體
"""

import os
import json
import requests
import time
import sys
from pathlib import Path
import urllib.parse

# 設定
BASE_DIR = Path(__file__).parent.parent
FONTS_DIR = BASE_DIR / "frontend/assets/fonts/typeface"
FONTS_JSON = BASE_DIR / "frontend/fonts.json"
MAX_RETRIES = 3

def load_fonts_list():
    """載入字體清單"""
    with open(FONTS_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("fonts", [])

def download_typeface_json(font_name):
    """從 esm.sh 下載 typeface.json"""
    # 標準化字體名稱
    font_key = font_name.lower().replace(" ", "-")
    
    # esm.sh URL（可能需要處理版本號重定向）
    urls = [
        f"https://esm.sh/@compai/font-{font_key}/data/typefaces/normal-400.json",
    ]
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }
    
    session = requests.Session()
    session.headers.update(headers)
    
    for url in urls:
        try:
            print(f"  📥 嘗試: {url}")
            response = session.get(url, timeout=30, allow_redirects=True)
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    print(f"  ✅ JSON 解析成功")
                    return data
                except:
                    print(f"  ⚠️ 不是有效 JSON")
                    continue
            elif response.status_code == 302:
                # 處理重定向
                redirect_url = response.headers.get("Location")
                if redirect_url:
                    print(f"  🔀 重定向到: {redirect_url}")
                    response = session.get(redirect_url, timeout=30)
                    if response.status_code == 200:
                        try:
                            data = response.json()
                            return data
                        except:
                            continue
            else:
                print(f"  ⚠️ HTTP {response.status_code}")
                
        except Exception as e:
            print(f"  ❌ 錯誤: {e}")
            continue
    
    return None

def sync_font(font_name):
    """同步單一字體"""
    print(f"\n{'='*50}")
    print(f"🔄 同步字體: {font_name}")
    print(f"{'='*50}")
    
    # 輸出路徑（空格轉為底線）
    json_path = FONTS_DIR / f"{font_name.replace(' ', '_')}.json"
    
    # 檢查是否已存在
    if json_path.exists():
        print(f"⏭️  已存在，跳過: {font_name}")
        return True
    
    # 下載
    data = download_typeface_json(font_name)
    
    if data:
        # 確保目錄存在
        FONTS_DIR.mkdir(parents=True, exist_ok=True)
        
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        
        print(f"✅ 已保存: {json_path}")
        return True
    else:
        print(f"❌ 無法下載: {font_name}")
        return False

# 問題字體清單（需要多种来源）
PROBLEM_FONTS = [
    "Cherry Bomb One",
    "Foldit",
    "Aoboshi One",
    "ADLaM Display",
    "Young Serif",
    # 添加更多已知问题字体
]

def download_with_fallbacks(font_name):
    """使用多种来源下载字體"""
    # 标准化
    font_key = font_name.lower().replace(" ", "-")
    font_key_space = font_name.replace(" ", "%20")
    
    # 多个 CDN 来源
    sources = [
        # esm.sh (@compai)
        f"https://esm.sh/@compai/font-{font_key}/data/typefaces/normal-400.json",
        # jsdelivr (components-ai)
        f"https://cdn.jsdelivr.net/gh/components-ai/typefaces/packages/{font_key}/data/typefaces/normal-400.json",
        # jsdelivr (emreacar)
        f"https://cdn.jsdelivr.net/gh/emreacar/google-fonts-as-json/fonts/{font_key_space}/regular.json",
        # jsdelivr 另一个
        f"https://cdn.jsdelivr.net/gh/emreacar/google-fonts-as-json/fonts/{font_name}/regular.json",
    ]
    
    headers = {"User-Agent": "Mozilla/5.0"}
    session = requests.Session()
    session.headers.update(headers)
    
    for url in sources:
        try:
            print(f"  📥 嘗試: {url[:60]}...")
            response = session.get(url, timeout=20, allow_redirects=True)
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    print(f"  ✅ 成功！")
                    return data
                except:
                    print(f"  ⚠️ 不是有效 JSON")
                    continue
            else:
                print(f"  ⚠️ HTTP {response.status_code}")
        except Exception as e:
            print(f"  ❌ {e}")
            continue
    
    return None

def main():
    """主函數"""
    print("🚀 字體同步腳本開始")
    print(f"📁 輸出目錄: {FONTS_DIR}")
    
    # 先處理問題字體
    if PROBLEM_FONTS:
        print(f"\n⚠️ 優先處理 {len(PROBLEM_FONTS)} 個問題字體")
        
        for font_name in PROBLEM_FONTS:
            json_path = FONTS_DIR / f"{font_name.replace(' ', '_')}.json"
            if json_path.exists():
                print(f"⏭️  已存在: {font_name}")
                continue
                
            print(f"\n[{font_name}]")
            data = download_with_fallbacks(font_name)
            
            if data:
                FONTS_DIR.mkdir(parents=True, exist_ok=True)
                with open(json_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2)
                print(f"  ✅ 已保存")
            else:
                print(f"  ❌ 所有來源都失敗")
        
        print(f"\n問題字體處理完成，繼續全部...")
    
    # 確保目錄存在
    FONTS_DIR.mkdir(parents=True, exist_ok=True)
    
    # 載入字體清單
    fonts = load_fonts_list()
    print(f"📋 共有 {len(fonts)} 種字體")
    
    # 檢查命令行參數
    if len(sys.argv) > 1:
        # 同步特定字體
        target_font = sys.argv[1]
        sync_font(target_font)
    else:
        # 同步所有字體
        success_count = 0
        fail_count = 0
        
        for i, font_name in enumerate(fonts, 1):
            print(f"\n[{i}/{len(fonts)}] ", end="", flush=True)
            if sync_font(font_name):
                success_count += 1
            else:
                fail_count += 1
            
            # 避免請求過快（尊重 CDN）
            time.sleep(0.3)
        
        print(f"\n{'='*50}")
        print(f"📊 同步完成")
        print(f"✅ 成功: {success_count}")
        print(f"❌ 失敗: {fail_count}")
        print(f"{'='*50}")

if __name__ == "__main__":
    main()