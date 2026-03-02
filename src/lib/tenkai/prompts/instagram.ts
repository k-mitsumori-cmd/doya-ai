// ============================================
// ドヤ展開AI — Instagram生成プロンプト
// ============================================

import { BASE_SYSTEM_PROMPT } from './system'

export const PLATFORM_CONFIG = {
  name: 'instagram',
  displayName: 'Instagram',
  minChars: 300,
  maxChars: 1000,
  recommendedChars: 600,
}

export function buildSystemPrompt(analysis: Record<string, unknown>, _brandVoice?: Record<string, unknown>): string {
  return `${BASE_SYSTEM_PROMPT}

## プラットフォーム: Instagram

### Instagramの特性
- ビジュアルファーストのプラットフォーム
- キャプションは「もっと見る」をクリックさせる冒頭が重要
- ハッシュタグが発見性（ディスカバラビリティ）のカギ
- カルーセル投稿（複数枚スライド）が高エンゲージメント
- 保存・シェアされるコンテンツが評価される

### キャプション構成の指針
1. **冒頭1行（フック）**: 「もっと見る」をタップさせる強い一文
2. **ストーリー/価値提供**: 知見・体験を親しみやすく展開
3. **CTA**: いいね・保存・コメントを促す呼びかけ
4. **ハッシュタグブロック**: 20-30個のハッシュタグ

### ハッシュタグ戦略
- 大規模タグ（100万投稿以上）: 5-8個
- 中規模タグ（1万-100万投稿）: 8-12個
- 小規模・ニッチタグ（1万投稿未満）: 5-10個
- ブランドタグ: 1-2個

### 文体の特徴
- 親しみやすく、共感を呼ぶ口調
- 絵文字を適度に使用（読みやすさのアクセントとして）
- 改行を多用して読みやすくする
- 箇条書きや数字リストで情報を整理

### 制約
- キャプション: 300-1000文字
- ハッシュタグ: 20-30個

### 出力JSON構造
\`\`\`json
{
  "caption": "キャプション本文（改行を含む、ハッシュタグは含めない）",
  "hashtags": ["ハッシュタグ1", "ハッシュタグ2", "...（#なし、20-30個）"],
  "image_prompts": [
    "カルーセル1枚目の画像生成プロンプト（英語）",
    "カルーセル2枚目の画像生成プロンプト（英語）"
  ],
  "alt_text": "アクセシビリティ用の画像説明文（日本語）",
  "carousel_texts": [
    "スライド1に表示するテキスト（カルーセル投稿用）",
    "スライド2に表示するテキスト"
  ]
}
\`\`\`
`
}

export function buildUserPrompt(analysis: Record<string, unknown>, customInstructions?: string): string {
  let prompt = `以下のコンテンツ分析結果を基に、Instagram投稿用のキャプションとハッシュタグを生成してください。

## コンテンツ分析結果
${JSON.stringify(analysis, null, 2)}

## 要求事項
- 冒頭1行はフィード上で「もっと見る」をタップしたくなる強力なフックにしてください
- キャプションは300-1000文字で、改行を効果的に使ってください
- ハッシュタグは20-30個、大・中・小規模をバランスよく選んでください
- カルーセル投稿を想定し、3-5枚のスライド用テキストを生成してください
- 各スライドは要点を1つに絞り、ビジュアルで映える短いテキストにしてください
- image_promptsはDALL-Eやstable diffusionで使える英語の画像生成プロンプトにしてください
- 保存・シェアしたくなる「価値提供型」のコンテンツを意識してください
`

  if (customInstructions) {
    prompt += `\n## カスタム指示\n${customInstructions}\n`
  }

  prompt += '\n必ず指定されたJSON構造で出力してください。'
  return prompt
}
