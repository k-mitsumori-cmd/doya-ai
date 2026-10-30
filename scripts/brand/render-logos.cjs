// ロゴの SVG を PNG に書き出す（@resvg/resvg-js）。使い方: node scripts/brand/render-logos.cjs [SVG のフォルダ]
// - 明るい背景用は透明の PNG（幅 1600px）。白抜き（*-white）も透明で書き出す（暗い背景に置いて使う）。
const fs = require('fs')
const path = require('path')
const { Resvg } = require('@resvg/resvg-js')
const root = path.resolve((process.argv[2] && process.argv[2] !== 'native' ? process.argv[2] : '') || path.join(__dirname, '../../docs/design/brand/buddy-logo-proposals'))
const native = process.argv.includes('native')
let n = 0
for (const dir of fs.readdirSync(root)) {
  const d = path.join(root, dir)
  if (!fs.statSync(d).isDirectory()) continue
  for (const f of fs.readdirSync(d).filter((x) => x.endsWith('.svg'))) {
    const svg = fs.readFileSync(path.join(d, f))
    const png = new Resvg(svg, { fitTo: native ? { mode: 'original' } : { mode: 'width', value: 1600 } }).render().asPng()
    fs.writeFileSync(path.join(d, f.replace(/\.svg$/, '.png')), png)
    n++
  }
}
console.log('wrote', n, 'png')
