// 画像生成の仕様（モデル・単価・プロンプト）
// 従量課金のため、UIで見込み額を提示して承認を得てから /api/tenjikai/image を呼ぶ。
// 単価は目安。実行前に Google の最新料金表で確認すること。

import type { Creative, CreativeKind, SiteAnalysis, BoothPlan } from './engine'

export type ImageSize = '1K' | '2K' | '4K'

export interface ImageModel {
  id: string
  label: string
  usdPerImage: Record<ImageSize, number>
  note: string
}

export const USD_JPY = 150

export const IMAGE_MODELS: ImageModel[] = [
  { id: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image', usdPerImage: { '1K': 0.134, '2K': 0.134, '4K': 0.24 }, note: '文字入りのデザインに強い。ドヤバナーAIと同じモデル' },
  { id: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image', usdPerImage: { '1K': 0.039, '2K': 0.039, '4K': 0.039 }, note: '安価なラフ案向け。解像度は1K相当' },
]

export function estimateCost(modelId: string, size: ImageSize, count: number) {
  const m = IMAGE_MODELS.find((x) => x.id === modelId) ?? IMAGE_MODELS[0]
  const unitUsd = m.usdPerImage[size]
  const unitYen = Math.ceil(unitUsd * USD_JPY)
  return { model: m, unitUsd, unitYen, totalYen: unitYen * count, totalUsd: +(unitUsd * count).toFixed(3) }
}

// Gemini が受け付けるアスペクト比のうち、制作物の実寸に最も近いもの
export const RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'] as const
export function nearestRatio(w: number, h: number) {
  const r = w / h
  return RATIOS.reduce((best, cur) => {
    const [a, b] = cur.split(':').map(Number)
    const [ba, bb] = best.split(':').map(Number)
    return Math.abs(a / b - r) < Math.abs(ba / bb - r) ? cur : best
  }, RATIOS[0] as string)
}

const KIND_BRIEF: Record<CreativeKind, string> = {
  backwall: '展示会ブースの背面壁に貼る横長の大判グラフィック。通路の15m先から読める巨大なキャッチコピーを上部に、下部はロゴと3つの訴求点。余白を広く',
  rollup: '展示会用ロールアップバナー（縦長）。上1/3に大きなキャッチ、中央にイメージ、下部にロゴとQRコード用の空白',
  flyer: '展示会で配るA4縦チラシの表面。見出し、3つの特長、導入効果の数字、料金の目安、QRコード用の空白',
  clearfile: 'A4クリアファイルの表面デザイン。ロゴとブランドカラーを大胆に使い、書類を入れても見えるよう中央は淡く',
  card: '名刺サイズのQRカード。資料ダウンロードへの誘導文と、QRコード用の正方形の空白',
  loop: '展示会モニター用動画のキービジュアル（16:9）。音なしで伝わる大きな文字',
}

export function buildCreativePrompt(c: Creative, a: SiteAnalysis) {
  return [
    `${a.brand}（${a.category}）の${KIND_BRIEF[c.kind]}。`,
    `仕上がりサイズ ${c.size}。`,
    `メインコピー：「${c.copy}」`,
    `訴求点：${a.valueProps.map((v) => v.title).join('、')}`,
    `ブランドカラー：メイン ${a.colors.primary}、サブ ${a.colors.secondary}、アクセント ${a.colors.accent}。トーンは「${a.tone}」。`,
    '日本語の文字は正確に、読みやすい太めのゴシック体で。絵文字は使わない。実在しないロゴや認証マークは描かない。',
  ].join('\n')
}

export function buildBoothRenderPrompt(plan: BoothPlan, a: SiteAnalysis) {
  const parts = plan.elements.map((e) => e.label).join('、')
  return [
    `添付の等角図は展示会ブース（${plan.widthM}m × ${plan.depthM}m、${plan.name}）のレイアウトです。`,
    'この配置と寸法を変えずに、東京ビッグサイトの展示ホールに設営された完成予想図を、来場者目線の斜め前方からフォトリアルに描いてください。',
    `部材：${parts}。`,
    `背面壁の大判グラフィックには「${a.headline.replace('\n', '')}」と${a.brand}のロゴ。ブランドカラー ${a.colors.primary} を基調に。`,
    '天井の照明、カーペット、通路を歩く来場者を数名。文字は正確な日本語で。',
  ].join('\n')
}

export interface ImageGenRequest {
  prompt: string
  model: string
  size: ImageSize
  aspectRatio: string
  count: number
  approved: true
  expectedCostYen: number
  referencePng?: string // base64（data URLのプレフィックスなし）
  /** 記録用の種類（creative_image / booth_render / graphic_panel） */
  kind?: string
}
