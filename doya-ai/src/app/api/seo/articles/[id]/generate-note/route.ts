import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { geminiGenerateText } from '@seo/lib/gemini'

/**
 * note記事に特化した生成API
 * 
 * noteの特徴:
 * - 読みやすさ重視、1文が短い
 * - パーソナルな語り口（「です・ます」より「だ・である」や「ですよね」）
 * - 適度な改行と余白
 * - 見出しは##と###のみ使用
 * - 箇条書きより段落で語る
 * - 冒頭で興味を引く（問いかけ、共感、驚き）
 * - 体験談や具体例が多い
 * - 最後に読者へのメッセージ
 */

const NOTE_ARTICLE_PROMPT = `
あなたはnote.comで人気のあるライターです。
以下の情報を元に、noteで読まれる良質な記事を書いてください。

## note記事の特徴（必ず守ること）

### 文体・トーン
- 1文は短く、40文字以内を目安に
- 「〜だ。」「〜である。」より「〜ですよね。」「〜なんです。」のような親しみやすい文体
- 読者に語りかけるように書く（「あなた」「みなさん」を適度に使う）
- 断言より問いかけを多用（「〜ではないでしょうか？」「〜と思いませんか？」）

### 構成
- 冒頭: 読者の共感を呼ぶ問いかけ、または意外性のある一文で始める
- 導入: なぜこの記事を書いたのか、自分の経験を交えて
- 本論: 見出しは2〜4個程度、各セクションは簡潔に
- 結び: 読者への励ましやメッセージ、次のアクションの提案

### フォーマット
- 見出しは ## と ### のみ使用（# は使わない）
- 段落は3〜5行ごとに空行を入れる
- 箇条書きは控えめに（多くても1セクションに1回）
- 絵文字は控えめに使用可（1記事に3〜5個程度）
- 太字（**強調**）は本当に重要な箇所のみ

### 避けるべきこと
- 長い一文（60文字以上）
- 堅苦しいビジネス文体
- 情報の羅列だけ（体験や意見がない）
- 過度な装飾や絵文字の乱用
- SEO臭い見出し（「〜とは？」「〜5選」の連発）

### noteで好まれる要素
- 失敗談や試行錯誤のプロセス
- 「最初は〜だったけど」という変化の物語
- 具体的なエピソードや数字
- 読者が「自分もやってみよう」と思える実践的な内容
- 最後に温かいメッセージ

---

## 記事情報

タイトル: {title}

キーワード: {keywords}

想定読者: {persona}

書きたいこと・伝えたいメッセージ: {searchIntent}

参考情報（あれば活用）: {references}

目標文字数: {targetChars}文字程度

トーン: {tone}

---

## 出力形式

上記の「note記事の特徴」を厳守して、Markdown形式で記事を出力してください。
見出しの前後には必ず空行を入れ、読みやすさを重視してください。

必ず冒頭に読者の心を掴む一文から始めてください。
`;

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const article = await (prisma as any).seoArticle.findUnique({
      where: { id: params.id },
      include: {
        references: true,
        knowledgeItems: true,
      },
    })

    if (!article) {
      return NextResponse.json({ success: false, error: 'Article not found' }, { status: 404 })
    }

    // 参考情報をまとめる
    const refSummaries = (article.references || [])
      .map((r: any) => r.summary || r.title || r.url)
      .filter(Boolean)
      .slice(0, 3)
      .join('\n- ')

    // プロンプトを構築
    const prompt = NOTE_ARTICLE_PROMPT
      .replace('{title}', article.title || '')
      .replace('{keywords}', (article.keywords || []).join(', '))
      .replace('{persona}', article.persona || '一般的な読者')
      .replace('{searchIntent}', article.searchIntent || '情報を伝える')
      .replace('{references}', refSummaries ? `- ${refSummaries}` : 'なし')
      .replace('{targetChars}', String(Math.min(article.targetChars || 3000, 8000))) // noteは長すぎない方が良い
      .replace('{tone}', article.tone || 'カジュアル')

    // Geminiで生成
    const noteMarkdown = await geminiGenerateText({
      model: 'gemini-3-pro-preview',
      parts: [{ text: prompt }],
      generationConfig: {
        maxOutputTokens: 16000,
      },
    })

    // 記事を更新（note用のマークダウンとして保存）
    // finalMarkdownとは別にnoteMarkdownを保存するか、
    // ここでは一旦knowledgeItemsとして保存
    await (prisma as any).seoKnowledgeItem.create({
      data: {
        articleId: params.id,
        type: 'note_article',
        title: 'note記事',
        content: noteMarkdown,
      },
    })

    return NextResponse.json({
      success: true,
      noteMarkdown,
      message: 'note記事を生成しました',
    })
  } catch (e: any) {
    console.error('Note generation error:', e)
    return NextResponse.json({ success: false, error: e?.message || 'Unknown error' }, { status: 500 })
  }
}

