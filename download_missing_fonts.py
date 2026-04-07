#!/usr/bin/env python3
"""
下載缺少的字體 - 從 Google Fonts
"""

import os
import json
import requests
import time
import re

MISSING_FONTS = [
    "ADLaM Display",
    "Aoboshi One", 
    "Bagel Fat One",
    "Bruno Ace",
    "Caprasimo",
    "Cherry Bomb One",
    "Foldit",
    "Young Serif",
    "ZCOOL KuaiLe",
    "ZCOOL QingKe HuangYou",
]

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS_DIR = os.path.join(BASE_DIR, "frontend/assets/fonts/typeface")

def download_from_google_fonts(font_name):
    """從 Google Fonts 下載"""
    font_key = font_name.replace(" ", "+")
    
    # 獲取 CSS
    url = f"https://fonts.googleapis.com/css?family={font_key}:wght@400"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15"
    }
    
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        if resp.status_code != 200:
            print(f"  ❌ CSS 失敗: HTTP {resp.status_code}")
            return None
        
        # 解析 woff2 URL
        match = re.search(r"url\((https://fonts\.gstatic\.com/[^)]+)\)", resp.text)
        if not match:
            print(f"  ❌ 找不到 woff2 URL")
            return None
        
        woff2_url = match.group(1)
        print(f"  📥 下載 woff2: {woff2_url[:60]}...")
        
        # 下載 woff2
        woff2_resp = requests.get(woff2_url, headers=headers, timeout=30)
        if woff2_resp.status_code != 200:
            print(f"  ❌ woff2 失敗: HTTP {woff2_resp.status_code}")
            return None
        
        return woff2_resp.content
        
    except Exception as e:
        print(f"  ❌ 錯誤: {e}")
        return None

def main():
    os.makedirs(FONTS_DIR, exist_ok=True)
    
    success = 0
    failed = []
    
    for font_name in MISSING_FONTS:
        print(f"\n[{font_name}]")
        
        font_data = download_from_google_fonts(font_name)
        
        if font_data:
            # 保存 woff2
            filename = font_name.replace(" ", "_") + ".woff2"
            filepath = os.path.join(FONTS_DIR, filename)
            
            with open(filepath, "wb") as f:
                f.write(font_data)
            
            print(f"  ✅ 已保存: {filename} ({len(font_data)/1024:.1f}KB)")
            success += 1
        else:
            failed.append(font_name)
        
        time.sleep(0.5)
    
    print(f"\n{'='*50}")
    print(f"完成: 成功 {success}, 失敗 {len(failed)}")
    if failed:
        print(f"失敗列表: {', '.join(failed)}")

if __name__ == "__main__":
    main()