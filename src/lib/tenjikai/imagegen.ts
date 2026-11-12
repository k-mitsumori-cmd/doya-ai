// 画像生成の仕様（モデル・単価・プロンプト）
// ⚠️ モデルと解像度はサーバーが決める。利用者には選ばせず、原価も見せない（2026-10-19 ユーザー指示）。
// 単価は、サーバー側の1日の上限額（image-quota.ts）を数えるためだけに使う。目安なので、Google の料金表で確かめること。

import type { Creative, CreativeKind, SiteAnalysis, BoothPlan } from './engine'
import { buildDesignPrompt, deriveKit, kitBlock, type ArtType, type BoothDesignKit, type LayoutType } from './design-kit'
import { safeZone } from './image-fit'

export type ImageSize = '1K' | '2K' | '4K'

export interface ImageModel {
  id: string
  label: string
  usdPerImage: Record<ImageSize, number>
  note: string
}

export const USD_JPY = 150

export const IMAGE_MODELS: ImageModel[] = [
  { id: 'gemini-3-pro-image', label: 'Gemini 3 Pro Image', usdPerImage: { '1K': 0.134, '2K': 0.134, '4K': 0.24 }, note: '文字入りのデザインに強い。ドヤバナーAIの既定（src/lib/nanobanner.ts）と同じ ID' },
  { id: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image（プレビュー名）', usdPerImage: { '1K': 0.134, '2K': 0.134, '4K': 0.24 }, note: '上の ID が使えないときの予備' },
  // gemini-2.5-flash-image（Nano Banana 無印）は、プロジェクトの決まりで画像に使わない（CLAUDE.md「画像生成の禁止事項」。2026-10-26 に予備から外した）
]

/** 使う解像度（固定） */
export const IMAGE_SIZE: ImageSize = '2K'

/**
 * 単価の表。見込み額は先頭（gemini-3-pro-image）の単価で数える。
 * 実際に呼ぶのは TENJIKAI_IMAGE_MODEL_ID（gemini-3-pro-image）だけで、統一ディスパッチャ（src/lib/image-generator.ts）を通す。
 * 2026-10-19 に本番のキーで生存を確かめた（文字だけの返事で1回。200）。
 */
/**
 * 使うモデル。画像の生成は統一ディスパッチャの generateImageGeminiPro（src/lib/image-generator.ts）を通し、
 * gemini-3-pro-image だけを使う。環境変数でモデルを替えられないようにした（禁止のモデルに替わらないため。2026-10-26 統括の点検）
 */
export const TENJIKAI_IMAGE_MODEL_ID = 'gemini-3-pro-image'

/** 上限額を数えるための見込み額。いちばん高い単価（先頭のモデル）で数える */
export function estimateQuotaYen(count: number) {
  return estimateCost(IMAGE_MODELS[0].id, IMAGE_SIZE, count).totalYen
}

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

/** 制作物の種類ごとの、面の型と、画像に描く見出し（文字は短いものだけ。長い文・QR・ロゴ・数字は画面の側で重ねる） */
const KIND_DESIGN: Record<CreativeKind, { layout: LayoutType; role: string; headline: (a: SiteAnalysis, c: Creative) => string }> = {
  backwall: { layout: 'hero', role: '展示会ブースの背面壁の大判グラフィック。通路の15m先から何の会社かが伝わる', headline: (a) => a.headline },
  rollup: { layout: 'appeal', role: '展示会用ロールアップバナー（縦長）。通路を歩く人の足を止める。下の無地に、QR コードとロゴを実物で重ねる', headline: (a) => a.valueProps[0].title },
  flyer: { layout: 'appeal', role: '展示会で配る A4 縦チラシの表面の背景。長い文・特長・料金・QR コードは、あとから実物で重ねる', headline: (a) => a.valueProps[0].title },
  clearfile: { layout: 'hero', role: 'A4 クリアファイルの表面。書類を入れても見えるよう、中央は薄く', headline: (a) => a.brand },
  card: { layout: 'guide', role: '名刺サイズの QR カードの背景。案内文と QR コードは、あとから実物で重ねる', headline: () => '' },
  loop: { layout: 'hero', role: '展示会モニター用の動画のキービジュアル（16:9）。音なしで伝わる', headline: (a) => a.valueProps[0].title },
}

/**
 * 制作物の画像の指示文。面の画像と同じ関数（design-kit.ts の buildDesignPrompt）を通す。
 * 2026-10-29: 以前は、制作物だけ別の書き方で、日本語の文字を「正確に」と頼んでいたため、面とそろわなかった。
 */
export function buildCreativePrompt(c: Creative, a: SiteAnalysis, kit: BoothDesignKit = deriveKit(a), opts: { hasReference?: boolean } = {}) {
  const d = KIND_DESIGN[c.kind]
  const ratio = nearestRatio(c.widthMm, c.heightMm)
  const safe = safeZone(ratio, c.widthMm / c.heightMm)
  return buildDesignPrompt(kit, {
    name: c.name,
    widthMm: c.widthMm,
    heightMm: c.heightMm,
    role: d.role,
    layout: d.layout,
    headline: d.headline(a, c),
    hasReference: opts.hasReference,
    safeWidthPct: safe.safeWidthPct,
    safeHeightPct: safe.safeHeightPct,
  })
}

/** 部材の名前から、数字と単位（65型・2台など）を除く（画像に寸法や数が描かれないため） */
const noDigits = (t: string) => t.replace(/[0-9０-９][0-9０-９.]*\s*(mm|cm|m|型|台|%|％)?/g, '').trim()

const RENDER_LOOK: Record<ArtType, string> = {
  photo: '貼られた面の絵は実写風。ホールの光（天井の照明）と、面の絵の自然光が、同じ空気の中にあるように描く。',
  graphic: '貼られた面は、大きな色面と太い見出しのグラフィック。遠くからでも色が目に入るように描く。',
  world: '貼られた面は、光と奥行のある世界の絵。面が光るように見え、まわりの照明は少し落ち着かせる。',
}

/**
 * 完成予想図の指示文（仕様 5 章）。参照は2枚: 1枚目 = 3D の表示（配置と寸法）、2枚目 = キービジュアル（絵柄）。
 * 寸法・割合の数字は書かない（画像に寸法線が描かれるため）。
 */
export function buildBoothRenderPrompt(plan: BoothPlan, a: SiteAnalysis, kit: BoothDesignKit = deriveKit(a), opts: { hasKeyVisual?: boolean } = {}) {
  const parts = plan.elements.map((e) => noDigits(e.label)).join('、')
  const type = kit.direction.type
  return [
    `展示会ブース（${plan.name}）の完成予想図を作る。東京ビッグサイトのような展示ホールに実際に建った、写真のような絵にする。来場者の目線の高さの、斜め前方から見る。`,
    '添付は2枚。1枚目は、ブースの配置と寸法を示す3D の表示。部材の数・位置・大きさ・向きは、1枚目のとおりに変えない。1枚目に書かれた文字・寸法・数字・色の凡例は、画像に描かない。',
    opts.hasKeyVisual === false ? '' : '2枚目は、背面壁の中央に貼るキービジュアル。この絵柄・色み・見出しを、そのまま背面壁の中央に貼って描く。見出しの文字は、2枚目に描かれているものだけを写し、新しい文字は足さない。',
    `部材：${parts}。`,
    'そのほかの面（背面壁の左右・ロールアップ・吊り看板・受付）は、2枚目と同じ方向・同じ色で、次のブースのデザインの決まりのとおりにそろえる。',
    '【次の決まりは、面に貼る絵の決まり。ホール全体の描写（写真のような質感）には当てはめない】',
    kitBlock(kit),
    RENDER_LOOK[type],
    '天井の照明、カーペット、通路を歩く来場者を数名（顔は小さく、特定の人物に似せない）。ホールのほかのブースは、白い壁だけの簡素なものにして、文字・ロゴは描かない。',
  ].filter(Boolean).join('\n')
}

export interface ImageGenRequest {
  prompt: string
  aspectRatio: string
  count: number
  /** 利用者が「作る」を押したこと */
  approved: true
  referencePng?: string // base64（data URLのプレフィックスなし）
  /** 参照を2枚渡すとき（完成予想図: 1枚目 = 3D の表示、2枚目 = キービジュアル）。referencePng とは、どちらか一方 */
  referencePngs?: string[]
  /** 記録用の種類（creative_image / booth_render / graphic_panel） */
  kind?: string
}
