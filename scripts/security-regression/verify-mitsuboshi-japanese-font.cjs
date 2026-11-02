const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const root = process.env.DOYA_JP_FONT_TEST_ROOT || path.resolve(__dirname, '../..');
const deps = process.env.DOYA_JP_FONT_TEST_DEPS || path.join(root, 'node_modules');
const req = name => require(path.join(deps, name));
const postcss = req('postcss'), imported = req('next/dist/compiled/@next/font/dist/fontkit').default, fontkit = imported.default || imported;
const layout = fs.readFileSync(path.join(root, 'src/app/(mitsuboshi)/layout.tsx'), 'utf8');
assert(!layout.includes('next/font/google'), 'Mitsuboshi build must not request Google CSS');
assert(layout.includes("import './mitsuboshi-fonts.css'")); assert(layout.includes('mitsuboshi-jp-font'));
const css = fs.readFileSync(path.join(root, 'src/app/(mitsuboshi)/mitsuboshi-fonts.css'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/fonts/NotoSerifJP-subsets.json')));
assert(!/https?:|@import/i.test(css)); assert.equal(manifest.fontFaces, 248); assert.equal(manifest.fonts.length, 124);
const fonts = new Map(), coverage = new Set(); let bytes = 0;
for (const spec of manifest.fonts) {
 assert.match(spec.file, /^\/fonts\/notoserifjp\/[a-f0-9]{24}\.woff2$/); assert(spec.source.startsWith('https://fonts.gstatic.com/'));
 const data = fs.readFileSync(path.join(root, 'public', spec.file.slice(1))); assert.equal(data.subarray(0, 4).toString(), 'wOF2');
 assert.equal(crypto.createHash('sha256').update(data).digest('hex'), spec.sha256); assert.equal(data.length, spec.bytes); bytes += data.length;
 const font = fontkit(data); assert.match(font.familyName, /Noto Serif JP/); assert(font.variationAxes.wght.min <= 400 && font.variationAxes.wght.max >= 700);
 for (const code of font.characterSet) coverage.add(code);
 fonts.set(spec.file, font);
}
assert.equal(bytes, manifest.totalFontBytes); assert(coverage.size >= 16000);
const parsed = postcss.parse(css), faces = [], used = new Set(); let fallback = null, variable = null;
parsed.walkAtRules('font-face', node => {
 const d = Object.fromEntries(node.nodes.filter(n => n.type === 'decl').map(n => [n.prop, n.value]));
 if (d['font-family'] === "'Noto Serif JP Fallback'") { fallback = d; return; }
 assert.equal(d['font-family'], "'Noto Serif JP'"); assert(['400', '700'].includes(d['font-weight'])); assert.equal(d['font-style'], 'normal'); assert.equal(d['font-display'], 'swap');
 const file = /^url\(([^)]+)\) format\('woff2'\)$/.exec(d.src)?.[1]; assert(fonts.has(file)); assert(d['unicode-range']); used.add(file); faces.push(d);
});
parsed.walkRules('.mitsuboshi-jp-font', node => { variable = node.nodes.find(d => d.prop === '--font-mitsuboshi-jp')?.value; });
assert.equal(faces.length, 248); assert.equal(used.size, 124); assert.equal(faces.filter(d => d['font-weight'] === '400').length, 124); assert.equal(faces.filter(d => d['font-weight'] === '700').length, 124);
assert.equal(variable, "'Noto Serif JP', 'Noto Serif JP Fallback'"); assert.equal(fallback.src, "local('Times New Roman')");
assert.equal(fallback['ascent-override'], '95.04%'); assert.equal(fallback['descent-override'], '23.62%'); assert.equal(fallback['line-gap-override'], '0.00%'); assert.equal(fallback['size-adjust'], '121.11%');
assert.equal((layout.match(/rel="preload"/g) || []).length, 1); assert(layout.includes('href="' + manifest.latinPreload + '"')); assert(layout.includes('as="font" type="font/woff2" crossOrigin="anonymous"'));
assert(manifest.fonts.find(f => f.file === manifest.latinPreload).bytes < 50000, 'Only small latin subset may preload');
function inRange(code, value) { return value.split(',').some(part => { const token = part.trim().replace(/^U\+/i, ''); const [a, b = a] = token.split('-'); if (token.includes('?')) return code >= parseInt(token.replace(/\?/g, '0'), 16) && code <= parseInt(token.replace(/\?/g, 'F'), 16); return code >= parseInt(a, 16) && code <= parseInt(b, 16); }); }
for (const char of '三ツ星アプリ名前会社情報録音確認慰め日本語0123456789ABC') {
 const code = char.codePointAt(0), face = faces.find(f => f['font-weight'] === '400' && inRange(code, f['unicode-range']) && fonts.get(/^url\(([^)]+)\)/.exec(f.src)[1]).hasGlyphForCodePoint(code));
 assert(face, 'Missing visible character ' + char); const font = fonts.get(/^url\(([^)]+)\)/.exec(face.src)[1]); assert(font.layout(char).glyphs.every(g => g.id !== 0));
}
const license = fs.readFileSync(path.join(root, 'assets/fonts/OFL-NotoSerifJP.txt'), 'utf8'); assert(license.includes('SIL OPEN FONT LICENSE')); assert(license.includes('Copyright'));
const report = { passed: 8, fontFiles: 124, fontFaces: 248, codepoints: coverage.size, totalBytes: bytes, latinPreloadBytes: manifest.fonts.find(f => f.file === manifest.latinPreload).bytes, scope: 'Actual PostCSS parser and Next fontkit, all124 official WOFF2 files hash/format/family/axis validation,248 exact400/700 unicode faces, Japanese sample glyph shaping, existing fallback metrics and small latin-only preload. No real browser/webpack/network/public performance or complete visual parity proof.' };
console.log(JSON.stringify(report));
if (process.env.DOYA_JP_FONT_TEST_OUTPUT) fs.writeFileSync(process.env.DOYA_JP_FONT_TEST_OUTPUT, JSON.stringify(report, null, 2) + '\n');
