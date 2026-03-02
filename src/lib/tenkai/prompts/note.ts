// ============================================
// ドヤ展開AI — note記事生成プロンプト
// ============================================

import { BASE_SYSTEM_PROMPT } from './system'

export const PLATFORM_CONFIG = {
  name: 'note',
  displayName: 'note',
  minChars: 2000,
  maxChars: 5000,
  recommendedChars: 3000,
}

export function buildSystemPrompt(analysis: Record<string, unknown>, _brandVoice?: Record<string, unknown>): string {
  return `${BASE_SYSTEM_PROMPT}

## プラットフォーム: note

### noteの特性
- 個人の知見や体験を深く掘り下げた長文記事が好まれる
- 「自分語り」や個人的な視点が価値を持つプラットフォーム
- 読者は知的好奇心が高く、表面的な内容では満足しない
- 有料記事文化があり、価値のあるコンテンツが求められる
- マガジン機能でシリーズ化しやすい構成が望ましい

### 記事構成の指針
1. **フック（冒頭100文字）**: 読者の問題意識や好奇心に刺さる導入
2. **背景・文脈**: なぜこのテーマが重要なのかの説明
3. **本論**: 具体的な知見、体験、データに基づいた内容
4. **考察**: 著者独自の見解や洞察
5. **まとめ・行動喚起**: 読者が次に取るべきアクション

### 文体の特徴
- 「です・ます」調を基本としつつ、時に語りかけるような親しみやすさ
- 段落は短めに区切り、読みやすさを重視
- 適度な見出し（H2, H3）で構造を明確に
- 箇条書きや太字を効果的に使用

### 文字数
- 最小: ${PLATFORM_CONFIG.minChars}文字
- 最大: ${PLATFORM_CONFIG.maxChars}文字
- 推奨: ${PLATFORM_CONFIG.recommendedChars}文字

### 出力JSON構造
\`\`\`json
{
  "title": "記事タイトル（40文字以内、好奇心を刺激する表現）",
  "body": "記事本文（Markdown形式）",
  "tags": ["タグ1", "タグ2", "...（最大5個）"],
  "cover_image_prompt": "カバー画像生成用のプロンプト（英語、具体的な描写）"
}
\`\`\`
`
}

export function buildUserPrompt(analysis: Record<string, unknown>, customInstructions?: string): string {
  let prompt = `以下のコンテンツ分析結果を基に、note向けの記事を生成してください。

## コンテンツ分析結果
${JSON.stringify(analysis, null, 2)}

## 要求事項
- タイトルは40文字以内で、noteユーザーの知的好奇心を刺激するものにしてください
- 本文はMarkdown形式で、H2・H3見出しを効果的に使ってください
- 元コンテンツの核心を深掘りし、著者の視点として再構成してください
- 「体験→学び→実践」の流れを意識してください
- 冒頭の2-3行で読者を引き込む導入を書いてください
- タグはnoteで検索されやすいものを5個以内で選んでください
`

  if (customInstructions) {
    prompt += `\n## カスタム指示\n${customInstructions}\n`
  }

  prompt += '\n必ず指定されたJSON構造で出力してください。'
  return prompt
}
