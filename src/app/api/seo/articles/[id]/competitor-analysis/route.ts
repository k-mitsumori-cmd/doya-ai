import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { geminiGenerateText, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'

export const maxDuration = 120 // 2分

/**
 * 競合記事との比較分析を行うAPI
 * 本記事の内容と参照URLの競合記事を比較し、差別化ポイントを分析
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Article ID is required' }, { status: 400 })
    }

    // 記事を取得
    const article = await prisma.seoArticle.findUnique({
      where: { id },
      include: {
        references: true,
        knowledgeItems: true,
      },
    })

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    // 本記事の内容
    const articleContent = article.finalMarkdown || ''
    if (!articleContent.trim()) {
      return NextResponse.json({ error: '本記事の内容がありません。先に記事を生成してください。' }, { status: 400 })
    }

    // 参照URL（競合記事）を取得
    const references = article.references || []
    const referenceUrls = Array.isArray(article.referenceUrls) ? article.referenceUrls : []
    const allUrls = [
      ...references.map((r: any) => ({ url: r.url, title: r.title })),
      ...referenceUrls.map((u: string) => ({ url: u, title: '' })),
    ].filter((r) => r.url)

    // 競合記事の内容を取得（最大5記事）
    const competitorContents: { url: string; title: string; content: string }[] = []
    for (const ref of allUrls.slice(0, 5)) {
      try {
        const res = await fetch(ref.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; SEOBot/1.0)',
          },
          signal: AbortSignal.timeout(10000),
        })
        if (res.ok) {
          const html = await res.text()
          // HTMLからテキストを抽出（簡易版）
          const textContent = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 8000) // 8000文字まで

          if (textContent.length > 200) {
            competitorContents.push({
              url: ref.url,
              title: ref.title || extractTitleFromHtml(html) || ref.url,
              content: textContent,
            })
          }
        }
      } catch {
        // 取得失敗は無視
      }
    }

    if (competitorContents.length === 0) {
      return NextResponse.json({
        error: '競合記事の取得に失敗しました。参照URLを確認してください。',
      }, { status: 400 })
    }

    // 本記事の概要（最初の5000文字）
    const articleSummary = articleContent.slice(0, 5000)

    // AIで比較分析
    const prompt = buildCompetitorAnalysisPrompt({
      articleTitle: article.title || '',
      articleKeywords: Array.isArray(article.keywords) ? article.keywords : [],
      articleSummary,
      competitors: competitorContents,
    })

    const analysisResult = await geminiGenerateText({
      model: GEMINI_TEXT_MODEL_DEFAULT,
      parts: [{ text: prompt }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4000,
      },
    })

    if (!analysisResult?.trim()) {
      return NextResponse.json({ error: '分析結果の生成に失敗しました' }, { status: 500 })
    }

    // 結果をknowledgeItemsに保存
    const existingItem = (article.knowledgeItems || []).find((k: any) => k.type === 'competitor_report')

    if (existingItem) {
      await prisma.seoKnowledgeItem.update({
        where: { id: existingItem.id },
        data: {
          content: analysisResult,
          updatedAt: new Date(),
        },
      })
    } else {
      await prisma.seoKnowledgeItem.create({
        data: {
          articleId: id,
          type: 'competitor_report',
          content: analysisResult,
        },
      })
    }

    return NextResponse.json({
      success: true,
      report: analysisResult,
      analyzedCompetitors: competitorContents.length,
    })
  } catch (error: any) {
    console.error('[competitor-analysis] error:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

function extractTitleFromHtml(html: string): string {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return match?.[1]?.trim() || ''
}

function buildCompetitorAnalysisPrompt(args: {
  articleTitle: string
  articleKeywords: string[]
  articleSummary: string
  competitors: { url: string; title: string; content: string }[]
}): string {
  const { articleTitle, articleKeywords, articleSummary, competitors } = args

  const competitorBlocks = competitors
    .map(
      (c, i) => `
### 競合記事${i + 1}: ${c.title}
URL: ${c.url}
内容（抜粋）:
${c.content.slice(0, 3000)}
`
    )
    .join('\n')

  return `あなたはSEOの専門家です。以下の「本記事」と「競合記事」を比較分析し、SEOで勝つための差別化ポイントをレポートしてください。

## 本記事
タイトル: ${articleTitle}
キーワード: ${articleKeywords.join(', ')}
内容（抜粋）:
${articleSummary}

## 競合記事（${competitors.length}件）
${competitorBlocks}

## 出力形式（Markdown）

以下の形式で分析結果を出力してください：

### 📊 競合記事の傾向分析

| 項目 | 競合記事の傾向 | 本記事の状況 |
|------|--------------|-------------|
| 文字数 | （競合の平均的な文字数） | （本記事の文字数） |
| 構成 | （競合の見出し構成の特徴） | （本記事の構成） |
| 情報の深さ | （競合の情報量・専門性） | （本記事の情報量） |
| 独自性 | （競合の独自コンテンツ） | （本記事の独自性） |
| CTA | （競合のCTA配置） | （本記事のCTA） |

### ✅ 本記事の優位点（SEOで勝てるポイント）

- （本記事が競合より優れている点を3-5個）

### ⚠️ 改善すべき点（競合に負けている部分）

- （競合に劣っている点、追加すべき情報を3-5個）

### 🎯 差別化のための具体的アクション

1. （SEOで上位を取るための具体的な改善アクション）
2. （追加すべきコンテンツ）
3. （強化すべきセクション）

### 💡 キーワード戦略の提案

- メインキーワード: ${articleKeywords[0] || '（未設定）'}
- 追加すべき関連キーワード: （競合が使っていて本記事に不足しているキーワード）
- ロングテールキーワード案: （狙えるニッチなキーワード）

---
分析は客観的かつ具体的に行い、実行可能なアドバイスを提供してください。
`
}
