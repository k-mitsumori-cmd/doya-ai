// ドヤマーケスタジオの「メルマガ」画面用に、ステップメールの中身と配信実績を書き出す（DBは読むだけ）。
//
//   node scripts/drip/export-studio.mjs <出力ディレクトリ>
//
// 出力: <dir>/mail/<docId>.json（1通1ファイル）と <dir>/mail/_meta.json。
// これを ArtifactData の batch（collection "mail"）でスタジオへ反映する。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

const LIVE_ID = 'cmqzy0xxm000de8ppbx2vd6bk' // 配信中のナーチャリング
const DRAFT_ID = 'cmuxat7bl0001f53w7441045s' // 動画31通（確認待ち・送られない）
const TEMPLATE_PREFIX = 'ナーチャリング動画:'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
for (const f of ['.env.local', '.env']) {
  const p = path.join(root, f)
  if (process.env.DATABASE_URL || !fs.existsSync(p)) continue
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const outDir = process.argv[2]
if (!outDir) throw new Error('出力ディレクトリを指定してください')
const library = JSON.parse(fs.readFileSync(path.join(root, 'scripts/drip/content/video-library-2026-10.json'), 'utf8'))
const byKey = Object.fromEntries(library.map((e) => [e.key, e]))

const prisma = new PrismaClient()
try {
  const seqs = await prisma.dripSequence.findMany({
    where: { id: { in: [LIVE_ID, DRAFT_ID] } },
    include: { steps: { orderBy: { sortOrder: 'asc' }, include: { template: true } } },
  })
  const stats = await prisma.dripEmailLog.groupBy({
    by: ['stepId', 'status'],
    _count: true,
  })
  const statBy = {}
  for (const s of stats) {
    const o = (statBy[s.stepId] ||= { sent: 0, opened: 0, clicked: 0, failed: 0 })
    if (s.status === 'failed') o.failed += s._count
    else o.sent += s._count
    if (s.status === 'opened' || s.status === 'clicked') o.opened += s._count
    if (s.status === 'clicked') o.clicked += s._count
  }
  const enroll = await prisma.dripEnrollment.groupBy({ by: ['status'], where: { sequenceId: LIVE_ID }, _count: true })

  fs.mkdirSync(path.join(outDir, 'mail'), { recursive: true })
  let n = 0
  for (const seq of seqs) {
    const live = seq.id === LIVE_ID
    for (const s of seq.steps) {
      const key = s.template?.name?.startsWith(TEMPLATE_PREFIX) ? s.template.name.slice(TEMPLATE_PREFIX.length) : null
      const e = key ? byKey[key] : null
      const doc = {
        seq: live ? 'live' : 'draft',
        order: live ? s.sortOrder + 1 : s.sortOrder + 1, // 下書きも「全体の何通目になるか」で表示
        day: s.dayOffset,
        sendTime: s.sendTime,
        subject: s.template?.subject || '',
        label: s.label,
        key,
        kind: e?.kind || 'tool',
        channel: e?.channel || null,
        youtubeId: e?.youtubeId || null,
        videos: e?.videos?.map((v) => v.youtubeId) || null,
        service: e?.service?.id || null,
        html: s.template?.bodyHtml || '',
        stats: statBy[s.id] || { sent: 0, opened: 0, clicked: 0, failed: 0 },
      }
      fs.writeFileSync(path.join(outDir, 'mail', `${doc.seq}-${String(doc.order).padStart(2, '0')}.json`), JSON.stringify(doc))
      n++
    }
  }
  const meta = {
    liveName: seqs.find((s) => s.id === LIVE_ID)?.name,
    liveStatus: seqs.find((s) => s.id === LIVE_ID)?.status,
    draftName: seqs.find((s) => s.id === DRAFT_ID)?.name,
    draftStatus: seqs.find((s) => s.id === DRAFT_ID)?.status,
    enrollments: Object.fromEntries(enroll.map((g) => [g.status, g._count])),
    syncedAt: Date.now(),
  }
  fs.writeFileSync(path.join(outDir, 'mail', '_meta.json'), JSON.stringify(meta))
  console.log(`書き出し: ${n} 通 + _meta`, meta)
} finally {
  await prisma.$disconnect()
}
