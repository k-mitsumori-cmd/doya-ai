const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()
const traceFile = path.join(root, '.next/server/app/api/mensetsu/sessions/[id]/pdf/route.js.nft.json')
const trace = JSON.parse(fs.readFileSync(traceFile, 'utf8'))
assert(Array.isArray(trace.files), 'Interview PDF deployment trace must contain a file inventory')
const tracedFiles = new Set(trace.files.map(file => path.resolve(path.dirname(traceFile), file)))

const requiredFiles = [
  'assets/fonts/NotoSansJP-Regular.ttf',
  'assets/fonts/NotoSansJP-Bold.ttf',
  'node_modules/@sparticuz/chromium/bin/chromium.br',
  'node_modules/@sparticuz/chromium/bin/fonts.tar.br',
]
for (const relativePath of requiredFiles) {
  const file = path.join(root, relativePath)
  assert(fs.existsSync(file), `Interview PDF asset is missing on disk: ${relativePath}`)
  assert(tracedFiles.has(file), `Interview PDF deployment trace is missing: ${relativePath}`)
}
console.log(JSON.stringify({ passed: true, route: '/api/mensetsu/sessions/[id]/pdf', requiredFiles }))
