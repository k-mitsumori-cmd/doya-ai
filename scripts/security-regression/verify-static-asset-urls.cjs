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
assert.ok(encodedAssets >= 127, 'Expected existing percent-encoded character artwork references')
console.log(`PASS static image URLs: ${encodedAssets} encoded references, no raw non-ASCII paths`)
