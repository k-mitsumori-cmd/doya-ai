// ============================================
// ドヤ展開AI — Xスレッド生成プロンプト
// ============================================

import { BASE_SYSTEM_PROMPT } from './system'

export const PLATFORM_CONFIG = {
  name: 'x',
  displayName: 'X (Twitter)',
  minChars: 420,
  maxChars: 1400,
  recommendedChars: 700,
}

export function buildSystemPrompt(analysis: Record<string, unknown>, _brandVoice?: Record<string, unknown>): string {
  return `${BASE_SYSTEM_PROMPT}

## プラットフォーム: X (旧Twitter) スレッド

### Xの特性
- 1ツイート最大280文字
- スレッド形式で深い内容を展開可能
- リポスト・いいねによる拡散がカギ
- タイムライン上で目を引く最初のツイートが最重要
- ハッシュタグは1-3個程度が最適（多すぎるとスパム扱い）

### スレッド構成の指針
1. **1ツイート目（フック）**: 最も重要。驚き・問いかけ・数字で注目を集める
2. **2-3ツイート目（問題提起）**: 読者の共感を得る課題の提示
3. **中盤ツイート（解説）**: 核心となる知見・データの展開
4. **後半ツイート（具体例）**: 実例やケーススタディ
5. **最終ツイート（CTA）**: まとめ + 行動喚起 + ハッシュタグ

### 文体の特徴
- 簡潔で力強い表現
- 体言止め、倒置法の活用
- 「→」「|」などの区切り文字で視認性UP
- 絵文字は最小限（各ツイート0-1個）
- 改行を効果的に使用

### 制約
- 各ツイート: 280文字以内（厳守）
- スレッド長: 3-10ツイート
- ハッシュタグ: 最終ツイートに集約、3個以内

### 出力JSON構造
\`\`\`json
{
  "tweets": [
    { "index": 1, "text": "ツイート本文（280文字以内）", "char_count": 0 }
  ],
  "thread_count": 5,
  "hashtags": ["#ハッシュタグ1", "#ハッシュタグ2"],
  "estimated_engagement_type": "educational|viral|discussion|informative"
}
\`\`\`
`
}

export function buildUserPrompt(analysis: Record<string, unknown>, customInstructions?: string): string {
  let prompt = `以下のコンテンツ分析結果を基に、X (Twitter)のスレッドを生成してください。

## コンテンツ分析結果
${JSON.stringify(analysis, null, 2)}

## 要求事項
- 1ツイート目は最も重要です。タイムライン上で思わず手を止めるフックを書いてください
- 各ツイートは必ず280文字以内に収めてください（char_countを正確に記入）
- スレッドは3-10ツイートで構成してください
- 元コンテンツのエッセンスを凝縮し、Xユーザーに刺さる表現に変換してください
- 最後のツイートにハッシュタグを含めてください（3個以内）
- 数字や具体的なデータがあれば積極的に使ってください
- 「🧵スレッド」などの表記は不要です
`

  if (customInstructions) {
    prompt += `\n## カスタム指示\n${customInstructions}\n`
  }

  prompt += '\n必ず指定されたJSON構造で出力してください。'
  return prompt
}
