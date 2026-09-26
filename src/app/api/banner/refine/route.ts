import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import sharp from 'sharp'
import { sendErrorNotification } from '@/lib/notifications'
import { resolveImageModel } from '@/lib/resolve-image-model'
import { HIGH_USAGE_CONTACT_URL } from '@/lib/pricing'
import { reserveBannerMonthlyImages, releaseBannerMonthlyImages, type BannerReservation, type BannerQuotaUsage } from '@/lib/banner/monthly-quota'

/** 画像を1024x1024以内に縮小してAPIに送れるサイズにする（nanobanner.tsの巨大バンドル回避） */
async function compressForApi(dataUrl: string): Promise<string> {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!m) return dataUrl
  const buf = Buffer.from(m[2], 'base64')
  const compressed = await sharp(buf)
    .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer()
  return `data:image/png;base64,${compressed.toString('base64')}`
}

// ========================================
// バナー修正API
// ========================================
// POST /api/banner/refine
// 修正指示に基づいて「元画像 + 指示」で画像を修正（再生成）
// Nano Banana Pro（Gemini 2.0 Flash Experimental）+ Google AI Studio APIキー
// 参考: https://ai.google.dev/gemini-api/docs/image-generation?hl=ja

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
function getNanoBananaImageModel(): string {
  // Nano Banana Pro ONLY（Gemini 3）
  return (
    process.env.DOYA_BANNER_IMAGE_MODEL ||
    process.env.NANO_BANANA_PRO_MODEL ||
    process.env.GEMINI_IMAGE_MODEL ||
    'gemini-3-pro-image-preview'
  )
}

function getImageFallbackModel(): string {
  // Nano Banana Pro の範囲内でフォールバック
  return process.env.DOYA_BANNER_IMAGE_FALLBACK_MODEL || 'nano-banana-pro-preview'
}

// 最終フォールバックも Gemini 3 系のみ（Gemini 2.0 は禁止）
const LAST_RESORT_IMAGE_MODEL = 'gemini-3-flash-preview'

interface RefineRequest {
  originalImage: string
  instruction: string
  category?: string
  size?: string
}

interface RefineResponse {
  success: boolean
  refinedImage?: string
  error?: string
  message?: string
  code?: string
  usage?: BannerQuotaUsage
  upgradeUrl?: string
}

function getApiKey(): string {
  const apiKey = 
    process.env.GOOGLE_GENAI_API_KEY || 
    process.env.GOOGLE_AI_API_KEY || 
    process.env.GEMINI_API_KEY ||
    process.env.NANOBANNER_API_KEY

  if (!apiKey) throw new Error('GOOGLE_GENAI_API_KEY が設定されていません')
  return apiKey
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!m) throw new Error('originalImage の形式が不正です（data URLを期待）')
  return { mimeType: m[1], data: m[2] }
}

async function enforceExactSizePng(dataUrl: string, size?: string): Promise<string> {
  const [w, h] = (size || '').split('x').map((v) => Number(v))
  if (!w || !h) return dataUrl
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!m) return dataUrl
  const base64 = m[2]
  const input = Buffer.from(base64, 'base64')

  // まずはメタデータ確認（すでに一致なら何もしない）
  try {
    const meta = await sharp(input).metadata()
    if (meta?.width === w && meta?.height === h) return dataUrl
  } catch {
    // 継続
  }

  // NOTE:
  // - padding/letterbox は禁止（上下の帯が出る）なので、最終的に cover で揃える
  // - その代わり、プロンプト側で「文字は安全余白に収める」を強制してクリップを避ける
  const out = await sharp(input)
    .resize(w, h, { fit: 'cover', position: 'centre' })
    .png({ compressionLevel: 9 })
    .toBuffer()
  return `data:image/png;base64,${out.toString('base64')}`
}

export async function POST(request: NextRequest): Promise<NextResponse<RefineResponse>> {
  let reservation: BannerReservation | null = null
  let charged = false
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ success: false, error: 'ログインが必要です' }, { status: 401 })
    }

    const body: RefineRequest = await request.json()
    const { originalImage, instruction, category, size } = body

    if (!instruction || instruction.trim().length < 3) {
      return NextResponse.json({
        success: false,
        error: '修正指示を入力してください（3文字以上）',
      }, { status: 400 })
    }

    if (!originalImage || typeof originalImage !== 'string') {
      return NextResponse.json({
        success: false,
        error: '元画像が見つかりません。生成結果から選択してください。',
      }, { status: 400 })
    }

    const apiKey = getApiKey()
    const compressed = await compressForApi(originalImage)
    const img = parseDataUrl(compressed)

    if (process.env.DOYA_DISABLE_LIMITS !== '1') {
      let claim
      try { claim = await reserveBannerMonthlyImages(userId, 1) }
      catch {
        console.error('Banner refine quota reservation unavailable')
        return NextResponse.json({ success: false, error: '生成枠を確認できませんでした。時間をおいて再試行してください。' }, { status: 503 })
      }
      if (claim.state === 'limit') {
        const paid = claim.plan !== 'FREE'
        return NextResponse.json({
          success: false,
          error: paid ? '今月の生成上限に達しました。追加の生成枠についてご相談ください。' : '今月の生成上限に達しました。プランをご確認ください。',
          code: 'MONTHLY_LIMIT_REACHED',
          usage: claim.usage,
          upgradeUrl: paid ? (HIGH_USAGE_CONTACT_URL || '/banner/pricing') : '/banner/pricing',
        }, { status: 429 })
      }
      reservation = claim.reservation
    }

    const prompt = createEditPrompt(instruction, category, size)
    // ⚠️ 環境変数 DOYA_BANNER_IMAGE_MODEL には "nano-banana-pro" という**エイリアス**が入っている。
    //    これは実在の Gemini モデルIDではないため、生のまま models/{id}:generateContent に渡すと
    //    毎回 404 になり、1往復を捨てたうえで console.error → Slackにエラー通知が飛んでいた（2026-09-18 調査）。
    //    resolveImageModel() は ListModels API で実モデルIDへ解決し、失敗時もフォールバック列を返す。
    //    ここに getNanoBananaImageModel()（生値）を混ぜ戻さないこと。エイリアスが再びAPIへ流れる。
    const resolved = await resolveImageModel(apiKey).catch(() => [] as string[])
    const modelsToTry = Array.from(
      new Set([...resolved, getImageFallbackModel(), LAST_RESORT_IMAGE_MODEL])
    )
    let lastError: any = null

    for (const model of modelsToTry) {
      try {
        const endpoint = `${GEMINI_API_BASE}/models/${model}:generateContent`

        const requestBody: any = {
          contents: [
            {
              parts: [
                { inlineData: { mimeType: img.mimeType, data: img.data } },
                { text: prompt },
              ],
            },
          ],
          generationConfig: {
            // 編集時はサイズがブレやすいので、画像のみを要求しつつプロンプトでピクセル指定を厳守
            responseModalities: ['IMAGE'],
          },
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify(requestBody),
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('Nano Banana Pro refine error:', response.status, errorText)
          throw new Error(`API Error: ${response.status} - ${errorText.substring(0, 300)}`)
        }

        const data = await response.json()

        const parts = data?.candidates?.[0]?.content?.parts
        const imgPart = Array.isArray(parts) ? parts.find((p: any) => p?.inlineData?.data) : null
        if (!imgPart?.inlineData?.data) throw new Error('画像が生成されませんでした')
        const mimeType = imgPart.inlineData.mimeType || 'image/png'
        const refinedImageRaw = `data:${mimeType};base64,${imgPart.inlineData.data}`
        const refinedImage = await enforceExactSizePng(refinedImageRaw, size)

        const result = NextResponse.json({
          success: true,
          refinedImage,
          message: `Nano Banana Pro で画像を修正しました（model: ${model}${model === modelsToTry[0] ? '' : ' / fallback'}）`,
        })
        charged = true
        return result
      } catch (e: any) {
        lastError = e
        continue
      }
    }

    throw lastError || new Error('バナーの再生成に失敗しました')

  } catch (error: any) {
    console.error('Banner refine error:', error)
    sendErrorNotification({
      errorMessage: error?.message || 'Banner refine failed',
      errorStack: error?.stack,
      pathname: '/api/banner/refine',
      requestMethod: 'POST',
      timestamp: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
    }).catch(() => {})
    return NextResponse.json({
      success: false,
      error: error.message || 'バナーの再生成に失敗しました',
    }, { status: 500 })
  } finally {
    if (reservation && !charged) {
      await releaseBannerMonthlyImages(reservation, 1).catch(() => console.error('Banner refine quota release failed'))
    }
  }
}

function createEditPrompt(instruction: string, category?: string, size?: string): string {
  // サイズ情報から余白なし指定を作成
  const [w, h] = (size || '').split('x').map(Number)
  const sizeNote = w && h ? `Output dimensions: EXACTLY ${w}x${h} px. Do NOT change aspect ratio. NO padding, NO letterboxing, NO borders.` : ''
  const tightTextNote =
    w && h && (h <= 120 || w / h >= 3.5)
      ? `SMALL/THIN FORMAT (CRITICAL):
- This is a small-height / extreme-wide banner. NEVER let any text be clipped.
- If space is tight, reduce font size and simplify decorative elements. Keep text inside safe margins (>= 6% from edges).
- Prefer 1-line headline; if unavoidable, 2 short lines with smaller font.`
      : ''
  return `Edit the provided Japanese marketing banner image.

USER INSTRUCTION:
${instruction}

${category ? `INDUSTRY: ${category}` : ''}
${sizeNote}
${tightTextNote}

=== DESIGN RULES ===
- STYLE: High-CTR Japanese paid-ad creative (SNS, Display, Landing page).
- LAYOUT: Keep text intact and readable. Update layout ONLY if user explicitly requests.
- TEXT: If user asks to change text, render the NEW Japanese text clearly with legible font, solid/gradient panel for contrast, and NO pseudo-characters.
- NO DUPLICATION: Do NOT repeat the same phrase. Never place identical text twice (e.g., no duplicated catchphrase/CTA).
- DIMENSIONS: Fill the ENTIRE canvas edge-to-edge. **ZERO** white-space or margin.
- NO logos, emblems, seals, watermarks, or invented brand marks unless user explicitly provides or requests.
- If user asks to add/remove elements, do so while maintaining visual hierarchy and text readability.
- Output ONE refined image (PNG).
`
}
