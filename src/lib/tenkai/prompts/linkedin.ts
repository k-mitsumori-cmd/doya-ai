// ============================================
// ドヤ展開AI — LinkedIn投稿生成プロンプト
// ============================================

import { BASE_SYSTEM_PROMPT } from './system'

export const PLATFORM_CONFIG = {
  name: 'linkedin',
  displayName: 'LinkedIn',
  minChars: 500,
  maxChars: 1300,
  recommendedChars: 800,
}

export function buildSystemPrompt(analysis: Record<string, unknown>, _brandVoice?: Record<string, unknown>): string {
  return `${BASE_SYSTEM_PROMPT}

## プラットフォーム: LinkedIn

### LinkedInの特性
- プロフェッショナルネットワーク。ビジネス文脈での発信が基本
- 「学び」「成長」「キャリア」に関するコンテンツが高エンゲージメント
- 個人のストーリーテリング + ビジネスインサイトの組み合わせが効果的
- ドキュメント投稿（PDFスライド）やニュースレターも活用可能
- ハッシュタグは3-5個が最適
- 冒頭の2-3行が「もっと見る」前に表示される（最重要）

### 投稿構成の指針
1. **冒頭フック（2-3行）**: 「もっと見る」をクリックさせる強い書き出し
2. **ストーリー/問題提起**: 個人の経験やビジネスの課題
3. **インサイト/学び**: 具体的で実践的な知見
4. **行動喚起**: 意見を求める・シェアを促す
5. **ハッシュタグ**: 3-5個、業界関連

### LinkedIn文体の黄金則
- 1段落1-2行で改行
- 空行を多用して視認性UP
- 「。」で終わる短文を連続させるリズム感
- 数字や具体例で説得力を持たせる
- 自慢ではなく「学び」として共有するトーン

### 制約
- 投稿文: 500-1300文字
- ハッシュタグ: 3-5個

### 出力JSON構造
\`\`\`json
{
  "post_text": "投稿文本文（ハッシュタグは含めない）",
  "headline": "プロフィールのヘッドライン風サマリー（100文字以内）",
  "hashtags": ["#ハッシュタグ1", "#ハッシュタグ2", "...（3-5個）"],
  "cta": "コメント誘導の質問文",
  "document_title": "ドキュメント投稿にする場合のタイトル案"
}
\`\`\`
`
}

export function buildUserPrompt(analysis: Record<string, unknown>, customInstructions?: string): string {
  let prompt = `以下のコンテンツ分析結果を基に、LinkedIn投稿を生成してください。

## コンテンツ分析結果
${JSON.stringify(analysis, null, 2)}

## 要求事項
- 冒頭2-3行で「もっと見る」を押させる強力なフックを書いてください
- プロフェッショナルなトーンでありながら、人間味のある文章にしてください
- 個人の経験や学びとしてコンテンツを再構成してください
- 投稿文は500-1300文字で、改行を多用し視認性を高めてください
- ハッシュタグは業界関連で3-5個選んでください
- コメントを促す問いかけ（CTA）を最後に含めてください
- 自慢話にならないよう「学びの共有」というスタンスを維持してください
`

  if (customInstructions) {
    prompt += `\n## カスタム指示\n${customInstructions}\n`
  }

  prompt += '\n必ず指定されたJSON構造で出力してください。'
  return prompt
}
