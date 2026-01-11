import type { BrandPalette, DoyaLogoInput, LogoPatternId } from './types'

export function buildExplainPrompt(args: {
  input: DoyaLogoInput
  patternId: LogoPatternId
  patternTitle: string
  patternDescription: string
  palette: BrandPalette
}): string {
  const { input, patternId, patternTitle, patternDescription, palette } = args

  return [
    'あなたはBtoB / Webサービス向けのロゴ設計に強い、ブランドデザイナーです。',
    '以下の入力とロゴ方針に基づき、日本語で「生成理由（Explainability）」を作成してください。',
    '',
    '【絶対条件】',
    '- 極端に欧米寄りにしない',
    '- 余白設計と信頼感（長期運用）を強調',
    '- グラデーションを前提にしない（フラット/単色中心）',
    '- 直接コピーは禁止。参考思想は抽象化して言及するのみ',
    '',
    `【サービス名】${input.serviceName}`,
    `【サービス内容】${input.serviceDescription}`,
    `【雰囲気】${input.mood}`,
    `【業界】${input.industry}`,
    '',
    `【パターン】Pattern ${patternId}: ${patternTitle}`,
    `【方針】${patternDescription}`,
    '',
    '【カラー（必ず言及）】',
    `- primary: ${palette.primary.hex}`,
    `- secondary: ${palette.secondary.hex}`,
    `- accent: ${palette.accent.hex}`,
    '',
    '【出力フォーマット】',
    '見出し付きで、次を必ず書いてください：',
    '- なぜこの形なのか',
    '- なぜこの色なのか',
    '- サービス内容とどう紐づいているか',
    '- 長期運用で強い理由（運用・拡張の観点も）',
    '- 注意（商標・類似ロゴについての一般的な注意喚起。法的判断ではない）',
  ].join('\n')
}








