// ============================================
// ドヤ展開AI — Blog(SEO)記事生成プロンプト
// ============================================

import { BASE_SYSTEM_PROMPT } from './system'

export const PLATFORM_CONFIG = {
  name: 'blog',
  displayName: 'Blog (SEO)',
  minChars: 3000,
  maxChars: 8000,
  recommendedChars: 5000,
}

export function buildSystemPrompt(analysis: Record<string, unknown>, _brandVoice?: Record<string, unknown>): string {
  return `${BASE_SYSTEM_PROMPT}

## プラットフォーム: Blog (SEO最適化)

### SEOブログの特性
- Google検索からの流入を最大化することが主目的
- E-E-A-T（経験・専門性・権威性・信頼性）を意識した内容
- 構造化データ（FAQ Schema等）の対応
- 検索意図（Search Intent）に合致したコンテンツ設計

### SEO記事構成の指針
1. **タイトルタグ**: メインキーワードを含む30-60文字
2. **メタディスクリプション**: 120-160文字の要約
3. **H1**: タイトルと同一または類似
4. **導入文（リード）**: 読者の悩みに共感 → 解決策の提示 → 記事を読むメリット
5. **H2見出し（4-8個）**: 検索キーワードを自然に含む
6. **H3見出し**: 必要に応じてH2を分割
7. **本文**: 具体例・データ・引用を含む充実した内容
8. **FAQ**: よくある質問と回答（3-5個）
9. **まとめ**: 要点の整理とCTA

### SEO技法
- メインキーワードは記事全体で自然に3-5回出現させる
- 関連キーワード（LSI）を本文中に自然に散りばめる
- 内部リンク用のアンカーテキストを意識した表現
- 読了時間の目安を提供

### 文字数
- 最小: ${PLATFORM_CONFIG.minChars}文字
- 最大: ${PLATFORM_CONFIG.maxChars}文字
- 推奨: ${PLATFORM_CONFIG.recommendedChars}文字
- H2見出し: 4-8個

### 出力JSON構造
\`\`\`json
{
  "seo": {
    "title": "SEOタイトル（30-60文字、メインKW含む）",
    "meta_description": "メタディスクリプション（120-160文字）",
    "slug": "url-friendly-slug",
    "focus_keyword": "メインキーワード",
    "secondary_keywords": ["関連KW1", "関連KW2"]
  },
  "body_markdown": "Markdown形式の本文",
  "body_html": "HTML形式の本文",
  "table_of_contents": [
    { "level": 2, "text": "見出しテキスト", "id": "heading-id" }
  ],
  "faq_schema": [
    { "question": "質問文", "answer": "回答文" }
  ],
  "featured_image_prompt": "アイキャッチ画像生成用プロンプト（英語）",
  "estimated_reading_time_minutes": 8
}
\`\`\`
`
}

export function buildUserPrompt(analysis: Record<string, unknown>, customInstructions?: string): string {
  let prompt = `以下のコンテンツ分析結果を基に、SEO最適化されたブログ記事を生成してください。

## コンテンツ分析結果
${JSON.stringify(analysis, null, 2)}

## 要求事項
- フォーカスキーワードを分析結果のキーワードから選定してください
- タイトルは検索結果でクリックされやすい表現にしてください（数字、具体性、ベネフィット）
- H2見出しは4-8個で、検索意図に沿った構成にしてください
- 各セクションは具体的な情報・データ・事例を含めてください
- FAQ Schemaは検索でよく聞かれる質問を3-5個設定してください
- body_markdownとbody_htmlの両方を出力してください
- 読了時間を推定してください
- slugは英語のURL-friendlyな形式にしてください
`

  if (customInstructions) {
    prompt += `\n## カスタム指示\n${customInstructions}\n`
  }

  prompt += '\n必ず指定されたJSON構造で出力してください。'
  return prompt
}
