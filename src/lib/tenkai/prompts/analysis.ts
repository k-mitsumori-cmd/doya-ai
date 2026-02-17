// ============================================
// ドヤ展開AI — コンテンツ分析プロンプト（Gemini用）
// ============================================

/**
 * Gemini 2.0 Flashに送るコンテンツ分析用プロンプトを構築
 */
export function buildAnalysisPrompt(text: string, title?: string): string {
  return `あなたはコンテンツ分析の専門家です。以下のテキストコンテンツを詳細に分析し、マルチプラットフォーム展開に必要な構造化データを抽出してください。

## 分析対象
${title ? `タイトル: ${title}\n` : ''}
---
${text.slice(0, 50000)}
---

## 分析項目

以下のJSON構造で分析結果を出力してください:

\`\`\`json
{
  "summary": "コンテンツ全体の要約（200文字以内）",
  "keywords": ["主要キーワード1", "主要キーワード2", "...（最大10個）"],
  "hashtags": ["#ハッシュタグ1", "#ハッシュタグ2", "...（最大15個、日本語ハッシュタグ含む）"],
  "topic_category": "テクノロジー|ビジネス|マーケティング|ライフスタイル|教育|健康|エンタメ|金融|社会|その他",
  "tone": "informative|persuasive|educational|entertaining|inspirational|professional|casual",
  "sentiment": "positive|neutral|negative|mixed",
  "target_audience": "想定される主要ターゲット層の説明（例: IT企業のマーケティング担当者、30-40代）",
  "key_facts": [
    "コンテンツ内の重要な事実・主張1",
    "コンテンツ内の重要な事実・主張2",
    "...（最大8個）"
  ],
  "main_argument": "コンテンツの主要な論点・メッセージ（100文字以内）",
  "structure_type": "howto|listicle|narrative|opinion|case_study|interview|news|review",
  "expertise_level": "beginner|intermediate|advanced",
  "actionable_insights": [
    "読者が実行できる具体的なアクション1",
    "...（最大5個）"
  ],
  "emotional_hooks": [
    "読者の感情に訴える要素1",
    "...（最大3個）"
  ],
  "unique_angles": [
    "このコンテンツならではのユニークな視点1",
    "...（最大3個）"
  ]
}
\`\`\`

## 注意事項
- 元テキストに存在しない情報を追加しないでください
- キーワードはSEOを意識して抽出してください
- ハッシュタグはSNSでの拡散を意識し、検索されやすいものを選んでください
- 必ずJSON形式で出力してください
`
}
