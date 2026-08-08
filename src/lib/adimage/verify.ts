// ============================================
// ドヤ広告画像AI 自動検査（フルベイクの品質保証）
// ============================================
// ⚠️ 焼き込んだ文字は後から直せない。だから**出す前に検査して、不合格なら作り直す**。
//    これが無いと、崩れた文字・混入したダミー英字・UIに隠れる位置の文字が
//    そのままユーザーへ出る（前身 /adbanner で実際に起きていた）。
//
// リトライは最大2回。maxDuration=300 を超えないため。
// 2回とも不合格なら「要確認」フラグを立てて提示する。⚠️ 黙って捨てない。
import { visionJson } from './vision'
import type { AdCopy, VerifyResult } from './types'
import { COMPOSITIONS } from './compositions'
import type { CompositionKey } from './placements'

/**
 * OCR結果の表記ゆれを吸収する。
 * 全角/半角・空白・約物の違いで誤判定すると、正しく描けている画像を
 * 何度も作り直すことになる（時間も費用も無駄になる）。
 */
export function normalizeForCompare(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .replace(/[、。，．,.!！?？・･:：;；\-—–ー~〜"'"'「」『』（）()[\]【】]/g, '')
    .toLowerCase()
}

interface VisionOcr {
  /** 画像内の文字をすべて書き出したもの */
  texts: string[]
  /** 各テキストの縦方向の位置（0〜1の正規化座標） */
  boxes: Array<{ text: string; ymin: number; ymax: number }>
}

export interface VerifyInput {
  pngBase64: string
  copy: AdCopy
  composition: CompositionKey
}

/** 構図ごとの、文字が入ってよい縦方向の範囲 */
function safeRangeFor(composition: CompositionKey): { min: number; max: number } {
  // vertical-stack は縦10分割の3〜8帯（＝0.2〜0.8）が仕様
  if (composition === 'vertical-stack') return { min: 0.2, max: 0.8 }
  if (composition === 'compact') return { min: 0.06, max: 0.94 }
  return { min: 0.08, max: 0.92 }
}

export async function verifyCreative(input: VerifyInput): Promise<VerifyResult> {
  const { pngBase64, copy, composition } = input
  const omitSub = COMPOSITIONS[composition].omit.includes('sub')

  // 期待する文字列。compact ではサブコピーを描かせていないので照合対象から外す
  const expected = [copy.headline, omitSub ? null : copy.sub, copy.cta].filter(Boolean) as string[]

  let ocr: VisionOcr
  try {
    ocr = await visionJson<VisionOcr>({
      pngBase64,
      prompt: [
        'この広告画像を見て、次の2つを答えてください。',
        '',
        '1. texts: 画像内に描かれている文字を**すべて**、見えるとおりに書き出してください。',
        '   ロゴ内の文字、装飾的な英字、小さな注釈も漏らさず含めてください。',
        '   読み取れない・崩れている文字は、崩れたまま書いてください（勝手に補正しないこと）。',
        '',
        '2. boxes: 各テキストが画像の縦方向のどこにあるかを、0〜1に正規化した座標で返してください。',
        '   画像の一番上が0、一番下が1です。ymin がテキスト上端、ymax が下端です。',
        '',
        '出力するJSONの形式:',
        '{ "texts": ["..."], "boxes": [{ "text": "...", "ymin": 0.3, "ymax": 0.42 }] }',
      ].join('\n'),
    })
  } catch {
    // 検査そのものが失敗したときは「要確認」にする。
    // ⚠️ ここで合格扱いにすると検査が無いのと同じになる。
    return { ocrMatch: false, extraText: [], safeAreaOk: true, retries: 0, needsReview: true }
  }

  const detected = (ocr?.texts || []).filter((t) => typeof t === 'string')
  const detectedJoined = normalizeForCompare(detected.join(''))

  // --- 指定した文字列が正しく描かれたか ---
  const missing = expected.filter((e) => !detectedJoined.includes(normalizeForCompare(e)))
  const ocrMatch = missing.length === 0

  // --- 指定外の文字が混入していないか ---
  // 1〜2字の断片は装飾や誤検出が多く、これで落とすと通らなくなる。3字以上を対象にする。
  const expectedNorm = expected.map(normalizeForCompare)
  const extraText = detected.filter((t) => {
    const n = normalizeForCompare(t)
    if (n.length < 3) return false
    return !expectedNorm.some((e) => e.includes(n) || n.includes(e))
  })

  // --- セーフエリアを侵していないか ---
  const range = safeRangeFor(composition)
  const boxes = (ocr?.boxes || []).filter((b) => b && Number.isFinite(b.ymin) && Number.isFinite(b.ymax))
  // 指定した文字列に対応する箱だけを見る（混入文字の位置で落とすと二重に罰することになる）
  const targetBoxes = boxes.filter((b) => expectedNorm.some((e) => normalizeForCompare(b.text).includes(e) || e.includes(normalizeForCompare(b.text))))
  const safeAreaOk = targetBoxes.every((b) => b.ymin >= range.min - 0.02 && b.ymax <= range.max + 0.02)

  return {
    ocrMatch,
    extraText: extraText.slice(0, 10),
    safeAreaOk,
    retries: 0,
    needsReview: false,
    detectedText: detected.join(' / ').slice(0, 500),
  }
}

/** 合格の判定。混入文字は1件までは許容する（装飾の誤検出が混じるため） */
export function isAcceptable(v: VerifyResult): boolean {
  return v.ocrMatch && v.safeAreaOk && v.extraText.length <= 1
}

/** 不合格の理由を、再生成プロンプトに足す指示文にする */
export function retryHint(v: VerifyResult, copy: AdCopy): string {
  const hints: string[] = []
  if (!v.ocrMatch) {
    hints.push(
      `前回、指定した文字が正しく描かれませんでした。次の文字列を**一字一句そのまま**、崩さずに描いてください: 「${copy.headline}」「${copy.sub}」「${copy.cta}」`
    )
  }
  if (v.extraText.length > 1) {
    hints.push(
      `前回、指定していない文字（${v.extraText.slice(0, 5).join(' / ')}）が混入しました。指定した文字以外は、英字・数字・記号を含めて一切描かないでください。`
    )
  }
  if (!v.safeAreaOk) {
    hints.push('前回、文字が配置ルールの範囲外にはみ出しました。配置ルールを厳密に守り、指定した帯の内側にすべての文字を収めてください。')
  }
  return hints.join('\n')
}
