import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'

export const runtime = 'nodejs'

const BodySchema = z.object({
  // UIで選んだ改善点を指定
  fix: z.enum(['ADD_TLDR', 'ADD_FAQ', 'ADD_CONCLUSION', 'ADD_GLOSSARY']),
})

function normalizeNewlines(s: string) {
  return String(s || '').replace(/\r\n/g, '\n')
}

function hasHeading(md: string, heading: string) {
  const t = normalizeNewlines(md)
  const re = new RegExp(`^#{2,4}\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm')
  return re.test(t)
}

function applyFix(mdRaw: string, fix: z.infer<typeof BodySchema>['fix']) {
  const md = normalizeNewlines(mdRaw || '').trim()
  if (!md) return md

  // H1の直後に差し込む（結論/TLDR）
  const lines = md.split('\n')
  let insertAt = 0
  // 先頭の空行を飛ばす
  while (insertAt < lines.length && !lines[insertAt].trim()) insertAt++
  // H1 を飛ばす
  if (lines[insertAt]?.startsWith('# ')) {
    insertAt++
    while (insertAt < lines.length && !lines[insertAt].trim()) insertAt++
  }

  const ensureSeparated = (block: string) => `\n\n${block.trim()}\n\n`

  if (fix === 'ADD_TLDR') {
    if (hasHeading(md, '結論（先に）') || hasHeading(md, '結論') || hasHeading(md, 'TL;DR')) return md
    const block = [
      '## 結論（先に）',
      '',
      '- この記事の結論を3行でまとめる（後で調整OK）',
      '- 読者が取るべき行動（例：比較表で候補を3つに絞る）',
      '- 次に読むべき章（例：選び方 / 料金相場）',
    ].join('\n')
    const next = [...lines.slice(0, insertAt), ensureSeparated(block).trim(), ...lines.slice(insertAt)].join('\n')
    return normalizeNewlines(next).trim()
  }

  if (fix === 'ADD_FAQ') {
    if (md.includes('よくある質問') || md.includes('FAQ') || hasHeading(md, 'よくある質問') || hasHeading(md, 'FAQ')) return md
    const block = [
      '## よくある質問（FAQ）',
      '',
      '### Q1. 〜ですか？',
      'A. （結論→理由→補足 の順で簡潔に）',
      '',
      '### Q2. 〜の注意点は？',
      'A. （失敗しやすいポイントと回避策）',
      '',
      '### Q3. 〜を選ぶ基準は？',
      'A. （チェックリスト形式にすると強い）',
    ].join('\n')
    return `${md}${ensureSeparated(block)}`.trim()
  }

  if (fix === 'ADD_CONCLUSION') {
    if (md.includes('まとめ') || hasHeading(md, 'まとめ') || hasHeading(md, '結論')) return md
    const block = [
      '## まとめ',
      '',
      '- 結論の要約（3行）',
      '- 読者が次にやること（チェックリスト/比較表/無料相談など）',
      '- 最後に一言（不安の解消・背中押し）',
    ].join('\n')
    return `${md}${ensureSeparated(block)}`.trim()
  }

  if (fix === 'ADD_GLOSSARY') {
    if (md.includes('用語集') || hasHeading(md, '用語集')) return md
    const block = [
      '## 用語集',
      '',
      '- **用語A**：一言定義（必要なら補足）',
      '- **用語B**：一言定義（必要なら補足）',
      '- **用語C**：一言定義（必要なら補足）',
    ].join('\n')
    return `${md}${ensureSeparated(block)}`.trim()
  }

  return md
}

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    await ensureSeoSchema()
    const id = ctx.params.id
    const body = BodySchema.parse(await req.json().catch(() => ({})))

    const article = await (prisma as any).seoArticle.findUnique({ where: { id } })
    if (!article) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })

    const before = String(article.finalMarkdown || '')
    const after = applyFix(before, body.fix)
    if (after === before) {
      return NextResponse.json({ success: true, changed: false, finalMarkdown: before })
    }

    await (prisma as any).seoArticle.update({
      where: { id },
      data: { finalMarkdown: after, updatedAt: new Date() },
    })

    return NextResponse.json({ success: true, changed: true, finalMarkdown: after })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '不明なエラー' }, { status: 500 })
  }
}

