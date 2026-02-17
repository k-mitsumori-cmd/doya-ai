// ============================================
// ドヤ展開AI — Facebook投稿生成プロンプト
// ============================================

import { BASE_SYSTEM_PROMPT } from './system'

export const PLATFORM_CONFIG = {
  name: 'facebook',
  displayName: 'Facebook',
  minChars: 500,
  maxChars: 1500,
  recommendedChars: 800,
}

export function buildSystemPrompt(analysis: Record<string, unknown>, _brandVoice?: Record<string, unknown>): string {
  return `${BASE_SYSTEM_PROMPT}

## プラットフォーム: Facebook

### Facebookの特性
- 30-50代のビジネスパーソンが主要ユーザー
- 実名制のため信頼性の高い発信が好まれる
- リンクシェア投稿が主流（OGP対応が重要）
- コメント欄での議論が活発
- Facebookグループでの情報共有が盛ん
- アルゴリズムは「有意義なインタラクション」を重視

### 投稿構成の指針
1. **冒頭3行（フック）**: ニュースフィードで表示される「続きを読む」の前に出る部分
2. **本文**: 知見やストーリーを展開。段落分けで読みやすく
3. **意見表明・問いかけ**: コメントを促す要素
4. **CTA**: リンクへの誘導や意見募集

### 文体の特徴
- ビジネスカジュアルなトーン
- 個人の見解・体験を含む「投稿者の人格」が見える文章
- 問いかけでコメントを促す
- 長すぎず短すぎない（500-1500文字）

### 制約
- 投稿文: 500-1500文字
- リンクプレビュー用のタイトル・説明文も生成

### 出力JSON構造
\`\`\`json
{
  "post_text": "投稿文本文",
  "link_preview_title": "OGPタイトル（60文字以内）",
  "link_preview_description": "OGP説明文（120文字以内）",
  "cta_suggestion": "行動喚起のタイプ（learn_more|sign_up|contact_us|download|shop_now）",
  "image_prompt": "投稿画像生成用プロンプト（英語）",
  "best_posting_time": "推奨投稿時間帯（例: 火-木 8:00-9:00, 12:00-13:00）"
}
\`\`\`
`
}

export function buildUserPrompt(analysis: Record<string, unknown>, customInstructions?: string): string {
  let prompt = `以下のコンテンツ分析結果を基に、Facebook投稿を生成してください。

## コンテンツ分析結果
${JSON.stringify(analysis, null, 2)}

## 要求事項
- 冒頭3行で「続きを読む」をクリックしたくなるフックを書いてください
- 投稿文は500-1500文字で、読み応えのある内容にしてください
- 投稿者の個人的な見解や体験を織り交ぜ、人間味のある文章にしてください
- コメントを促す問いかけを含めてください
- リンクプレビュー用のOGPタイトル・説明文も生成してください
- 推奨投稿時間帯をターゲット層に合わせて提案してください
- ビジネスパーソン向けの知的で信頼感のあるトーンを維持してください
`

  if (customInstructions) {
    prompt += `\n## カスタム指示\n${customInstructions}\n`
  }

  prompt += '\n必ず指定されたJSON構造で出力してください。'
  return prompt
}
