// 2026-10-08 全体名改称: メール文面の「ドヤマーケAI」→「ドヤAI」（YouTubeチャンネル名は除外）。
//   node scripts/drip/rename-brand-2026-10.mjs [--apply]
import fs from 'node:fs'
import { PrismaClient } from '@prisma/client'
for (const line of fs.readFileSync('.env.local','utf8').split('\n')) { const m=line.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const apply = process.argv.includes('--apply')
const RE = /(?<!YouTube「)ドヤマーケ ?AI/g
const p = new PrismaClient()
if (apply) {
  const backup = 'scripts/drip/content/backup-2026-10-08-templates.json'
  if (!fs.existsSync(backup)) fs.writeFileSync(backup, JSON.stringify(await p.dripTemplate.findMany(), null, 1))
}
let n = 0, files = 0
for (const t of await p.dripTemplate.findMany()) {
  const data = {}
  for (const k of ['subject','bodyHtml','bodyText']) {
    if (t[k] == null) continue
    const v = t[k].replace(RE, 'ドヤAI')
    if (v !== t[k]) { n += (t[k].match(RE)||[]).length; data[k] = v }
  }
  if (Object.keys(data).length) { files++; if (apply) await p.dripTemplate.update({ where:{id:t.id}, data }) }
}
const left = (await p.dripTemplate.findMany()).map(t=>t.subject+t.bodyHtml+(t.bodyText||'')).join('\n').match(/.{0,8}ドヤマーケ ?AI.{0,8}/g)
console.log(apply?'APPLIED':'DRY', 'templates', files, 'replacements', n, '| remaining:', [...new Set(left)])
await p.$disconnect()
