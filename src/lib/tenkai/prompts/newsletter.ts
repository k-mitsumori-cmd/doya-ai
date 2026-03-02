// ============================================
// ドヤ展開AI — メルマガ生成プロンプト
// ============================================

import { BASE_SYSTEM_PROMPT } from './system'

export const PLATFORM_CONFIG = {
  name: 'newsletter',
  displayName: 'メールマガジン',
  minChars: 800,
  maxChars: 2000,
  recommendedChars: 1200,
}

export function buildSystemPrompt(analysis: Record<string, unknown>, _brandVoice?: Record<string, unknown>): string {
  return `${BASE_SYSTEM_PROMPT}

## プラットフォーム: メールマガジン（ニュースレター）

### メルマガの特性
- 件名が開封率を左右する最重要要素
- プレビューテキスト（プリヘッダー）も開封判断に影響
- 読者は「自分宛て」の特別感を期待している
- 情報過多は離脱を招く。1通1テーマが基本
- CTAは明確に1つに絞る
- HTML/テキスト両対応が必要

### メルマガ構成の指針
1. **件名（30-40文字）**: 好奇心を刺激する / 具体的なベネフィット / 緊急性
2. **プレビューテキスト**: 件名を補完する1文
3. **挨拶・導入**: パーソナルな書き出し（1-2文）
4. **本文**: テーマの展開（見出し・箇条書きで読みやすく）
5. **CTA**: 具体的な行動指示（ボタン or リンク）
6. **追伸（P.S.）**: 開封者の多くが読む重要なセクション

### 件名の黄金則
- 30-40文字（日本語の場合）
- 数字を含める（「3つの理由」「5分で分かる」）
- 【】で重要ワードを強調
- 読者のベネフィットを明示
- 煽りすぎない（スパムフィルター回避）

### 制約
- 件名: 30-40文字
- 本文: 800-2000文字

### 出力JSON構造
\`\`\`json
{
  "subject_line": "メール件名（30-40文字）",
  "preview_text": "プレビューテキスト（50文字以内）",
  "body_html": "HTML形式の本文（インラインスタイル使用）",
  "body_text": "プレーンテキスト形式の本文",
  "cta_text": "CTAボタンのテキスト",
  "cta_url_placeholder": "{{CTA_URL}}",
  "variables": ["{{NAME}}", "{{COMPANY}}"]
}
\`\`\`
`
}

export function buildUserPrompt(analysis: Record<string, unknown>, customInstructions?: string): string {
  let prompt = `以下のコンテンツ分析結果を基に、メールマガジン（ニュースレター）を生成してください。

## コンテンツ分析結果
${JSON.stringify(analysis, null, 2)}

## 要求事項
- 件名は30-40文字で、開封率を最大化する表現にしてください
- プレビューテキストは件名を補完し、開封を後押しする内容にしてください
- 本文は800-2000文字で、1テーマに絞って展開してください
- HTML版とテキスト版の両方を生成してください
- HTML版はインラインスタイルを使用し、メールクライアントでの表示を考慮してください
- CTAは1つに絞り、明確な行動指示にしてください
- パーソナライゼーション用の変数（{{NAME}}等）を適切に配置してください
- P.S.（追伸）セクションを含めてください
`

  if (customInstructions) {
    prompt += `\n## カスタム指示\n${customInstructions}\n`
  }

  prompt += '\n必ず指定されたJSON構造で出力してください。'
  return prompt
}
