// ============================================
// ドヤポップアップ: 画像の生成（「画像を作る」ボタン。仕様: reference/services/popup.md 3-2）
// ============================================
// ⚠️ 画像は統一ディスパッチャ generateImageWithFallback 経由（モデルは gpt-image-2、失敗時だけ Nano Banana Pro）。
// ⚠️ モデル・大きさ・品質はここで決める。利用者には選ばせない。size と quality は必ず明示する（省くと単価が変わる）。
// ⚠️ 画像に長い日本語の文を描かせない（崩れるため）。描かせる文字は、短い見出し1つまで。
//    ボタンや細かい文は描かない（画像型は画像全体がリンクになる）。実在のロゴ・人物も描かせない。
// ⚠️ 外部の課金 API を呼ぶ関数は引数で受ける（generate）。テストでは偽物に差し替える。
import sharp from 'sharp'
import type { generateImageWithFallback } from '@/lib/image-generator'
import type { SiteProfile } from '@/lib/asklink/types'
import { MAX_IMAGE_BYTES } from './storage'
import type { PopupLayout } from './schema'
import { IMAGE_BRIEF_LIMITS } from './imagegen-public'

/** 品質。medium 固定（asklink・adimage と同じ設定。reference/services/asklink.md の原価の見込みの根拠） */
export const POPUP_IMAGE_QUALITY = 'medium' as const
/** 画面に出さないが、記録とドキュメント用に持つ主モデル名（実際の呼び出しはディスパッチャが決める） */
export const POPUP_IMAGE_MODEL = 'gpt-image-2'
/** 1枚あたりの見込み（米ドル）。reference/services/asklink.md「原価」の gpt-image-2 medium 1枚 $0.05〜0.07 の上側 */
export const POPUP_IMAGE_USD_ESTIMATE = 0.07
export { POPUP_IMAGE_DAILY_LIMIT, IMAGE_BRIEF_LIMITS } from './imagegen-public'
export const POPUP_IMAGE_QUOTA_SCOPE = 'popup-image'

/** 大きさ（16の倍数・長辺:短辺が3:1以内・1024×1024以上の面積。gpt-image-2 の条件）。ポップアップの縦横比に合わせる */
export const POPUP_IMAGE_SIZES: Record<PopupLayout, { width: number; height: number }> = {
  modal: { width: 1024, height: 1280 },
  slide: { width: 1024, height: 1024 },
  bar: { width: 1920, height: 640 },
}

export function popupImageSize(layout: PopupLayout): { width: number; height: number; size: string } {
  const s = POPUP_IMAGE_SIZES[layout] || POPUP_IMAGE_SIZES.modal
  return { ...s, size: `${s.width}x${s.height}` }
}

export interface ImageBrief {
  /** 画像に描く短い見出し（空なら文字を描かない） */
  headline: string
  /** 伝えたいこと（絵の内容の指示。文字としては描かない） */
  message: string
}

function clean(v: unknown): string {
  if (typeof v !== 'string') return ''
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim()
}

/** 入力の検査。長すぎるときは切らずに断る（黙って切ると意図とずれた絵になる） */
export function parseImageBrief(raw: unknown): { ok: true; brief: ImageBrief } | { ok: false; error: string } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const headline = clean(r.headline)
  const message = clean(r.message)
  if (Array.from(headline).length > IMAGE_BRIEF_LIMITS.headline) return { ok: false, error: `画像に入れる見出しは${IMAGE_BRIEF_LIMITS.headline}字以内にしてください。` }
  if (Array.from(message).length > IMAGE_BRIEF_LIMITS.message) return { ok: false, error: `伝えたいことは${IMAGE_BRIEF_LIMITS.message}字以内にしてください。` }
  return { ok: true, brief: { headline, message } }
}

const cut = (s: string, n: number) => Array.from(clean(s)).slice(0, n).join('')

/** 指示文。サイトの内容・見出し・伝えたいこと・色から作る */
export function buildImagePrompt(input: {
  site: Partial<SiteProfile>
  brief: ImageBrief
  colors: { bg: string; accent: string; text: string }
  layout: PopupLayout
}): string {
  const { site, brief, colors, layout } = input
  const { width, height } = popupImageSize(layout)
  const strengths = (Array.isArray(site.strengths) ? site.strengths : []).slice(0, 3).map((x) => cut(String(x), 40)).filter(Boolean)
  const lines = [
    `Webサイトのポップアップに表示する画像。${width}×${height}px。ポップアップ全体が1枚の画像で、押すとリンク先に移る。`,
    '',
    '【サイトの内容（絵の題材を決める参考。文字としては描かない）】',
    site.summary ? `- サービス内容: ${cut(site.summary, 200)}` : '',
    site.target ? `- 対象のお客さま: ${cut(site.target, 80)}` : '',
    strengths.length ? `- 強み: ${strengths.join(' / ')}` : '',
    brief.message ? `- 伝えたいこと: ${brief.message}` : '',
    '',
    '【色】',
    `- 基調色: ${colors.accent}（強調）、${colors.bg}（背景に近い明るい色）、${colors.text}（文字の色）。この3色を中心に、全体の色をそろえる。`,
    '',
    '【絵のつくり】',
    '- 清潔でフラットなイラスト調。余白を十分に取り、要素は少なくする。',
    '- 人物を描く場合は、架空のイラストの人物にする。実在の人物・有名人・特定の個人に似せた顔は描かない。',
    '- 実在の企業・商品・サービスのロゴ、商標、ウォーターマーク、QRコード、URLは描かない。',
    '- ボタン、入力欄、閉じるボタン、価格、電話番号、住所は描かない。',
    '',
    '【文字】',
    brief.headline
      ? `- 画像に描く文字は、次の見出し1つだけ。一字一句そのまま、くっきり読める日本語で、大きく描く。「${brief.headline}」`
      : '- 画像に文字は一切描かない。',
    '- 上の見出し以外の文字（小見出し、説明文、注記、英語を含む）は描かない。',
    layout === 'bar' ? '- 横長の帯。左右の端から1割には重要な要素を置かない。' : '- 上下左右の端から1割には、重要な要素や文字を置かない（背景は端まで続ける）。',
  ]
  return lines.filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n')
}

/** 生成された画像（PNG など）を WebP に変えて 2MB 以内にする。収まらなければ null */
export async function toStoredImage(base64: string): Promise<Buffer | null> {
  const src = Buffer.from(base64, 'base64')
  for (const quality of [88, 76, 62]) {
    const out = await sharp(src).webp({ quality }).toBuffer()
    if (out.length <= MAX_IMAGE_BYTES) return out
  }
  return null
}

export type GenerateFn = typeof generateImageWithFallback

export type GenerateResult = { ok: true; image: Buffer; model: string; fallbackUsed: boolean; prompt: string } | { ok: false; reason: 'too_large' }

/**
 * 1枚作って、保存できる形（WebP・2MB以内）にする。生成の関数は引数で受ける。
 * ⚠️ size と quality は必ずここで明示する。失敗したら例外のまま呼び出し元へ（課金の戻し方は呼び出し元が決める）。
 */
export async function generatePopupImage(
  deps: { generate: GenerateFn },
  input: { site: Partial<SiteProfile>; brief: ImageBrief; colors: { bg: string; accent: string; text: string }; layout: PopupLayout }
): Promise<GenerateResult> {
  const { size, width, height } = popupImageSize(input.layout)
  const prompt = buildImagePrompt(input)
  const r = await deps.generate({
    prompt,
    size,
    aspectRatio: aspectOf(width, height),
    quality: POPUP_IMAGE_QUALITY,
  })
  const image = await toStoredImage(r.base64)
  if (!image) return { ok: false, reason: 'too_large' }
  return { ok: true, image, model: r.model, fallbackUsed: r.fallbackUsed, prompt }
}

/** Gemini に渡す比率（フォールバックのとき size だけだと正方形になるため、必ず渡す） */
function aspectOf(w: number, h: number): string {
  if (w === h) return '1:1'
  if (w / h >= 2.5) return '21:9'
  return '4:5'
}

export type SavedImage = { path: string; width: number; height: number }

export type GenerateAndSaveResult =
  | { ok: true; saved: SavedImage; prompt: string }
  | {
      ok: false
      status: number
      message: string
      /** 1日の回数を戻してよいか。上流が失敗を確かに返した（作られていない）ときだけ true */
      refundQuota: boolean
      /** 課金されたかもしれない（true のとき、応答に DOYA_POWER_CONSUMED_HEADER を付けてドヤパワーを戻さない） */
      consumed: boolean
    }

/**
 * 1枚作って保存する。失敗の種類ごとに、回数とドヤパワーを戻すかを決める（正本）。
 * - 上流が失敗を確かに返した（status が数）→ 作られていない。回数もドヤパワーも戻す
 * - 応答は返ったが画像が無い → 課金はされた。回数は戻す・ドヤパワーは戻さない
 * - 時間切れ・切断 → 作られたか分からない。どちらも戻さない
 * - 作れたあとの失敗（大きすぎる・保存できない）→ 課金された。どちらも戻さない
 */
export async function generateAndSave(
  deps: { generate: GenerateFn; save: (image: Buffer) => Promise<SavedImage | { error: string }> },
  input: Parameters<typeof generatePopupImage>[1]
): Promise<GenerateAndSaveResult> {
  let r: GenerateResult
  try {
    r = await generatePopupImage({ generate: deps.generate }, input)
  } catch (e) {
    const status = (e as { status?: unknown })?.status
    const msg = e instanceof Error ? e.message : ''
    const generic = '画像を作れませんでした。時間をおいて、もう一度お試しください。'
    if (typeof status === 'number') return { ok: false, status: 502, message: generic, refundQuota: true, consumed: false }
    if (/returned no image/.test(msg)) return { ok: false, status: 502, message: '画像を作れませんでした。内容を変えて、もう一度お試しください。', refundQuota: true, consumed: true }
    return { ok: false, status: 502, message: generic, refundQuota: false, consumed: true }
  }
  if (!r.ok) return { ok: false, status: 502, message: '作った画像が大きすぎて保存できませんでした。もう一度作り直してください。', refundQuota: false, consumed: true }
  let saved: SavedImage | { error: string }
  try {
    saved = await deps.save(r.image)
  } catch {
    saved = { error: 'save failed' }
  }
  if ('error' in saved) return { ok: false, status: 502, message: '画像を保存できませんでした。時間をおいて、もう一度お試しください。', refundQuota: false, consumed: true }
  return { ok: true, saved, prompt: r.prompt }
}
