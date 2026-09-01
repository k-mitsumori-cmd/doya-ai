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
  /**
   * 見た目の参考にするデザイン（ドヤバナーAIのテンプレートのプロンプト）。
   * ⚠️ 参考にするのは**配色・質感・レイアウトの雰囲気だけ**。
   *    テンプレート側の文言や商材はこちらのコピーで上書きされる。
   */
  designRefPrompt?: string
}

export function buildImagePrompt(input: BuildPromptInput): string {
  const { brand, copy, tone, placement, composition, extraDirectives = [], designRefPrompt } = input
  const comp = COMPOSITIONS[composition]
  const omitSub = comp.omit.includes('sub')

  const ratio = placement.genW / placement.genH
  const ratioLabel =
    ratio > 1.05 ? '横長' : ratio < 0.95 ? '縦長' : '正方形'

  // ⚠️ 面によって「大きい」の基準が違う。縦長(ストーリーズ/リール)は高さに余裕が
  //    あるぶん相対サイズが小さくなりやすく、正方形(フィード)も同様に埋もれる。
  //    横長バナーは高さが無いので、比率を上げすぎると文字が入りきらない。
  const isVertical = ratio < 0.95
  const isSquare = ratio >= 0.95 && ratio <= 1.05
  const headlinePct = isVertical ? 9 : isSquare ? 11 : 14
  const blockPct = isVertical ? 40 : isSquare ? 45 : 50

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
    // 2.5 デザインの参考
    designRefPrompt
      ? [
          '■ 作風の指定（この作風で描くこと）:',
          ...designRefPrompt.split('\n').map((l) => `  ${l}`),
          '  ⚠️ ここで指定しているのは**作風（質感・配色の方向性・レイアウトの気配）だけ**。',
          `     描く題材は上の「${brand.name}」の商材であり、作風の説明に出てくる物や場面を描いてはいけない。`,
          `     画面比率も上で指定した ${placement.genW}×${placement.genH} に従うこと。`,
          '',
        ].join('\n')
      : '',
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
    // ⚠️ 「読める大きさ」だけでは細く小さい文字が出てくる。
    //    ストーリーズ・リール・フィードは指で持って一瞬で見る面なので、
    //    画面に対する占有率で具体的に指定する（2026-08-31）。
    '■ 文字の描き方（最重要・厳守）:',
    '  極太のゴシック体（日本語のExtraBold〜Black相当。細い書体・明朝体・手書き風は禁止）。',
    '  文字の輪郭は太く、遠目でも潰れないこと。細いウェイトは一切使わない。',
    `  大見出しは**1行あたり画像の高さの${headlinePct}%以上**の文字サイズで描くこと。小さく収めない。`,
    `  見出し・サブ・CTAを合わせた文字の面積が、画面全体の${blockPct}%程度を占めるようにする。`,
    '  背景とのコントラストを最大にする（明るい背景なら濃い文字、暗い背景なら白抜き）。',
    '  文字の背後には必ず単色の帯・プレート・べた塗りを敷き、写真や模様に直接重ねない。',
    '  CTAは塗りつぶした角丸ボタンにし、ボタン自体も指で押せる大きさで大きく描く。',
    isVertical
      ? '  縦長なので、文字は横幅いっぱいを使って大きく組む。左右に余らせないこと。'
      : '',
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
