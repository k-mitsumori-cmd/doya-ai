import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SeoCreateArticleInputSchema } from '@seo/lib/types'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { getSeoDailyLimitByUserPlan } from '@/lib/pricing'
import { geminiGenerateText, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'

export async function GET() {
  try {
    await ensureSeoSchema()
    const seoArticle = (prisma as any).seoArticle as any
    const articles = await seoArticle.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        jobs: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })
    return NextResponse.json({ success: true, articles })
  } catch (e: any) {
    // DB未反映/接続不可でも画面側が404にならないよう、明示的にJSONエラーを返す
    return NextResponse.json(
      { success: false, error: e?.message || 'DBエラー（スキーマ未反映の可能性）', articles: [] },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureSeoSchema()
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'ログインが必要です（無料プラン: 1日1回まで）' },
        { status: 401 }
      )
    }

    const userId = String((session.user as any).id || '')
    const userPlan = String((session.user as any).plan || 'FREE')
    const dailyLimit = getSeoDailyLimitByUserPlan(userPlan)

    // 日次上限チェック（今日作成したSEO記事数で判定）
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)

    const usedToday = await (prisma as any).seoArticle.count({
      where: { userId, createdAt: { gte: start, lt: end } },
    })
    if (dailyLimit >= 0 && usedToday >= dailyLimit) {
      return NextResponse.json(
        {
          success: false,
          error: `本日の生成上限に達しました（${usedToday}/${dailyLimit}回）。プランをアップグレードしてください。`,
        },
        { status: 429 }
      )
    }

    const body = await req.json()
    const input = SeoCreateArticleInputSchema.parse(body)

    const seoArticle = (prisma as any).seoArticle as any
    const seoJob = (prisma as any).seoJob as any

    const article = await seoArticle.create({
      data: {
        status: 'RUNNING',
        userId,
        title: input.title,
        keywords: input.keywords as any,
        persona: input.persona || null,
        searchIntent: input.searchIntent || null,
        targetChars: input.targetChars,
        tone: input.tone,
        forbidden: input.forbidden as any,
        referenceUrls: input.referenceUrls as any,
        llmoOptions: (input.llmoOptions ?? undefined) as any,
      },
    })

    // 互換のためジョブは作るが、シンプル生成ではジョブを進めない（ここで即生成して完了させる）
    const job = await seoJob.create({
      data: { articleId: article.id, status: 'running', step: 'write', progress: 10 },
    })

    // ==============================
    // シンプル生成（最優先で“必ず本文を出す”）
    // - JSONや分割パイプラインを使わない（壊れにくい）
    // - serverless timeout対策: 出力はまず短めに（後で追記できる）
    // ==============================
    const keywords = Array.isArray(input.keywords) ? input.keywords : []
    const forbidden = Array.isArray(input.forbidden) ? input.forbidden : []
    const refUrls = Array.isArray(input.referenceUrls) ? input.referenceUrls : []
    const llmo = (input.llmoOptions as any) || {}

    const llmoOn = (k: string) => llmo?.[k] !== false
    const llmoText = [
      llmoOn('tldr') ? 'ON: TL;DR' : 'OFF: TL;DR',
      llmoOn('conclusionFirst') ? 'ON: 結論ファースト＋根拠' : 'OFF: 結論ファースト＋根拠',
      llmoOn('faq') ? 'ON: FAQ' : 'OFF: FAQ',
      llmoOn('glossary') ? 'ON: 用語集' : 'OFF: 用語集',
      llmoOn('comparison') ? 'ON: 比較表' : 'OFF: 比較表',
      llmoOn('quotes') ? 'ON: 引用・根拠（言い換え）' : 'OFF: 引用・根拠（言い換え）',
      llmoOn('templates') ? 'ON: 実務テンプレ' : 'OFF: 実務テンプレ',
      llmoOn('objections') ? 'ON: 反論に答える' : 'OFF: 反論に答える',
    ].join('\n')

    const prompt = [
      'You are a Japanese SEO editor.',
      'Write a practical SEO article in Japanese as Markdown.',
      'No direct copying from any sources. Paraphrase only and add originality.',
      'Avoid generic AI tone. Be concrete, include examples and checklists.',
      '',
      `Title: ${input.title}`,
      `Keywords: ${keywords.join(', ')}`,
      input.persona ? `Persona: ${String(input.persona).slice(0, 1500)}` : '',
      input.searchIntent ? `Search intent: ${String(input.searchIntent).slice(0, 1500)}` : '',
      `Tone: ${input.tone}`,
      forbidden.length ? `Forbidden: ${forbidden.join(' / ')}` : '',
      refUrls.length ? `Reference URLs (do not copy):\n- ${refUrls.join('\n- ')}` : '',
      '',
      'LLMO toggles:',
      llmoText,
      '',
      'Output format (Markdown):',
      '- Start with "# {title}"',
      '- If TL;DR is ON: include "## TL;DR" with bullet points',
      '- Use H2/H3 headings',
      '- If comparison is ON: include at least one markdown table',
      '- If templates is ON: include checklist + steps + copy-ready examples',
      '- If objections is ON: include a section that addresses objections',
      '- If glossary is ON: include a glossary section',
      '- If FAQ is ON: include FAQ section (Q/A)',
      '',
      'Important: keep the first draft within ~6,000-10,000 Japanese chars so it finishes reliably. The user can extend later.',
    ]
      .filter(Boolean)
      .join('\n')

    const finalMarkdown = await geminiGenerateText({
      model: GEMINI_TEXT_MODEL_DEFAULT,
      parts: [{ text: prompt }],
      generationConfig: { temperature: 0.6, maxOutputTokens: 2500 },
    })

    await seoArticle.update({
      where: { id: article.id },
      data: { finalMarkdown, status: 'DONE' },
    })
    await seoJob.update({
      where: { id: job.id },
      data: { status: 'done', step: 'done', progress: 100, finishedAt: new Date() },
    })

    return NextResponse.json({ success: true, articleId: article.id, jobId: job.id })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || '不明なエラー' },
      { status: 400 }
    )
  }
}


