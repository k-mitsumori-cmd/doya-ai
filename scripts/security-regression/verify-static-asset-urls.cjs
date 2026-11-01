const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '../..')
const sourceRoot = path.join(root, 'src')
const imagePath = /\/(?:[\w.%-]+\/)*[\w.%-]*[^\s'"`<>={}]*\.(?:png|jpe?g|webp|svg)/g
const nonAscii = /[^\x00-\x7F]/
let encodedAssets = 0

function inspect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) { inspect(file); continue }
    if (!/\.(tsx?|jsx?)$/.test(entry.name)) continue
    const source = fs.readFileSync(file, 'utf8')
    for (const match of source.matchAll(imagePath)) {
      const asset = match[0]
      assert.equal(nonAscii.test(asset), false, `${file}: image URL contains a raw non-ASCII character: ${asset}`)
      if (!/%[0-9A-Fa-f]{2}/.test(asset)) continue
      encodedAssets++
      let decoded
      try { decoded = decodeURI(asset) } catch { throw new Error(`${file}: invalid encoded asset path`) }
      assert.ok(fs.existsSync(path.join(root, 'public', decoded.slice(1))), `${file}: missing image asset: ${decoded}`)
    }
  }
}

inspect(sourceRoot)
// 2026-10-24: 古い見た目の分岐（勤怠のマイページの絵など）を消したので 127 → 120 件。
// 2026-10 UX 改修（FIX-PLAN STA）で全面の読み込み中のキャラクター画像を Skeleton に置き換え、
// 統合（2026-10-25）でその改修が足した古い見た目の分岐（全面の読み込みの絵）も消したので 110 件
assert.ok(encodedAssets >= 110, 'Expected existing percent-encoded character artwork references')
console.log(`PASS static image URLs: ${encodedAssets} encoded references, no raw non-ASCII paths`)
