// 2026-10-06 ドヤマーケ ナーチャリング既存12通の改修（1回きり・再実行しても同じ結果）
//
//   node scripts/drip/patch-nurture-2026-10.mjs [--dry-run]
//
// 1. 各メールの「ツールを使いこなす」のボタン直前に、サービス画面のGIFを差し込む
// 2. 配信間隔を 2〜3日おきに詰める（Day 0,2,4,7,9,12,14,17,19,22,24,27）
// 3. 「週1回」「最終回」「2か月間ありがとうございました」の文言を、続けて届く前提に直す
// 4. シーケンス名を継続配信に変更
// 改修前の内容は scripts/drip/content/backup-2026-10-06-steps.json

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
import { serviceGifBlock } from './video-email.mjs'

const SEQUENCE_ID = 'cmqzy0xxm000de8ppbx2vd6bk'
const NEW_NAME = 'ドヤマーケ ナーチャリング（新規ユーザー・2〜3日おき継続配信）'
const GIF_BY_ORDER = ['banner', 'doyaslide', 'shodan', 'aio', 'banner', 'persona', 'seo', 'sfa', 'cunning', 'promane', 'hr', 'kintai']
const DAY_BY_ORDER = [0, 2, 4, 7, 9, 12, 14, 17, 19, 22, 24, 27]

const REPLACE = {
  0: [['第1週は多めに、その後は週1回のペースでお届けします。', 'これから2〜3日に1回のペースで、ツールの使い方とYouTubeの実演動画をお届けします。']],
  11: [
    ['2か月間おつきあいいただき、ありがとうございました。最終回も2本立て。最後に「あなたに合う選び方」まで整理します。', 'ここまでおつきあいいただき、ありがとうございます。今回も2本立てで、「あなたに合う選び方」を整理します。'],
    ['2か月でお伝えしてきた2つを、最後に整理します。', 'これまでお伝えしてきた2つを、ここで整理します。'],
    ['2か月間、本当にありがとうございました。', '次回からは、YouTubeで公開している実演動画を1本ずつご紹介します。手を動かす前に“見て真似できる”内容です。'],
  ],
}
const SUBJECT = { 11: ['【ドヤマーケ｜最終回】', '【ドヤマーケ】'] }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
for (const f of ['.env.local', '.env']) {
  const p = path.join(root, f)
  if (process.env.DATABASE_URL || !fs.existsSync(p)) continue
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const dryRun = process.argv.includes('--dry-run')
const prisma = new PrismaClient()
const BUTTON = '<tr><td style="padding:10px 28px 18px;" align="center"><a href="https://doya-ai.surisuta.jp/'

try {
  const steps = await prisma.dripStep.findMany({
    where: { sequenceId: SEQUENCE_ID, sortOrder: { lt: 12 } },
    orderBy: { sortOrder: 'asc' },
    include: { template: true },
  })
  if (steps.length !== 12) throw new Error(`既存12通の想定と違います: ${steps.length}`)

  for (const s of steps) {
    const t = s.template
    let html = t.bodyHtml
    let text = t.bodyText || ''
    let subject = t.subject
    if (!html.includes('/drip/nurture/gif/')) {
      const at = html.indexOf(BUTTON)
      if (at < 0) throw new Error(`ボタンが見つかりません: #${s.sortOrder + 1}`)
      html = html.slice(0, at) + serviceGifBlock(GIF_BY_ORDER[s.sortOrder]) + html.slice(at)
    }
    for (const [from, to] of REPLACE[s.sortOrder] || []) {
      if (html.includes(from)) html = html.split(from).join(to)
      else if (!html.includes(to)) throw new Error(`置換元が見つかりません: #${s.sortOrder + 1} ${from}`)
      text = text.split(from).join(to)
    }
    if (SUBJECT[s.sortOrder]) subject = subject.replace(...SUBJECT[s.sortOrder])

    console.log(`#${s.sortOrder + 1} Day${s.dayOffset}→${DAY_BY_ORDER[s.sortOrder]} gif=${GIF_BY_ORDER[s.sortOrder]} ${subject}`)
    if (dryRun) continue
    await prisma.dripTemplate.update({ where: { id: t.id }, data: { bodyHtml: html, bodyText: text || null, subject } })
    await prisma.dripStep.update({
      where: { id: s.id },
      data: { dayOffset: DAY_BY_ORDER[s.sortOrder], label: s.label.replace('最終回｜', '') },
    })
  }
  if (!dryRun) await prisma.dripSequence.update({ where: { id: SEQUENCE_ID }, data: { name: NEW_NAME } })
  console.log(dryRun ? 'dry-run（書き込みなし）' : '完了')
} finally {
  await prisma.$disconnect()
}
