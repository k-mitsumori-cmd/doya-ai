// ドヤマーケ ナーチャリングに「動画紹介メール」を末尾へ追加する。
//
//   node scripts/drip/append-video-steps.mjs --file <entries.json> [--dry-run] [--out <dir>]
//
// - entries.json は配列。書式は scripts/drip/content/video-library-2026-10.json と video-email.mjs のコメントを参照
// - key が同じテンプレート（name = "ナーチャリング動画:<key>"）が既にあれば飛ばす（二重追加しない）
// - dayOffset は末尾ステップ +2日 / +3日 を交互、送信時刻は 12:00 / 19:00 を交互
// - 既に全通受け取った人（completed）にも、追加分は配信エンジンが自動で届ける（drip-sender の再開処理）
// - --dry-run は DB に書かず、--out に HTML プレビューを書き出す
//
// ドヤマーケスタジオで新しい動画を公開したら、作業役がエントリを1件作ってこのスクリプトで追加する。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
import { renderVideoEmail, renderText } from './video-email.mjs'

export const SEQUENCE_ID = 'cmqzy0xxm000de8ppbx2vd6bk' // ドヤマーケ ナーチャリング
const TEMPLATE_PREFIX = 'ナーチャリング動画:'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
function loadEnv() {
  if (process.env.DATABASE_URL) return
  for (const f of ['.env.local', '.env']) {
    const p = path.join(root, f)
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}

function arg(name) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const file = arg('--file')
  const dryRun = process.argv.includes('--dry-run')
  const outDir = arg('--out')
  if (!file) throw new Error('--file が必要です')
  const entries = JSON.parse(fs.readFileSync(file, 'utf8'))
  for (const e of entries) {
    if (!e.key || !e.subject || !e.kind) throw new Error(`key/subject/kind が足りません: ${JSON.stringify(e).slice(0, 80)}`)
  }

  if (outDir) {
    fs.mkdirSync(outDir, { recursive: true })
    for (const e of entries) fs.writeFileSync(path.join(outDir, `${e.key}.html`), renderVideoEmail(e).replace(/\{\{user_name\}\}/g, 'テスト'))
    console.log(`preview: ${entries.length} 件を ${outDir} に書き出しました`)
  }
  if (dryRun) return

  loadEnv()
  const prisma = new PrismaClient()
  try {
    const seq = await prisma.dripSequence.findUnique({
      where: { id: SEQUENCE_ID },
      include: { steps: { orderBy: { sortOrder: 'asc' }, include: { template: { select: { name: true } } } } },
    })
    if (!seq) throw new Error('シーケンスが見つかりません')
    const existing = new Set(seq.steps.map((s) => s.template?.name).filter(Boolean))
    let last = seq.steps[seq.steps.length - 1]
    let sortOrder = last ? last.sortOrder + 1 : 0
    let dayOffset = last ? last.dayOffset : 0
    let added = 0

    for (const e of entries) {
      const name = TEMPLATE_PREFIX + e.key
      if (existing.has(name)) {
        console.log(`skip（追加済み）: ${e.key}`)
        continue
      }
      dayOffset += sortOrder % 2 === 0 ? 2 : 3
      const sendTime = sortOrder % 2 === 0 ? '12:00' : '19:00'
      await prisma.$transaction(async (tx) => {
        const t = await tx.dripTemplate.create({
          data: {
            name,
            subject: e.subject,
            bodyHtml: renderVideoEmail(e),
            bodyText: renderText(e),
            variables: ['user_name'],
          },
        })
        await tx.dripStep.create({
          data: {
            sequenceId: SEQUENCE_ID,
            sortOrder,
            dayOffset,
            sendTime,
            templateId: t.id,
            label: `メール${sortOrder + 1} ${e.title || e.subject.replace(/^【ドヤマーケ】/, '')}`.slice(0, 120),
          },
        })
      })
      console.log(`added: #${sortOrder + 1} Day${dayOffset} ${sendTime} ${e.key}`)
      sortOrder++
      added++
    }
    console.log(`完了: ${added} 件追加（全 ${sortOrder} 通）`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
