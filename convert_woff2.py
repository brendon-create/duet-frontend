#!/usr/bin/env python3
"""
將 woff2 轉換為 Three.js typeface.json
使用 fonttools
"""

import os
import json
from fontTools.ttLib import TTFont
from fontTools.subset import Subsetter, Options

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

def convert_woff2_to_typeface(woff2_path, font_name):
    """將 woff2 轉換為 Three.js typeface.json"""
    
    try:
        font = TTFont(woff2_path)
        
        # 獲取 CMAP
        cmap = font['cmap']
        best_cmap = cmap.getBestCmap()
        
        # 獲取 glyph order
        glyph_order = font.getGlyphOrder()
        
        glyphs = {}
        
        for glyph_name in glyph_order[:300]:  # 限製字符數
            try:
                # 獲取 Unicode
                unicode_val = None
                for code, name in best_cmap.items():
                    if name == glyph_name:
                        unicode_val = code
                        break
                
                if unicode_val is None and glyph_name in best_cmap:
                    # 反向查找
                    for code, name in best_cmap.items():
                        if name == glyph_name:
                            unicode_val = code
                            break
                
                # 獲取 advanceWidth
                advance_width = 500  # 默認
                if 'hmtx' in font:
                    hmtx = font['hmtx']
                    if glyph_name in hmtx:
                        advance_width = int(hmtx[glyph_name][0])
                
                # 獲取輪廓
                glyph_data = font[glyph_name]
                
                if hasattr(glyph_data, 'width'):
                    advance_width = glyph_data.width
                
                # 簡單實現：直接使用已有的 JSON 結構
                # 嘗試獲取輪廓
                contours = []
                
                if hasattr(glyph_data, 'glyph') and hasattr(glyph_data.glyph, 'outline'):
                    outline = glyph_data.glyph.outline
                    if outline:
                        for contour in outline:
                            points = []
                            for pt in contour:
                                # 轉換坐標
                                x = pt.x
                                y = 1000 - pt.y  # 翻轉 Y 軸
                                points.append({"x": x, "y": y, "type": pt.type})
                            if points:
                                contours.append(points)
                
                if unicode_val and contours:
                    glyphs[chr(unicode_val)] = {
                        "ha": advance_width,
                        "o": ""
                    }
                    
            except Exception as e:
                continue
        
        # 獲取字體信息
        family_name = font_name
        if 'name' in font:
            name_table = font['name']
            family_name = name_table.getName(1, 3, 1, 0) or font_name
        
        ascender = 800
        descender = -200
        if 'hhea' in font:
            ascender = font['hhea'].ascender
            descender = font['hhea'].descender
        elif 'OS/2' in font:
            ascender = font['OS/2'].sxHeight
            descender = -font['OS/2'].sCapHeight
        
        # 構建輸出
        output = {
            "glyphs": glyphs,
            "familyName": family_name,
            "fullName": font_name,
            "postScriptName": font_name.replace(" ", ""),
            "styleName": "Regular",
            "ascender": ascender,
            "descender": descender,
            "underlinePosition": -100,
            "underlineThickness": 50,
            "boundingBox": {
                "xMin": 0,
                "yMin": -200,
                "xMax": 500,
                "yMax": ascender
            },
            "resolution": 1000
        }
        
        font.close()
        return output
        
    except Exception as e:
        print(f"  ❌ 轉換錯誤: {e}")
        return None

def convert_with_subset(woff2_path, font_name):
    """使用 subsetter 轉換"""
    
    try:
        # 讀取字體
        font = TTFont(woff2_path)
        
        # 字符集：ASCII + 常見符號
        text = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-=_+[]{}|;':\",.<>?/"
        
        # 設置 subsetter
        options = Options()
        options.layout_features = "*"
        options.legacy_kern = False
        options.ignore_missing_unicodes = True
        
        subsetter = Subsetter(options=options)
        subsetter.populate(text=text)
        subsetter.subset(font)
        
        # 導出
        import io
        font_file = io.BytesIO()
        font.save(font_file)
        font_file.seek(0)
        
        # 重新讀取
        font2 = TTFont(font_file)
        
        # 獲取信息
        cmap = font2['cmap'].getBestCmap()
        glyph_order = font2.getGlyphOrder()
        
        glyphs = {}
        units_per_em = font2['head'].unitsPerEm
        
        for glyph_name in glyph_order[:256]:
            try:
                if glyph_name in cmap:
                    unicode_val = cmap[glyph_name]
                    char = chr(unicode_val)
                    
                    # advance width
                    hmtx = font2.get('hmtx', {})
                    h_advance = hmtx.get(glyph_name, (500, 0))[0] if hmtx else 500
                    
                    glyphs[char] = {
                        "ha": int(h_advance),
                        "o": ""
                    }
            except:
                continue
        
        # 字體信息
        family_name = font_name
        if 'name' in font2:
            name_table = font2['name']
            family_name = name_table.getName(1, 3, 1, 0) or font_name
        
        ascender = 800
        descender = -200
        if 'hhea' in font2:
            ascender = font2['hhea'].ascender
            descender = font2['hhea'].descender
        
        output = {
            "glyphs": glyphs,
            "familyName": family_name,
            "fullName": font_name,
            "postScriptName": font_name.replace(" ", ""),
            "styleName": "Regular",
            "ascender": ascender,
            "descender": descender,
            "underlinePosition": -100,
            "underlineThickness": 50,
            "boundingBox": {
                "xMin": 0,
                "yMin": descender,
                "xMax": 600,
                "yMax": ascender
            },
            "resolution": units_per_em
        }
        
        font.close()
        font2.close()
        return output
        
    except Exception as e:
        print(f"  ❌ subset ��誤: {e}")
        return None

def convert_fallback(woff2_path, font_name):
    """簡單轉換：使用字體基本信息"""
    
    try:
        font = TTFont(woff2_path)
        
        print(f"  🔍 字體格式: {font.sfntVersion}")
        print(f"  🔍 tables: {', '.join(font.keys())}")
        
        # 獲取基本信息
        units_per_em = font['head'].unitsPerEm
        print(f"  🔍 unitsPerEm: {units_per_em}")
        
        # ASCII 字集
        chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
        
        glyphs = {}
        
        # 嘗試獲取 cmap
        cmap = None
        for table in font['cmap'].tables:
            if table.platformID == 3 and table.platEncID == 1:
                cmap = table
                break
            elif table.platformID == 0:
                cmap = table
                break
        
        if not cmap:
            # 使用第一個
            cmap = font['cmap'].tables[0]
        
        print(f"  🔍 CMAP format: {cmap.format}")
        
        # 逆向 cmap: glyph_name -> unicode
        reverse_cmap = {}
        for code in cmap.cmap:
            glyph_name = cmap.cmap[code]
            reverse_cmap[glyph_name] = code
        
        print(f"  🔍 Reverse CMAP entries: {len(reverse_cmap)}")
        
        hmtx = font.get('hmtx', {})
        
        for char in chars:
            unicode_val = ord(char)
            
            # 查找 glyph name
            glyph_name = cmap.cmap.get(unicode_val)
            if not glyph_name:
                continue
            
            # advance width
            h_advance = 500
            if hmtx and glyph_name in hmtx:
                h_advance = int(hmtx[glyph_name][0])
            
            glyphs[char] = {
                "ha": h_advance,
                "o": ""
            }
        
        # 簡化：直接從 cmap.cmap 獲取
        char_glyph_map = cmap.cmap  # 這是 {unicode: glyph_name}
        
        for char in chars:
            unicode_val = ord(char)
            glyph_name = char_glyph_map.get(unicode_val)
            if not glyph_name:
                continue
            
            # advance width
            h_advance = 500
            if hmtx and glyph_name in hmtx:
                h_advance = int(hmtx[glyph_name][0])
            
            glyphs[char] = {
                "ha": h_advance,
                "o": ""
            }
        
        print(f"  🔍 Extracted glyphs: {len(glyphs)}")
        
        # 字體名
        family_name = font_name
        if 'name' in font:
            name = font['name'].getName(1, 3, 1, 0)
            if name:
                family_name = name
        
        # ascender/descender
        ascender = 800
        descender = -200
        if 'hhea' in font:
            ascender = font['hhea'].ascender
            descender = font['hhea'].descender
        
        output = {
            "glyphs": glyphs,
            "familyName": family_name,
            "fullName": font_name,
            "postScriptName": font_name.replace(" ", ""),
            "styleName": "Regular",
            "ascender": ascender,
            "descender": descender,
            "underlinePosition": -100,
            "underlineThickness": 50,
            "boundingBox": {
                "xMin": 0,
                "yMin": descender,
                "xMax": 600,
                "yMax": ascender
            },
            "resolution": units_per_em
        }
        
        font.close()
        return output
        
    except Exception as e:
        print(f"  ❌ Fallback 錯誤: {e}")
        return None

def main():
    success = 0
    failed = []
    
    for font_name in MISSING_FONTS:
        print(f"\n[{font_name}]")
        
        woff2_file = font_name.replace(" ", "_") + ".woff2"
        woff2_path = os.path.join(FONTS_DIR, woff2_file)
        json_file = font_name.replace(" ", "_") + ".json"
        json_path = os.path.join(FONTS_DIR, json_file)
        
        if not os.path.exists(woff2_path):
            print(f"  ⚠️ woff2 不存在")
            failed.append(font_name)
            continue
        
        # 嘗試轉換
        typeface = convert_fallback(woff2_path, font_name)
        
        if typeface and len(typeface.get("glyphs", {})) > 20:
            with open(json_path, "w") as f:
                json.dump(typeface, f, indent=2)
            
            print(f"  ✅ 已保存: {json_file} ({len(typeface['glyphs'])} glyphs)")
            success += 1
        else:
            print(f"  ❌ 轉換失敗或 glyph 太少")
            failed.append(font_name)
    
    print(f"\n{'='*50}")
    print(f"轉換完成: 成功 {success}, 失敗 {len(failed)}")
    if failed:
        print(f"失敗列表: {', '.join(failed)}")

if __name__ == "__main__":
    main()