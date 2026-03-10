// ============================================
// ドヤインタビューAI-X — AIプロンプト
// ============================================

import type { ArticleType, ToneType, CheckType } from './types'

// ---------- 質問生成プロンプト ----------

export function buildQuestionGenerationPrompt(params: {
  templateName: string
  templateCategory: string
  defaultQuestions?: any[]
  projectTitle: string
  companyName?: string | null
  companyUrl?: string | null
  purpose?: string | null
  targetAudience?: string | null
  tone?: ToneType | null
  articleType?: ArticleType | null
  customInstructions?: string | null
}): string {
  const toneLabel: Record<string, string> = {
    friendly: '親しみやすい',
    professional: 'プロフェッショナル',
    casual: 'カジュアル',
    formal: 'フォーマル',
  }

  return `あなたはプロのインタビュアーです。以下の情報を基に、回答者に送るアンケート質問を生成してください。

## プロジェクト情報
- テンプレート: ${params.templateName}（${params.templateCategory}）
- プロジェクト名: ${params.projectTitle}
${params.companyName ? `- 企業名: ${params.companyName}` : ''}
${params.companyUrl ? `- 企業URL: ${params.companyUrl}` : ''}
${params.purpose ? `- 記事の目的: ${params.purpose}` : ''}
${params.targetAudience ? `- 想定読者: ${params.targetAudience}` : ''}
${params.tone ? `- トーン: ${toneLabel[params.tone] || params.tone}` : ''}
${params.customInstructions ? `\n## ユーザーからの追加指示\n${params.customInstructions}` : ''}

## 参考質問（テンプレートのデフォルト）
${params.defaultQuestions?.map((q: any, i: number) => `${i + 1}. ${q.text}`).join('\n') || 'なし'}

## 指示
1. 上記の参考質問を基にしつつ、プロジェクトの目的に合わせて**8〜12問**の質問を生成してください。
2. 質問はインタビュー記事の構成要素（導入→本論→結論）をカバーするよう設計してください。
3. 回答者が具体的なエピソードや数値を出しやすい聞き方にしてください。
4. 各質問には、回答者が答えやすいよう簡潔な補足説明を付けてください。

## 出力形式（JSON配列）
以下のJSON配列を返してください。他のテキストは不要です。
[
  {
    "text": "質問文",
    "description": "回答者への補足説明（任意）",
    "type": "TEXTAREA",
    "required": true,
    "order": 1
  }
]

typeは以下から選択:
- "TEXT": 短い回答（名前、日付など）
- "TEXTAREA": 長文回答（説明、エピソードなど）
- "SELECT": 選択式（options配列を含める）
- "RATING": 5段階評価
- "YES_NO": はい/いいえ`
}

// ---------- 記事生成プロンプト ----------

export function buildArticleGenerationPrompt(params: {
  templateName: string
  templatePrompt?: string | null
  projectTitle: string
  companyName?: string | null
  respondentName?: string | null
  respondentRole?: string | null
  respondentCompany?: string | null
  purpose?: string | null
  targetAudience?: string | null
  tone?: ToneType | null
  articleType?: ArticleType | null
  wordCountTarget?: number | null
  customInstructions?: string | null
  questionsAndAnswers: { question: string; answer: string }[]
}): string {
  const toneLabel: Record<string, string> = {
    friendly: '親しみやすく温かみのある',
    professional: 'プロフェッショナルで信頼感のある',
    casual: 'カジュアルで読みやすい',
    formal: 'フォーマルで格式のある',
  }

  const wordCount = params.wordCountTarget || 3000
  const qaPairs = params.questionsAndAnswers
    .map((qa, i) => `### Q${i + 1}: ${qa.question}\n${qa.answer}`)
    .join('\n\n')

  return `${params.templatePrompt || 'あなたはプロのインタビューライターです。以下のアンケート回答を基に、インタビュー記事を作成してください。'}

## プロジェクト情報
- テーマ: ${params.projectTitle}
${params.companyName ? `- 企業名: ${params.companyName}` : ''}
${params.respondentName ? `- 回答者: ${params.respondentName}` : ''}
${params.respondentRole ? `- 役職: ${params.respondentRole}` : ''}
${params.respondentCompany ? `- 所属: ${params.respondentCompany}` : ''}
${params.purpose ? `- 目的: ${params.purpose}` : ''}
${params.targetAudience ? `- 想定読者: ${params.targetAudience}` : ''}
- トーン: ${params.tone ? toneLabel[params.tone] || params.tone : 'プロフェッショナル'}
- 目標文字数: 約${wordCount}文字

## アンケート回答

${qaPairs}

${params.customInstructions ? `## 追加指示\n${params.customInstructions}\n` : ''}
## 出力ルール
1. Markdown形式で出力してください。
2. 最初の行にH1でタイトルを書いてください。
3. 2行目にリード文（3-4行の要約）を書いてください。
4. 回答者の言葉をなるべく活かし、「」で引用してください。
5. 1文は60文字以内を目安に、読みやすさを重視してください。
6. 数値やエピソードは正確に引用してください。
7. 記事の構成は自然な流れになるようにしてください。
8. H2、H3で適切にセクション分けしてください。
9. 約${wordCount}文字を目安に書いてください。`
}

// ---------- フィードバック適用プロンプト ----------

export function buildFeedbackApplicationPrompt(params: {
  currentContent: string
  feedbacks: { authorType: string; content: string; section?: string | null; category?: string | null }[]
}): string {
  const feedbackList = params.feedbacks
    .map((f, i) => {
      const author = f.authorType === 'COMPANY' ? '企業側' : f.authorType === 'RESPONDENT' ? '回答者' : 'AI'
      const cat = f.category ? `（${f.category}）` : ''
      const sec = f.section ? `[対象セクション: ${f.section}]` : ''
      return `${i + 1}. [${author}${cat}] ${sec}\n   ${f.content}`
    })
    .join('\n\n')

  return `あなたはプロの編集者です。以下の記事に対するフィードバックを反映して、改訂版を作成してください。

## 現在の記事
${params.currentContent}

## 適用すべきフィードバック
${feedbackList}

## 指示
1. フィードバックの内容を忠実に反映してください。
2. 事実の訂正は最優先で対応してください。
3. トーンの調整は全体の統一感を保ちながら行ってください。
4. 追加・削除の要望は文脈に合わせて自然に組み込んでください。
5. フィードバック以外の部分はなるべく変更しないでください。
6. Markdown形式で全文を出力してください。
7. 変更箇所がわかるよう、変更した部分の前に <!-- CHANGED --> コメントを入れてください（最終稿では削除される）。`
}

// ---------- 品質チェックプロンプト ----------

export function buildQualityCheckPrompt(
  checkType: CheckType,
  content: string,
  context?: {
    questionsAndAnswers?: { question: string; answer: string }[]
    companyName?: string | null
    brandColor?: string | null
  }
): string {
  const prompts: Record<CheckType, string> = {
    PROOFREAD: `あなたはプロの校正者です。以下の記事を校正してください。

## チェック項目
- 誤字脱字
- 表記の揺れ（例: カタカナ/漢字の統一）
- 文法ミス
- 不自然な表現
- 句読点の適切さ

## 記事
${content}

## 出力形式（JSON）
{
  "score": 0〜100の品質スコア,
  "passed": スコアが80以上ならtrue,
  "summary": "全体的な評価を2-3文で",
  "suggestions": [
    {
      "type": "typo|grammar|style|consistency",
      "original": "元のテキスト",
      "suggested": "修正案",
      "reason": "修正理由",
      "severity": "high|medium|low"
    }
  ]
}`,

    FACT_CHECK: `あなたはファクトチェッカーです。以下の記事の事実関係を検証してください。

## 記事
${content}

${context?.questionsAndAnswers ? `## 原典（アンケート回答）\n${context.questionsAndAnswers.map((qa, i) => `Q${i + 1}: ${qa.question}\nA: ${qa.answer}`).join('\n\n')}` : ''}

## チェック項目
- 数値・日付の正確性
- 固有名詞の正確性
- 引用の正確性（原典との整合性）
- 矛盾する記述がないか
- 誇張や歪曲がないか

## 出力形式（JSON）
{
  "score": 0〜100の信頼性スコア,
  "passed": スコアが80以上ならtrue,
  "summary": "全体的な評価を2-3文で",
  "suggestions": [
    {
      "type": "number|name|date|quote|claim",
      "original": "記事中の該当箇所",
      "suggested": "修正案（必要な場合）",
      "reason": "検証結果",
      "severity": "high|medium|low"
    }
  ]
}`,

    READABILITY: `あなたは読みやすさの専門家です。以下の記事の読みやすさを評価してください。

## 記事
${content}

## チェック項目
- 1文の長さ（60文字以内推奨）
- 段落の長さ
- 漢字の割合（30-40%推奨）
- 専門用語の説明の有無
- 見出し・小見出しの構成
- 冗長な表現
- 接続詞の適切さ

## 出力形式（JSON）
{
  "score": 0〜100の読みやすさスコア,
  "passed": スコアが70以上ならtrue,
  "summary": "全体的な評価を2-3文で",
  "suggestions": [
    {
      "type": "sentence_length|paragraph|kanji_ratio|jargon|structure|redundancy",
      "original": "該当箇所",
      "suggested": "改善案",
      "reason": "理由",
      "severity": "high|medium|low"
    }
  ]
}`,

    BRAND_CONSISTENCY: `あなたはブランドコンサルタントです。以下の記事がブランドイメージに合っているか評価してください。

## 記事
${content}

## ブランド情報
${context?.companyName ? `- 企業名: ${context.companyName}` : '- 企業名: 不明'}

## チェック項目
- 企業のトーン＆マナーに合っているか
- ネガティブな印象を与える表現がないか
- 競合への言及が適切か
- 企業の価値観と整合しているか
- 読者に信頼感を与える内容か

## 出力形式（JSON）
{
  "score": 0〜100のブランド整合性スコア,
  "passed": スコアが70以上ならtrue,
  "summary": "全体的な評価を2-3文で",
  "suggestions": [
    {
      "type": "tone|negative|competitor|value|trust",
      "original": "該当箇所",
      "suggested": "改善案",
      "reason": "理由",
      "severity": "high|medium|low"
    }
  ]
}`,

    SENSITIVITY: `あなたはコンプライアンス担当者です。以下の記事にセンシティブな内容がないかチェックしてください。

## 記事
${content}

## チェック項目
- 個人情報の不適切な公開
- 差別的な表現
- 機密情報の漏洩
- 著作権の懸念
- 法的リスクのある表現
- ステレオタイプ・バイアス

## 出力形式（JSON）
{
  "score": 0〜100の安全性スコア,
  "passed": スコアが90以上ならtrue,
  "summary": "全体的な評価を2-3文で",
  "suggestions": [
    {
      "type": "privacy|discrimination|confidential|copyright|legal|bias",
      "original": "該当箇所",
      "suggested": "改善案",
      "reason": "理由",
      "severity": "high|medium|low"
    }
  ]
}`,
  }

  return prompts[checkType]
}
