import { prisma } from './prisma'
import { 
  getCategoryGuideline, 
  getVariationPattern, 
  getToneModifier,
  CategoryGuideline,
  VariationPattern,
  ToneModifier,
} from './banner-guidelines'

/**
 * 生成入力データ
 */
export interface GenerationInput {
  categorySlug: string
  templateId?: string
  size: string // 例: "1080x1080"
  keyword: string // キーワード/キャッチコピー
  purpose?: 'ctr' | 'cv' | 'awareness' // 目的
  tone?: 'trust' | 'friendly' | 'luxury' | 'deal' | 'urgent' // トーン
}

/**
 * ブランドキット
 */
interface BrandKit {
  primaryColor?: string
  secondaryColor?: string
  fontMood?: string
  ngWords?: string[]
}

/**
 * サイズからピクセル値を解析
 */
function parseSize(size: string): { width: number; height: number } {
  const [width, height] = size.split('x').map(Number)
  return { width, height }
}

/**
 * サイズに応じたレイアウトガイダンスを返す
 */
function getSizeLayoutGuidance(width: number, height: number): string {
  const ratio = width / height

  if (ratio === 1) {
    // 正方形（1080x1080など）
    return `
- 正方形レイアウト: バランスの取れた中央配置
- 視線誘導: 上部→中央→下部CTA
- 4辺から等距離のマージンを確保
- テキストは中央揃えが基本`
  } else if (ratio > 1.5) {
    // 横長（1200x628、728x90など）
    return `
- 横長レイアウト: 左右に情報を分散
- 視線誘導: 左→右（CTAは右端）
- ロゴ・アイコンは左側、CTAは右側
- 縦方向のスペースは控えめに使用`
  } else if (ratio < 0.7) {
    // 縦長（1080x1920など）
    return `
- 縦長レイアウト: 上から下への流れ
- 視線誘導: 上部見出し→中央ビジュアル→下部CTA
- スクロールを意識した情報配置
- 余白を多めに確保して読みやすく`
  } else {
    // その他
    return `
- 標準レイアウト: 情報階層を明確に
- 視線誘導: 左上→中央→右下CTA
- 要素間の余白を適切に確保`
  }
}

/**
 * 目的に応じたレイアウト・訴求指示
 */
function getPurposeGuidance(purpose?: string): string {
  const guidances: Record<string, string> = {
    ctr: `
【CTR最大化設計】
- CTAボタンを最も目立つ位置・色で配置
- クリックしたくなる好奇心を刺激するコピー
- 「続きはこちら」「詳細を見る」などのティーザー型CTA
- ボタンには矢印やホバー示唆のデザイン
- 画像はクリックを誘導するような視線方向を意識`,
    cv: `
【CV重視設計】
- 信頼性を高める実績・数字を配置
- 「今すぐ申込」「無料相談」など明確なアクション誘導
- 安心要素（保証、サポート、セキュリティ）を含める
- 迷わせない1つのゴールに集中
- ベネフィットを具体的に明示`,
    awareness: `
【認知向上設計】
- ブランドロゴ・名称を大きく印象的に
- 覚えやすいキャッチコピーまたはビジュアル
- 情報は最小限に抑え、インパクト重視
- 一目で何のブランドかわかるデザイン
- SNSでシェアしたくなる要素`,
  }
  return guidances[purpose || 'ctr'] || guidances.ctr
}

/**
 * カテゴリガイドラインからプロンプトセクションを生成
 */
function buildCategorySection(guideline: CategoryGuideline): string {
  return `
【カテゴリ: ${guideline.name}】
${guideline.promptEnhancer}

▼ 効果的な訴求要素:
${guideline.effectiveElements.map(e => `  ・${e}`).join('\n')}

▼ 避けるべき要素:
${guideline.avoidElements.map(e => `  ・${e}`).join('\n')}

▼ パワーワード（適宜使用）:
  ${guideline.powerWords.slice(0, 10).join('、')}

▼ CTA例:
  ${guideline.ctaExamples.join(' / ')}
`.trim()
}

/**
 * バリエーションパターンからプロンプトセクションを生成
 */
function buildVariationSection(pattern: VariationPattern): string {
  return `
【訴求パターン: ${pattern.variant} - ${pattern.name}】
${pattern.description}

${pattern.promptPattern}

▼ 必須要素:
${pattern.keyElements.map(e => `  ・${e}`).join('\n')}
`.trim()
}

/**
 * トーン修飾からプロンプトセクションを生成
 */
function buildToneSection(modifier: ToneModifier): string {
  return `
【トーン: ${modifier.name}】
${modifier.promptModifier}

▼ カラー: ${modifier.colorAdjustment}
▼ フォント: ${modifier.fontAdjustment}
▼ 雰囲気: ${modifier.moodAdjustment}
`.trim()
}

/**
 * メインプロンプトを組み立てる（強化版）
 */
export function buildPrompt(
  input: GenerationInput,
  variant: 'A' | 'B' | 'C',
  templateBasePrompt?: string,
  brand?: BrandKit | null
): string {
  const { width, height } = parseSize(input.size)
  
  // カテゴリガイドラインを取得
  const categoryGuideline = getCategoryGuideline(input.categorySlug)
  
  // バリエーションパターンを取得
  const variationPattern = getVariationPattern(variant)
  
  // トーン修飾子を取得
  const toneModifier = input.tone ? getToneModifier(input.tone) : undefined
  
  const sections = [
    // ============ 1. システム指示 ============
    `あなたは日本のトップクラスの広告バナーデザイナーです。
以下の詳細な仕様に従って、CTR/CVを最大化するプロフェッショナルな広告バナーを生成してください。

【重要】このバナーは実際の広告運用で使用されます。
- 日本市場に最適化されたデザイン
- 業界のベストプラクティスに従う
- 法的に問題のない表現のみ使用`,

    // ============ 2. ユーザー入力（訴求内容） ============
    `【訴求内容（ユーザー入力）】
「${input.keyword}」

この訴求内容を最も効果的に伝えるバナーを作成してください。`,

    // ============ 3. カテゴリ別ガイドライン ============
    categoryGuideline ? buildCategorySection(categoryGuideline) : '',

    // ============ 4. バリエーション指示 ============
    variationPattern ? buildVariationSection(variationPattern) : '',

    // ============ 5. 目的別ガイダンス ============
    getPurposeGuidance(input.purpose),

    // ============ 6. トーン指示 ============
    toneModifier ? buildToneSection(toneModifier) : '',

    // ============ 7. テンプレート固有指示 ============
    templateBasePrompt ? `【テンプレート固有指示】\n${templateBasePrompt}` : '',

    // ============ 8. レイアウト・サイズ指示 ============
    `【レイアウト指示（${width}x${height}px）】
${getSizeLayoutGuidance(width, height)}

▼ 共通ルール:
- 全要素がフレーム内に完全に収まること（はみ出し厳禁）
- 端から最低5%のマージンを確保
- テキストは読みやすいサイズ（最小14px相当以上）
- CTAボタンは44x44px相当以上のタップ領域`,

    // ============ 9. テキスト指示 ============
    `【テキスト指示】
▼ メインコピー:
- 1行で収まる短く刺さる日本語
- ユーザーの注目を一瞬で掴む
- 具体的な数字やベネフィットを含める

▼ サブコピー（必要に応じて）:
- メインを補足する1〜2行
- 読みやすいフォントサイズ

▼ CTA:
- 「詳しくはこちら」「今すぐチェック」など
- 押したくなるボタンデザイン
- 背景と十分なコントラスト

▼ 注記（必要に応じて）:
- 「※条件あり」「※詳細はサイトで」等
- 小さくても読める最小サイズ`,

    // ============ 10. ブランドキット ============
    brand && (brand.primaryColor || brand.secondaryColor || brand.fontMood) ? `
【ブランドキット設定】
${brand.primaryColor ? `- メインカラー: ${brand.primaryColor}` : ''}
${brand.secondaryColor ? `- サブカラー: ${brand.secondaryColor}` : ''}
${brand.fontMood ? `- フォント雰囲気: ${brand.fontMood}` : ''}

このブランドカラーを基調としたデザインにしてください。` : '',

    // ============ 11. 禁則事項 ============
    `【禁則事項】絶対に含めないこと
▼ 法的リスク:
- 「日本一」「世界一」「完全」「絶対」など根拠のない最上級表現
- 薬機法違反の効果効能表現（「治る」「痩せる」等）
- 景品表示法違反の表現

▼ 不適切コンテンツ:
- 成人向け、暴力的、差別的な内容
- 政治的・宗教的に偏った表現
- 著作権侵害の恐れがある要素

${brand?.ngWords?.length ? `▼ ユーザー指定NGワード:\n  ${brand.ngWords.join('、')}` : ''}`,

    // ============ 12. 出力仕様 ============
    `【出力仕様】
- サイズ: ${width}x${height}ピクセル
- 形式: PNG（透過なし）
- 解像度: 高品質
- 全要素がフレーム内に収まること
- 日本語テキストは正しく自然に表示
- 商用利用可能なデザイン

このバナーを生成してください。`,
  ]
  
  return sections.filter(Boolean).join('\n\n')
}

/**
 * 3つのバリエーションのプロンプトを生成
 */
export function buildAllVariantPrompts(
  input: GenerationInput,
  templateBasePrompt?: string,
  brand?: BrandKit | null
): { variant: 'A' | 'B' | 'C'; prompt: string }[] {
  return (['A', 'B', 'C'] as const).map(variant => ({
    variant,
    prompt: buildPrompt(input, variant, templateBasePrompt, brand),
  }))
}

/**
 * テンプレートを取得してプロンプトを生成
 */
export async function buildPromptsWithTemplate(
  input: GenerationInput,
  userId: string
): Promise<{ variant: 'A' | 'B' | 'C'; prompt: string }[]> {
  // テンプレートを取得
  let templateBasePrompt: string | undefined
  if (input.templateId) {
    const template = await prisma.template.findUnique({
      where: { id: input.templateId },
    })
    templateBasePrompt = template?.basePrompt
  }
  
  // ブランドキットを取得
  const brandKit = await prisma.brandKit.findUnique({
    where: { userId },
  })
  
  return buildAllVariantPrompts(input, templateBasePrompt, brandKit)
}

/**
 * プロンプトのプレビュー生成（デバッグ用）
 */
export function previewPrompt(
  input: GenerationInput,
  variant: 'A' | 'B' | 'C' = 'A'
): string {
  return buildPrompt(input, variant)
}
