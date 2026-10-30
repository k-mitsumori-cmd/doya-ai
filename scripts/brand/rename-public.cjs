// 静的ファイル（public/）の「ドヤAI」を「ドヤバディ」にする（切り替える日に実行する。旗とは別）。
// 使い方: node scripts/brand/rename-public.cjs          … 変える所を一覧で見るだけ（ファイルは変えない）
//         node scripts/brand/rename-public.cjs --write  … 実際に書き換える（変えたあと、git diff で確かめてからコミット）
// - 対象: public/site.webmanifest（アプリ名）と public/resources/doya-ai/*.html（配布資料の HTML）。
//   public/renewal-comparison/ は社内の比較資料なので対象外。
// - ツール名（ドヤAIO・ドヤAI質問リンク・ドヤAI商談）は変えない。
const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '../../public')
const RE = /ドヤAI(?!O|質問リンク|商談)/g
const write = process.argv.includes('--write')
const targets = [path.join(root, 'site.webmanifest')]
const res = path.join(root, 'resources/doya-ai')
if (fs.existsSync(res)) for (const f of fs.readdirSync(res)) if (f.endsWith('.html')) targets.push(path.join(res, f))
let total = 0
for (const f of targets) {
  if (!fs.existsSync(f)) continue
  const src = fs.readFileSync(f, 'utf8')
  const n = (src.match(RE) || []).length
  if (!n) continue
  total += n
  console.log(`${write ? '書き換え' : '変える所'}: ${path.relative(root, f)}（${n}件）`)
  if (write) fs.writeFileSync(f, src.replace(RE, 'ドヤバディ'))
}
console.log(total ? `合計 ${total}件${write ? ' を書き換えました' : '（--write を付けると書き換えます）'}` : '変える所はありません')
