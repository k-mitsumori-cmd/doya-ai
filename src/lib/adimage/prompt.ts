// ============================================
// ドヤ広告画像AI プロンプト構築（フルベイク）
// ============================================
// 実測（2026-08-06）で有効性を確認した構成を、この順で組み立てる。
// 順番と書き方に意味があるので、崩さないこと。
//
//   1. 媒体・配置・アスペクトの宣言
//   2. ブランド・トーン・配色
//   3. 全面デザイン指示
//   4. 描画するテキスト（鍵括弧で厳密に指定）
//   5. 配置ルール（セーフエリア）
//   6. 書体・コントラスト指示
//   7. 禁止事項
//
// 実測で効いたポイント:
//  - テキストを鍵括弧で囲って項目名つきで列挙すると、指定どおりに描かれる
//  - 「指定した文字以外を描かない」を明記しないと、それらしい英字ダミーが混入する
//  - 「画面全体をデザインで埋める（白い余白帯を作らない）」が無いと、上下に無地の帯を作って
//    中央にカードを置く構図になり、縦長の面積を活かせない（1回目の検証で実際に発生した）
import { COMPOSITIONS } from './compositions'
import type { CompositionKey, Placement } from './placements'
import type { AdCopy, BrandProfile } from './types'

export interface BuildPromptInput {
  brand: BrandProfile
  copy: AdCopy
  tone: string
  placement: Placement
  composition: CompositionKey
  /** 再生成時に足す修正指示 */
  extraDirectives?: string[]
}

export function buildImagePrompt(input: BuildPromptInput): string {
  const { brand, copy, tone, placement, composition, extraDirectives = [] } = input
  const comp = COMPOSITIONS[composition]
  const omitSub = comp.omit.includes('sub')

  const ratio = placement.genW / placement.genH
  const ratioLabel =
    ratio > 1.05 ? '横長' : ratio < 0.95 ? '縦長' : '正方形'

  const colors = brand.colors.slice(0, 3)

  const lines: string[] = [
    // 1. 媒体・配置・アスペクトの宣言
    `${placement.media}の「${placement.name}」向けの広告クリエイティブ。${ratioLabel}（${placement.genW}×${placement.genH}）のフルブリード構図。`,
    '',
    // 2. ブランド・トーン・配色
    `ブランド: ${brand.name}${brand.industry ? `（${brand.industry}）` : ''}`,
    `雰囲気: ${tone}`,
    colors.length > 0 ? `配色: ${colors.join(' / ')} を基調にする` : '',
    brand.description ? `サービス内容: ${brand.description}` : '',
    '',
    // 3. 全面デザイン指示
    '■ 全体:',
    '  画面全体をデザインで埋めること。上下や左右に白い余白帯を作らず、背景を四辺の端まで到達させる。',
    '  中央にカードを置いて周囲を無地にする構図にしないこと。',
    '',
    // 4. 描画するテキスト
    '■ 描画するテキスト（この文字列を一字一句そのまま、日本語で正確に描くこと）:',
    `  大見出し（最も大きく目立たせる）: 「${copy.headline}」`,
    omitSub ? '' : `  サブコピー（中サイズ）: 「${copy.sub}」`,
    `  CTAボタン（角丸ボタンの中に白抜き文字）: 「${copy.cta}」`,
    '',
    // 5. 配置ルール
    '■ 配置ルール（厳守）:',
    comp.rule
      .split('\n')
      .map((l) => `  ${l}`)
      .join('\n'),
    '',
    // 6. 書体・コントラスト
    '■ 文字の描き方:',
    '  太いゴシック体（サンセリフ）で、背景とのコントラストを強くとる。',
    '  文字は必ず読める大きさにし、背景の模様や写真の上に直接重ねて読みづらくしないこと。',
    '  必要なら文字の背後に単色の帯やプレートを敷いてよい。',
    '',
    // 7. 禁止事項
    '■ 禁止:',
    `  上で指定した${omitSub ? '2つ' : '3つ'}のテキスト以外の文字・数字・英字・記号・ロゴ・透かしを一切描かないこと。`,
    '  それらしいダミーの英文やレイアウト用の疑似テキストも描いてはいけない。',
    '  実在する企業ロゴ、人物の顔写真、他社の商標を使わないこと。',
  ]

  if (extraDirectives.length > 0) {
    lines.push('', '■ 前回からの修正指示（最優先で反映すること）:')
    for (const d of extraDirectives) lines.push(`  ${d}`)
  }

  return lines.filter((l) => l !== '').join('\n')
}
