// ============================================
// ドヤAI質問リンク ポップアップ用バナー（4-3）
// ============================================
// ⚠️ 文字は画像生成AIに一枚絵として描かせる。後から文字を重ねる合成はしない（adimage と同じ方針）。
// ⚠️ 画像は統一ディスパッチャ generateImageWithFallback 経由。画像APIを直接呼ばない。
// ⚠️ 焼き込んだ文字は後から直せないので、OCRで照合して不合格なら作り直す（最大2回）。
//    検査自体が失敗したら合格扱いにせず「要確認」にする。
// ⚠️ 書き出しは縮小のみ。cover で切り抜くと見出しやボタンが欠ける。
// ⚠️ ASKLINK_IMAGE_MOCK=1 のときは画像APIを呼ばずにモック画像を返す（開発中の動作確認用。課金なし）。
import sharp from 'sharp'
import { generateImageWithFallback } from '@/lib/image-generator'
import { visionJson } from '@/lib/adimage/vision'
import { normalizeForCompare } from '@/lib/adimage/verify'
import { BANNER_BUTTON_TEXT, BANNER_NOTE_TEXT, type BannerCopy, type BannerSpec, type BannerVerify } from './types'

/** 作り直しの上限（初回＋2回） */
const MAX_REGENERATE = 2
/** これを過ぎたら次の作り直しを始めない（maxDuration=300 に収めるため。medium は1枚38〜93秒） */
const RETRY_DEADLINE_MS = 150_000

export function isMockImageMode(): boolean {
  return process.env.ASKLINK_IMAGE_MOCK === '1'
}

/** 生成サイズ。目標と同じ比率で生成し、書き出しは縮小だけにする */
function layoutFor(spec: BannerSpec): string {
  if (spec.kind === 'landscape') {
    return [
      '横長のレイアウト。',
      '左上に小さくサービス名。左半分に大見出し、その下に小見出し。',
      '右半分に、丸みのある吹き出しを3つ、少しずらして縦に並べる。',
      '下部中央に濃紺の角丸ボタン。その真下に小さな注記。',
    ].join('')
  }
  if (spec.kind === 'square') {
    return [
      '正方形のレイアウト。',
      '上部に小さくサービス名、その下に大見出しと小見出しを中央揃え。',
      '中段に、丸みのある吹き出しを3つ、左右に散らして配置。',
      '下部中央に濃紺の角丸ボタン。その真下に小さな注記。',
    ].join('')
  }
  return [
    '縦長（スマホ画面）のレイアウト。',
    '上部に小さくサービス名、その下に大見出しと小見出しを中央揃え。',
    '中段に、丸みのある吹き出しを3つ、縦に少しずらして配置。',
    '下部中央に大きめの濃紺の角丸ボタン。その真下に小さな注記。',
    '上下の端から1割には文字を置かない（背景のデザインは端まで続ける）。',
  ].join('')
}

export function buildBannerPrompt(spec: BannerSpec, copy: BannerCopy, siteName: string, color: string): string {
  return [
    `Webサイトのポップアップに表示するバナー画像。${spec.w}×${spec.h}px。`,
    `背景: ${color} を基調にした、淡く明るいグラデーション。清潔でフラットなイラスト調。写真は使わない。`,
    layoutFor(spec),
    '',
    '画像内に描く文字は次のものだけ。一字一句そのまま、くっきり読める日本語で描く。',
    `- サービス名: 「${siteName}」`,
    `- 大見出し: 「${copy.headline}」`,
    `- 小見出し: 「${copy.sub}」`,
    `- 吹き出し1: 「${copy.bubbles[0]}」`,
    `- 吹き出し2: 「${copy.bubbles[1]}」`,
    `- 吹き出し3: 「${copy.bubbles[2]}」`,
    `- ボタン: 「${BANNER_BUTTON_TEXT} →」（濃紺 #0a0f3c の角丸ボタンに白文字）`,
    `- 注記: 「${BANNER_NOTE_TEXT}」（ボタンの下に小さく）`,
    '',
    '上に挙げた以外の文字・英字・数字・ロゴ・透かしは描かない。ChatGPTのロゴやアイコンも描かない。人物は描かない。',
  ].join('\n')
}

interface VisionOcr {
  texts: string[]
}

/**
 * 横長の帯に切り出して2倍に拡大する（8本。境目の文字が切れないよう少しずつ重ねる）。
 * ⚠️ 帯を細くするのは、近くの別の文字に引きずられた読み違いを避けるため。
 *    上下半分で読ませると、同じ帯に入った「AIに聞く」に引きずられて「開きます」を「聞きます」と読んだ。
 */
async function strips(pngBase64: string, count = 8): Promise<string[]> {
  const buf = Buffer.from(pngBase64, 'base64')
  const { width = 0, height = 0 } = await sharp(buf).metadata()
  const h = Math.min(height, Math.ceil(height * 0.16))
  const step = (height - h) / (count - 1)
  const parts = Array.from({ length: count }, (_, i) =>
    sharp(buf).extract({ left: 0, top: Math.round(step * i), width, height: h }).resize(width * 2).png().toBuffer()
  )
  return (await Promise.all(parts)).map((b) => b.toString('base64'))
}

async function readText(pngBase64: string): Promise<string[]> {
  const ocr = await visionJson<VisionOcr>({
    pngBase64,
    prompt: [
      'この画像に描かれている文字を、見えるとおりにすべて書き出してください。',
      '1つの文やフレーズが途中で改行されているときは、つなげて1つの項目にしてください。',
      '読み取れない文字や崩れた文字は、推測で補わずに見えたとおりに書いてください。',
      '出力は JSON のみ: { "texts": ["..."] }',
    ].join('\n'),
  })
  return (Array.isArray(ocr?.texts) ? ocr.texts : []).filter((t) => typeof t === 'string')
}

/**
 * 焼き込んだ文字の照合。サービス名以外の必須文言がすべて読めれば合格。
 * ⚠️ OCR は改行で分かれた見出しを取りこぼしたり、似た字（開/聞）を読み違えたりする。
 *    1回目で足りない文言があれば、画像を作り直す前にもう一度だけ読む（読み取りは画像生成より桁違いに安い）。
 *    どちらかの読み取りで見つかれば描けているとみなす。
 */
export async function verifyBanner(pngBase64: string, copy: BannerCopy): Promise<BannerVerify> {
  const expected = [copy.headline, copy.sub, ...copy.bubbles, BANNER_BUTTON_TEXT, BANNER_NOTE_TEXT]
  const reads: string[][] = []
  const missingIn = () => {
    const joined = reads.map((r) => normalizeForCompare(r.join('')))
    return expected.filter((e) => !joined.some((j) => j.includes(normalizeForCompare(e))))
  }
  try {
    reads.push(await readText(pngBase64))
  } catch (e) {
    console.warn('[asklink] OCR failed', (e as Error)?.name)
    // ⚠️ 検査が成立していないので合格扱いにしない
    return { ok: false, needsReview: true, missing: [] }
  }
  let missing = missingIn()
  if (missing.length > 0) {
    // 2回目は細い帯に切って拡大して読む。小さい文字は全体のままだと読み違える（開→聞）
    try {
      const texts = await Promise.all((await strips(pngBase64)).map(readText))
      // 帯ごとに分かれた文言をまとめて1つの読み取りとして扱う
      reads.push(texts.flat())
      missing = missingIn()
    } catch (e) {
      console.warn('[asklink] OCR retry failed', (e as Error)?.name)
    }
  }
  return { ok: missing.length === 0, needsReview: missing.length > 0, missing, detectedText: reads.map((r) => r.join(' / ')).join(' || ').slice(0, 500) }
}

/** 縮小のみで目標サイズへ。比率が数%ずれる分は fill（切り抜かない） */
async function toTargetSize(buf: Buffer, spec: BannerSpec): Promise<Buffer> {
  const meta = await sharp(buf).metadata()
  if (meta.width === spec.w && meta.height === spec.h) return sharp(buf).png().toBuffer()
  const srcRatio = (meta.width || spec.w) / (meta.height || spec.h)
  const dstRatio = spec.w / spec.h
  if (Math.abs(srcRatio - dstRatio) / dstRatio < 0.05) {
    return sharp(buf).resize(spec.w, spec.h, { fit: 'fill' }).png().toBuffer()
  }
  // 比率が大きく違う（フォールバック先が別比率で返した等）ときは余白で収める
  const { dominant } = await sharp(buf).stats()
  return sharp(buf)
    .resize(spec.w, spec.h, { fit: 'contain', background: { r: dominant.r, g: dominant.g, b: dominant.b, alpha: 1 } })
    .png()
    .toBuffer()
}

/** モック画像（課金なし）。レイアウトの枠だけを描く */
async function mockBanner(spec: BannerSpec, color: string): Promise<Buffer> {
  const { w, h } = spec
  const bw = Math.round(w * 0.32)
  const bh = Math.round(h * 0.09)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="${color}" stop-opacity="0.35"/></linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <rect x="${w * 0.08}" y="${h * 0.16}" width="${w * 0.5}" height="${h * 0.08}" rx="8" fill="#0a0f3c" opacity="0.8"/>
  <rect x="${w * 0.08}" y="${h * 0.28}" width="${w * 0.4}" height="${h * 0.05}" rx="6" fill="#0a0f3c" opacity="0.4"/>
  <rect x="${(w - bw) / 2}" y="${h * 0.74}" width="${bw}" height="${bh}" rx="${bh / 2}" fill="#0a0f3c"/>
  <text x="${w / 2}" y="${h * 0.5}" font-family="sans-serif" font-size="${Math.round(Math.min(w, h) * 0.06)}" text-anchor="middle" fill="#0a0f3c" opacity="0.5">MOCK ${w}x${h}</text>
</svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

export interface BannerResult {
  png: Buffer
  model: string
  verify: BannerVerify
  attempts: number
}

/** 1枚を生成して検査する。不合格なら作り直し、最後まで不合格なら要確認として返す（黙って捨てない） */
export async function generateBanner(spec: BannerSpec, copy: BannerCopy, siteName: string, color: string): Promise<BannerResult> {
  if (isMockImageMode()) {
    return { png: await mockBanner(spec, color), model: 'mock', verify: { ok: true, needsReview: false, missing: [], detectedText: 'モック画像' }, attempts: 1 }
  }

  const started = Date.now()
  const base = buildBannerPrompt(spec, copy, siteName, color)
  let hint = ''
  let last: BannerResult | null = null
  for (let attempt = 0; attempt <= MAX_REGENERATE; attempt++) {
    if (attempt > 0 && Date.now() - started > RETRY_DEADLINE_MS) break
    const result = await generateImageWithFallback({
      prompt: base + hint,
      size: `${spec.w}x${spec.h}`,
      quality: 'medium',
      aspectRatio: spec.kind === 'landscape' ? 'landscape (horizontal)' : spec.kind === 'portrait' ? 'portrait (vertical)' : 'square',
    })
    const png = await toTargetSize(Buffer.from(result.base64, 'base64'), spec)
    const verify = await verifyBanner(png.toString('base64'), copy)
    last = { png, model: result.model, verify, attempts: attempt + 1 }
    if (verify.ok) return last
    // 検査そのものが失敗した場合は作り直しても判定できないので打ち切る
    if (!verify.missing.length) break
    hint = `\n\n前回は次の文字が正しく描けていませんでした。特に丁寧に、一字一句そのまま描いてください: ${verify.missing.map((m) => `「${m}」`).join(' ')}`
  }
  return last!
}
