import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { geminiGenerateJson } from '@seo/lib/gemini'
import { z } from 'zod'

export const runtime = 'nodejs'

const BodySchema = z.object({
  message: z.string().min(1).max(20_000),
  // 長文時の安全運用：見出しを指定して部分修正
  targetHeading: z.string().optional(),
})

type PlanCode = 'FREE' | 'PRO' | 'ENTERPRISE' | 'UNKNOWN'
function normalizePlan(raw: any): PlanCode {
  const s = String(raw || '').toUpperCase().trim()
  if (s === 'PRO') return 'PRO'
  if (s === 'ENTERPRISE') return 'ENTERPRISE'
  if (s === 'FREE') return 'FREE'
  return 'UNKNOWN'
}

function extractHeadings(md: string): { level: number; text: string; line: number }[] {
  const lines = String(md || '').split('\n')
  const out: { level: number; text: string; line: number }[] = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{2,4})\s+(.+?)\s*$/)
    if (!m) continue
    const level = m[1].length
    const text = m[2].replace(/\s+/g, ' ').trim()
    if (!text) continue
    out.push({ level, text, line: i })
  }
  return out
}

function sliceSectionByHeading(md: string, headingText: string): { section: string; start: number; end: number } | null {
  const lines = String(md || '').split('\n')
  const headings = extractHeadings(md)
  const target = headings.find((h) => h.text === headingText)
  if (!target) return null

  const start = target.line
  let end = lines.length
  for (let i = target.line + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#{2,4})\s+(.+?)\s*$/)
    if (!m) continue
    const lvl = m[1].length
    if (lvl <= target.level) {
      end = i
      break
    }
  }
  return { section: lines.slice(start, end).join('\n'), start, end }
}

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const articleId = ctx.params.id
  try {
    await ensureSeoSchema()

    const session = await getServerSession(authOptions)
    const user: any = session?.user || null
    if (!user?.id) {
      return NextResponse.json(
        { success: false, error: 'この機能は有料プラン限定です（ログインが必要です）。', code: 'PAID_ONLY' },
        { status: 401 }
      )
    }

    const plan = normalizePlan(user?.seoPlan || user?.plan || 'FREE')
    const isPaid = plan === 'PRO' || plan === 'ENTERPRISE'
    if (!isPaid) {
      return NextResponse.json(
        { success: false, error: 'AI修正チャットは有料プラン限定です。', code: 'PAID_ONLY', upgradeUrl: '/pricing' },
        { status: 402 }
      )
    }

    const body = BodySchema.parse(await req.json())

    const article = await (prisma as any).seoArticle.findUnique({
      where: { id: articleId },
      select: { id: true, status: true, title: true, finalMarkdown: true, targetChars: true },
    })
    if (!article) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
    if (String(article.status) !== 'DONE') {
      return NextResponse.json(
        { success: false, error: '記事が完成してから利用できます。', code: 'NOT_DONE' },
        { status: 400 }
      )
    }

    const md = String(article.finalMarkdown || '')
    if (!md.trim()) {
      return NextResponse.json({ success: false, error: '本文がありません。', code: 'NO_MARKDOWN' }, { status: 400 })
    }

    const MAX_FULL_MD_CHARS = 18_000
    const headings = extractHeadings(md).map((h) => h.text)

    // 長文は見出し指定を必須（安全に反映するため）
    if (md.length > MAX_FULL_MD_CHARS && !body.targetHeading) {
      return NextResponse.json(
        {
          success: false,
          code: 'NEED_TARGET',
          error: '記事が長いため、修正したい見出しを選択してください（安全に反映するため）。',
          headings,
        },
        { status: 200 }
      )
    }

    const targetHeading = body.targetHeading?.trim()
    const target = targetHeading ? sliceSectionByHeading(md, targetHeading) : null
    if (targetHeading && !target) {
      return NextResponse.json(
        { success: false, error: '指定した見出しが見つかりませんでした。', code: 'HEADING_NOT_FOUND', headings },
        { status: 400 }
      )
    }

    const inputMd = target ? target.section : md

    const model =
      process.env.SEO_GEMINI_TEXT_MODEL_CHAT ||
      process.env.SEO_GEMINI_TEXT_MODEL ||
      'gemini-3-pro-preview'

    const out = await geminiGenerateJson<{ proposedMarkdown: string; summary: string }>(
      {
        model,
        generationConfig: { temperature: 0.25, maxOutputTokens: 8192 },
        prompt: [
          'You are a top-tier Japanese SEO editor.',
          'Task: Modify the provided Markdown according to the user request.',
          'Constraints:',
          '- Output JSON only: { "proposedMarkdown": string, "summary": string }',
          '- proposedMarkdown must be valid Markdown.',
          '- Keep the original structure and headings as much as possible.',
          '- Do not invent facts. If unsure, keep original wording.',
          '- Write in natural Japanese.',
          '',
          `Article title: ${String(article.title || '')}`,
          `Target characters: ${String(article.targetChars || '')}`,
          targetHeading ? `Target heading: ${targetHeading}` : 'Target: FULL ARTICLE',
          '',
          '=== USER REQUEST ===',
          body.message,
          '',
          '=== CURRENT MARKDOWN ===',
          inputMd.slice(0, 180000),
        ].join('\n'),
      },
      'ChatEditResult'
    )

    const proposed = String(out?.proposedMarkdown || '').trim()
    if (!proposed) {
      return NextResponse.json(
        { success: false, error: 'AIが空の修正案を返しました。', code: 'EMPTY_RESULT' },
        { status: 502 }
      )
    }

    // 部分修正なら全体へ合成して返す
    if (target) {
      const lines = md.split('\n')
      const newLines = [...lines.slice(0, target.start), ...proposed.split('\n'), ...lines.slice(target.end)]
      return NextResponse.json({
        success: true,
        summary: String(out?.summary || ''),
        proposedMarkdown: newLines.join('\n'),
        mode: 'SECTION',
        targetHeading,
        usedModel: model,
      })
    }

    return NextResponse.json({
      success: true,
      summary: String(out?.summary || ''),
      proposedMarkdown: proposed,
      mode: 'FULL',
      usedModel: model,
    })
  } catch (e: any) {
    const msg = e?.message || '不明なエラー'
    console.error('[seo chat-edit] failed', { articleId, msg })
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}


