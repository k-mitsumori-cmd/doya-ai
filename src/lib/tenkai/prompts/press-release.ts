// ============================================
// ドヤ展開AI — プレスリリース生成プロンプト
// ============================================

import { BASE_SYSTEM_PROMPT } from './system'

export const PLATFORM_CONFIG = {
  name: 'press_release',
  displayName: 'プレスリリース',
  minChars: 1000,
  maxChars: 2000,
  recommendedChars: 1500,
}

export function buildSystemPrompt(analysis: Record<string, unknown>, _brandVoice?: Record<string, unknown>): string {
  return `${BASE_SYSTEM_PROMPT}

## プラットフォーム: プレスリリース

### プレスリリースの特性
- メディア関係者（記者・編集者）が主要読者
- 客観的・事実ベースの文体が必須
- 逆ピラミッド構造（最も重要な情報を冒頭に）
- PR TIMESやValuePress!等の配信サービスでの掲載を想定
- 5W1H（誰が・何を・いつ・どこで・なぜ・どのように）を明確に

### プレスリリース構成（JIS標準準拠）
1. **見出し（30-50文字）**: ニュース性のある事実を端的に表現
2. **サブヘッドライン**: 見出しを補足する1文
3. **日付と発信元（デートライン）**: 「2026年X月X日 - 社名」
4. **リード文（200-300文字）**: 5W1Hを含む要約。これだけで記事になる完結性
5. **本文（1000-2000文字）**: 詳細な説明、背景、引用コメント
6. **ボイラープレート**: 企業概要（定型文）
7. **問い合わせ先**: 担当者名・連絡先（プレースホルダー）
8. **編集者向け注記**: 補足情報

### 文体のルール
- 「である」調（常体）を基本とする
- 主観的な表現・形容詞を避ける
- 具体的な数字・日付・固有名詞を使用
- 引用コメントは「　」で囲む
- 業界用語は初出時に説明を付ける

### 制約
- 見出し: 30-50文字
- リード: 200-300文字
- 本文: 1000-2000文字

### 出力JSON構造
\`\`\`json
{
  "headline": "プレスリリース見出し（30-50文字）",
  "sub_headline": "サブヘッドライン（1文）",
  "dateline": "2026年X月X日 - {{COMPANY_NAME}}",
  "lead_paragraph": "リード文（200-300文字、5W1Hを含む）",
  "body": "本文（詳細説明、背景、引用コメント含む）",
  "boilerplate": "{{COMPANY_NAME}}について\n企業概要のプレースホルダー",
  "contact_info_placeholder": "本件に関するお問い合わせ先\n{{CONTACT_NAME}}\n{{CONTACT_EMAIL}}\n{{CONTACT_PHONE}}",
  "notes_to_editor": "編集者向け補足情報"
}
\`\`\`
`
}

export function buildUserPrompt(analysis: Record<string, unknown>, customInstructions?: string): string {
  let prompt = `以下のコンテンツ分析結果を基に、プレスリリースを生成してください。

## コンテンツ分析結果
${JSON.stringify(analysis, null, 2)}

## 要求事項
- 見出しは30-50文字で、ニュース性のある事実を端的に表現してください
- リード文は200-300文字で、5W1Hを含む完結した要約にしてください
- 本文は客観的・事実ベースの文体で、1000-2000文字にしてください
- 逆ピラミッド構造（重要情報→詳細→補足）を厳守してください
- 企業名・担当者名はプレースホルダー（{{COMPANY_NAME}}等）にしてください
- 可能であれば引用コメント（代表者やキーパーソンの発言）を含めてください
- デートラインには本日の日付を使用してください
- 編集者向け注記に、画像素材の提供可否やインタビュー対応の可否を含めてください
`

  if (customInstructions) {
    prompt += `\n## カスタム指示\n${customInstructions}\n`
  }

  prompt += '\n必ず指定されたJSON構造で出力してください。'
  return prompt
}
