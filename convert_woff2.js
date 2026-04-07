const opentype = require('opentype.js');
const fs = require('fs');
const path = require('path');

const FONTS_DIR = path.join(__dirname, 'assets/fonts/typeface');

const MISSING_FONTS = [
    "Foldit",  // Only Foldit worked with opentype.js
];

async function convertWoff2(woff2Path, fontName) {
    try {
        console.log(`\n[${fontName}]`);
        
        // Load font
        const font = await opentype.load(woff2Path);
        console.log(`  ✅ Loaded: ${font.names.fontFamily.en}`);
        
        // Extract glyphs for ASCII chars
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        const glyphs = {};
        
        for (const char of chars) {
            const glyph = font.charToGlyph(char);
            if (glyph && glyph.index > 0) {
                // Get path commands
                const path = glyph.getPath(0, 0, 72); // size doesn't matter for getting outline
                const commands = [];
                
                for (const cmd of path.commands) {
                    switch (cmd.type) {
                        case 'M':
                            commands.push({ type: 'M', args: [cmd.x, cmd.y] });
                            break;
                        case 'L':
                            commands.push({ type: 'L', args: [cmd.x, cmd.y] });
                            break;
                        case 'Q':
                            commands.push({ type: 'Q', args: [cmd.x1, cmd.y1, cmd.x, cmd.y] });
                            break;
                        case 'C':
                            commands.push({ type: 'C', args: [cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y] });
                            break;
                        case 'Z':
                            commands.push({ type: 'Z', args: [] });
                            break;
                    }
                }
                
                // Format as Three.js outline
                let outline = '';
                for (const cmd of commands) {
                    outline += cmd.type;
                    if (cmd.args.length > 0) {
                        outline += ' ' + cmd.args.map(n => n.toFixed(2)).join(' ') + ' ';
                    }
                }
                
                glyphs[char] = {
                    ha: Math.round(glyph.advanceWidth || 500),
                    o: outline.trim()
                };
            }
        }
        
        console.log(`  🔍 Extracted: ${Object.keys(glyphs).length} glyphs`);
        
        if (Object.keys(glyphs).length < 20) {
            console.log(`  ❌ Too few glyphs`);
            return false;
        }
        
        // Build Three.js typeface JSON
        const typeface = {
            glyphs: glyphs,
            familyName: font.names.fontFamily.en || fontName,
            fullName: font.names.fullName.en || fontName,
            postScriptName: font.names.postScriptName.en || fontName.replace(/ /g, ''),
            styleName: font.names.fontSubfamily.en || 'Regular',
            ascender: font.ascender,
            descender: font.descender,
            underlinePosition: font.tables.post.underlinePosition || -100,
            underlineThickness: font.tables.post.underlineThickness || 50,
            boundingBox: {
                xMin: font.boundingBox.xMin,
                yMin: font.boundingBox.yMin,
                xMax: font.boundingBox.xMax,
                yMax: font.boundingBox.yMax
            },
            resolution: font.unitsPerEm
        };
        
        // Save JSON
        const jsonPath = FONTS_DIR + '/' + fontName.replace(/ /g, '_') + '.json';
        fs.writeFileSync(jsonPath, JSON.stringify(typeface, null, 2));
        console.log(`  ✅ Saved: ${path.basename(jsonPath)}`);
        
        return true;
        
    } catch (err) {
        console.log(`  ❌ Error: ${err.message}`);
        return false;
    }
}

async function main() {
    let success = 0;
    let failed = [];
    
    for (const fontName of MISSING_FONTS) {
        const woff2File = fontName.replace(/ /g, '_') + '.woff2';
        const woff2Path = FONTS_DIR + '/' + woff2File;
        
        if (!fs.existsSync(woff2Path)) {
            console.log(`\n[${fontName}] ⚠️ woff2 not found`);
            failed.push(fontName);
            continue;
        }
        
        const ok = await convertWoff2(woff2Path, fontName);
        if (ok) {
            success++;
        } else {
            failed.push(fontName);
        }
    }
    
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Complete: ${success} success, ${failed.length} failed`);
    if (failed.length > 0) {
        console.log(`Failed: ${failed.join(', ')}`);
    }
}

main();