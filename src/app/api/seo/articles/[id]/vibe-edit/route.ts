import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { getSeoArticleOwner } from '@/lib/seoArticleOwner'
import { geminiGenerateText, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BodySchema = z.object({
  // 編集対象のセクション見出し（H2/H3テキスト）
  sectionHeading: z.string().min(1),
  // ユーザーからの修正指示（バイブコーディング的な自然言語）
  instruction: z.string().min(1).max(2000),
  // 現在のセクション内容（オプション: なければ本文から抽出）
  currentContent: z.string().optional(),
})

function clampText(s: string, max = 12000): string {
  if (!s) return ''
  return s.length > max ? `${s.slice(0, max)}\n...(truncated)` : s
}

// Markdownから特定セクションを抽出
function extractSection(markdown: string, heading: string): { content: string; startLine: number; endLine: number } | null {
  const lines = (markdown || '').replace(/\r\n/g, '\n').split('\n')
  const headingLower = heading.toLowerCase().trim()
  
  let startLine = -1
  let startLevel = 0
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const match = line.match(/^(#{2,4})\s+(.+)$/)
    if (match) {
      const level = match[1].length
      const text = match[2].trim().toLowerCase()
      
      if (startLine === -1) {
        // 見出しを探す
        if (text === headingLower || text.includes(headingLower) || headingLower.includes(text)) {
          startLine = i
          startLevel = level
        }
      } else {
        // 次の同レベル以上の見出しで終了
        if (level <= startLevel) {
          return {
            content: lines.slice(startLine, i).join('\n'),
            startLine,
            endLine: i,
          }
        }
      }
    }
  }
  
  // 最後まで続いた場合
  if (startLine !== -1) {
    return {
      content: lines.slice(startLine).join('\n'),
      startLine,
      endLine: lines.length,
    }
  }
  
  return null
}

// セクションを置換
function replaceSection(markdown: string, startLine: number, endLine: number, newContent: string): string {
  const lines = (markdown || '').replace(/\r\n/g, '\n').split('\n')
  const before = lines.slice(0, startLine)
  const after = lines.slice(endLine)
  return [...before, newContent, ...after].join('\n')
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params
  const articleId = String(params.id || '').trim()
  
  if (!articleId) {
    return NextResponse.json({ success: false, error: 'invalid id' }, { status: 400 })
  }

  try {
    const owner = await getSeoArticleOwner(req)
    if (!owner) return NextResponse.json({ success: false, error: 'ログインまたはゲスト認証が必要です' }, { status: 401 })
    await ensureSeoSchema()

    const bodyRaw = await req.json().catch(() => ({}))
    const body = BodySchema.parse(bodyRaw)

    const p = prisma as any
    const article = await p.seoArticle.findFirst({ where: { id: articleId, ...owner } })
    if (!article) {
      return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
    }

    const finalMarkdown = String(article.finalMarkdown || '')
    if (!finalMarkdown) {
      return NextResponse.json({ success: false, error: '記事本文がまだ生成されていません' }, { status: 400 })
    }

    // セクションを抽出
    const section = extractSection(finalMarkdown, body.sectionHeading)
    if (!section) {
      return NextResponse.json({ 
        success: false, 
        error: `セクション「${body.sectionHeading}」が見つかりませんでした` 
      }, { status: 400 })
    }

    const currentContent = body.currentContent || section.content

    // AIで修正
    const prompt = [
      'あなたはプロのSEOライター・編集者です。',
      'ユーザーの指示に従って、以下のセクションを修正してください。',
      '',
      '【重要ルール】',
      '- 指示された部分だけを修正し、それ以外は極力維持する',
      '- 見出し（##, ###）の構造は維持する',
      '- Markdown形式で出力する',
      '- 架空の情報は追加しない',
      '- 自然な日本語で、読みやすく',
      '',
      `【記事タイトル】${article.title}`,
      `【トーン】${article.tone || '丁寧'}`,
      '',
      '【修正対象セクション】',
      '```',
      clampText(currentContent, 8000),
      '```',
      '',
      '【ユーザーからの修正指示】',
      body.instruction,
      '',
      '【出力】',
      '修正後のセクション全体をMarkdownで出力してください（見出しから始めてください）。',
    ].join('\n')

    const revised = await geminiGenerateText({
      model: GEMINI_TEXT_MODEL_DEFAULT,
      parts: [{ text: prompt }],
      generationConfig: { temperature: 0.5, maxOutputTokens: 8000 },
    })

    if (!revised || !revised.trim()) {
      return NextResponse.json({ success: false, error: 'AIからの応答が空でした' }, { status: 500 })
    }

    // 本文を更新
    const newMarkdown = replaceSection(finalMarkdown, section.startLine, section.endLine, revised.trim())

    await p.seoArticle.update({
      where: { id: articleId, ...owner, updatedAt: article.updatedAt, finalMarkdown: article.finalMarkdown },
      data: { finalMarkdown: newMarkdown, updatedAt: new Date(Math.max(Date.now(), new Date(article.updatedAt).getTime() + 1)) },
    })

    return NextResponse.json({
      success: true,
      sectionHeading: body.sectionHeading,
      revisedContent: revised.trim(),
      message: `「${body.sectionHeading}」を修正しました`,
    })
  } catch (e: any) {
    if (e?.code === 'P2025') return NextResponse.json({ success: false, error: '編集中に記事またはアクセス権が変更されました。再読み込みしてから編集してください。' }, { status: 409 })
    if (e?.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'バリデーションエラー', details: e.issues },
        { status: 400 }
      )
    }
    console.error('[vibe-edit] failed', { articleId, error: e?.message, stack: e?.stack })
    return NextResponse.json(
      { success: false, error: '記事を編集できませんでした。時間をおいて再試行してください。' },
      { status: 500 }
    )
  }
}

