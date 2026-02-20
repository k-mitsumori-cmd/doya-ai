import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { geminiGenerateJson } from '@seo/lib/gemini'
import { z } from 'zod'

/**
 * 記事内容から図解の候補を自動提案するAPI
 */

const SuggestSchema = z.object({
  diagrams: z.array(z.object({
    title: z.string().describe('図解のタイトル（例：「RPO導入フロー」）'),
    description: z.string().describe('図解で表現する内容の詳細'),
    insertAfterHeading: z.string().optional().describe('挿入推奨位置（見出しテキスト）'),
    priority: z.enum(['high', 'medium', 'low']).describe('優先度'),
  })).describe('提案する図解のリスト'),
})

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const article = await (prisma as any).seoArticle.findUnique({
      where: { id: params.id },
      select: {
        title: true,
        outline: true,
        finalMarkdown: true,
        keywords: true,
      },
    })

    if (!article) {
      return NextResponse.json({ success: false, error: 'Article not found' }, { status: 404 })
    }

    const content = article.finalMarkdown || article.outline || ''
    if (!content.trim()) {
      return NextResponse.json({
        success: false,
        error: '記事内容がありません。先に記事を生成してください。',
      }, { status: 400 })
    }

    // 見出しを抽出
    const headings = content.match(/^#{1,3}\s+.+$/gm) || []

    const prompt = `
あなたは記事のビジュアル設計者です。
以下の記事内容を分析して、読者の理解を助ける図解を最大10個提案してください。

## 図解の提案基準
- 複雑なプロセスやフローがある箇所
- 比較や対比を示す箇所
- 概念や関係性を説明している箇所
- 数値やデータを示す箇所
- 読者が迷いやすい選択肢がある箇所

## 記事情報
タイトル: ${article.title}
キーワード: ${(article.keywords || []).join(', ')}

## 記事の見出し構造
${headings.slice(0, 20).join('\n')}

## 記事本文（抜粋）
${content.slice(0, 4000)}

## 出力形式
各図解について以下を提案してください：
- title: 図解のタイトル（簡潔に）
- description: 図解で表現する具体的な内容（Geminiが画像生成できるよう詳細に）
- insertAfterHeading: 挿入推奨位置の見出しテキスト
- priority: high/medium/low

最大10個まで、優先度の高い順に提案してください。
`

    const result = await geminiGenerateJson<{ diagrams?: Array<{ title: string; description: string; insertAfterHeading?: string; priority: 'high' | 'medium' | 'low' }> }>({
      model: 'gemini-3-pro-preview',
      prompt,
      generationConfig: {
        maxOutputTokens: 4096,
      },
    })

    return NextResponse.json({
      success: true,
      suggestions: result.diagrams || [],
    })
  } catch (e: any) {
    console.error('Diagram suggest error:', e)
    return NextResponse.json({ success: false, error: e?.message || 'Unknown error' }, { status: 500 })
  }
}

