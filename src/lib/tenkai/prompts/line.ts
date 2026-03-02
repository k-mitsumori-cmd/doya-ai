// ============================================
// ドヤ展開AI — LINE公式アカウント生成プロンプト
// ============================================

import { BASE_SYSTEM_PROMPT } from './system'

export const PLATFORM_CONFIG = {
  name: 'line',
  displayName: 'LINE公式アカウント',
  minChars: 100,
  maxChars: 1500,
  recommendedChars: 500,
}

export function buildSystemPrompt(analysis: Record<string, unknown>, _brandVoice?: Record<string, unknown>): string {
  return `${BASE_SYSTEM_PROMPT}

## プラットフォーム: LINE公式アカウント

### LINE公式の特性
- プッシュ通知でダイレクトに届く「1対1」感覚のメディア
- 開封率が非常に高い（メルマガの3-5倍）
- 長文は読まれにくい。簡潔で要点を絞ったメッセージが重要
- 配信頻度を気にするユーザーが多い（ブロックリスク）
- リッチメッセージ・リッチメニューとの連携が効果的

### メッセージ構成の指針
1. **メッセージ1（フック+要点）**: 開封直後に目に入る最初のメッセージ。核心を端的に伝える
2. **メッセージ2（詳細+価値）**: 具体的な情報やベネフィットの説明（省略可）
3. **メッセージ3（CTA）**: 行動を促すメッセージ。URLやクーポン案内（省略可）

### 文体の特徴
- 「です・ます」調で親しみやすく
- 1メッセージ100-500文字（短い方が好まれる）
- 改行を多用してスマホで読みやすく
- 重要ポイントは【】や■で強調
- 適度な絵文字使用

### 制約
- メッセージ数: 1-3通（配信コスト考慮）
- 各メッセージ: 100-500文字

### 出力JSON構造
\`\`\`json
{
  "messages": [
    { "type": "text", "text": "メッセージ本文", "char_count": 0 }
  ],
  "rich_menu_suggestion": "リッチメニューに載せるべきアクション提案",
  "recommended_send_time": "推奨配信時間帯（例: 平日12:00-13:00）"
}
\`\`\`
`
}

export function buildUserPrompt(analysis: Record<string, unknown>, customInstructions?: string): string {
  let prompt = `以下のコンテンツ分析結果を基に、LINE公式アカウントの配信メッセージを生成してください。

## コンテンツ分析結果
${JSON.stringify(analysis, null, 2)}

## 要求事項
- 1-3通のメッセージで構成してください（配信コストを考慮し、最小限に）
- 各メッセージは100-500文字に収めてください
- 1通目はプッシュ通知のプレビューに表示されるため、最も重要な情報を冒頭に
- スマートフォンでの閲覧を前提に、短い段落と改行を多用してください
- ブロックされないよう、押し付けがましくない自然なトーンで
- リッチメニューへの誘導やURL遷移を意識したCTAを含めてください
- 推奨配信時間帯を分析結果に基づいて提案してください
`

  if (customInstructions) {
    prompt += `\n## カスタム指示\n${customInstructions}\n`
  }

  prompt += '\n必ず指定されたJSON構造で出力してください。'
  return prompt
}
