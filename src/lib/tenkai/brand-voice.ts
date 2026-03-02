// ============================================
// ドヤ展開AI — ブランドボイス注入
// ============================================

export interface BrandVoiceConfig {
  name: string
  firstPerson: string
  formalityLevel: number // 1-5
  enthusiasmLevel: number // 1-5
  technicalLevel: number // 1-5
  humorLevel: number // 1-5
  targetAudience?: string | null
  sampleText?: string | null
  preferredExpressions: string[]
  prohibitedWords: string[]
}

const FORMALITY_LABELS: Record<number, string> = {
  1: 'とてもカジュアル（友達に話すような口調）',
  2: 'カジュアル（親しみやすい敬語）',
  3: '標準的（丁寧語を基本とした自然な文体）',
  4: 'ややフォーマル（ビジネスライクな丁寧語）',
  5: '非常にフォーマル（格式ある文体）',
}

const ENTHUSIASM_LABELS: Record<number, string> = {
  1: '落ち着いた冷静なトーン',
  2: 'やや控えめだが前向きなトーン',
  3: '適度な熱量を持った自然なトーン',
  4: '情熱的でエネルギッシュなトーン',
  5: '非常に熱量が高く、興奮を伝えるトーン',
}

const TECHNICAL_LABELS: Record<number, string> = {
  1: '専門用語を一切使わない平易な表現',
  2: '基本的な専門用語のみ使用し、必ず解説を付ける',
  3: '業界では一般的な専門用語は自然に使用',
  4: 'やや高度な専門用語も使用（読者にある程度の前提知識を期待）',
  5: '高度な専門用語を積極的に使用（専門家向け）',
}

const HUMOR_LABELS: Record<number, string> = {
  1: 'ユーモアなし（真面目一辺倒）',
  2: '控えめなユーモア（たまに軽い表現を挟む程度）',
  3: '適度なユーモア（読みやすさのために時折挟む）',
  4: 'ユーモア多め（親しみやすさを重視）',
  5: '積極的にユーモアを活用（エンタメ性重視）',
}

/**
 * ブランドボイス設定をシステムプロンプトに反映
 */
export function injectBrandVoice(
  basePrompt: string,
  brandVoice: BrandVoiceConfig
): string {
  const voiceInstructions: string[] = []

  voiceInstructions.push(`## ブランドボイス「${brandVoice.name}」の適用`)

  // 一人称
  voiceInstructions.push(`- 一人称: 「${brandVoice.firstPerson}」を使用してください。`)

  // フォーマル度
  const formalityLabel = FORMALITY_LABELS[brandVoice.formalityLevel] || FORMALITY_LABELS[3]
  voiceInstructions.push(`- 文体のフォーマル度: ${formalityLabel}`)

  // 熱量
  const enthusiasmLabel = ENTHUSIASM_LABELS[brandVoice.enthusiasmLevel] || ENTHUSIASM_LABELS[3]
  voiceInstructions.push(`- トーンの熱量: ${enthusiasmLabel}`)

  // 専門度
  const technicalLabel = TECHNICAL_LABELS[brandVoice.technicalLevel] || TECHNICAL_LABELS[3]
  voiceInstructions.push(`- 専門用語の使用レベル: ${technicalLabel}`)

  // ユーモア
  const humorLabel = HUMOR_LABELS[brandVoice.humorLevel] || HUMOR_LABELS[2]
  voiceInstructions.push(`- ユーモアの度合い: ${humorLabel}`)

  // ターゲットオーディエンス
  if (brandVoice.targetAudience) {
    voiceInstructions.push(`- 想定読者: ${brandVoice.targetAudience}`)
  }

  // サンプルテキスト
  if (brandVoice.sampleText) {
    voiceInstructions.push(
      `- 参考文体サンプル（このトーンとスタイルを模倣してください）:\n「${brandVoice.sampleText.slice(0, 500)}」`
    )
  }

  // 好む表現
  if (brandVoice.preferredExpressions.length > 0) {
    voiceInstructions.push(
      `- 積極的に使用してほしい表現: ${brandVoice.preferredExpressions.map((e) => `「${e}」`).join('、')}`
    )
  }

  // 禁止ワード
  if (brandVoice.prohibitedWords.length > 0) {
    voiceInstructions.push(
      `- 絶対に使用しないでください: ${brandVoice.prohibitedWords.map((w) => `「${w}」`).join('、')}`
    )
  }

  return `${basePrompt}\n\n${voiceInstructions.join('\n')}`
}
