export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { IMAGE_SIZE, RATIOS, TENJIKAI_IMAGE_MODEL_ID, estimateQuotaYen, type ImageGenRequest } from '@/lib/tenjikai/imagegen'
import { generateImageGeminiPro } from '@/lib/image-generator'
import { perUserDailyImages, remainingImagesToday, refundImageQuota, reserveImageQuota } from '@/lib/tenjikai/image-quota'
import { mockPanelImage } from '@/lib/tenjikai/mock-image'
import { withDoyaPowerCharge, parseCount, DOYA_POWER_CONSUMED_HEADER } from '@/lib/doya-power/charge'
import { isTenjikaiImagegenAllowed } from '@/lib/tenjikai/imagegen-flag'

const MAX_COUNT = 4
const MAX_PROMPT_CHARS = 4000
const MAX_REFERENCE_BYTES = 4 * 1024 * 1024
const COUNT_ERROR = '枚数は1〜4の数で指定してください。'
// 課金（units）とハンドラで、同じ読み方を使う（ずれると、払った枚数と作る枚数が食い違う）
const readCount = (v: unknown) => parseCount(v, 1, MAX_COUNT, 1)
const JOB_KINDS = ['creative_image', 'booth_render', 'graphic_panel'] as const

// 従量課金の API。モデルと解像度はサーバーが決める（利用者には選ばせず、原価も見せない）。
// 生成の前にサーバー側で上限を消費する（src/lib/tenjikai/image-quota.ts）。失敗して画像を返さないときは、消費した枚数と金額を戻す。
// 1人あたりの枚数とサービス全体の金額を SystemSetting で数えるので、Vercel のインスタンスをまたいでも守れる。
// 実行の記録は TenjikaiGenerationJob に残す（見込み額・結果・失敗の理由）。

const fail = (status: number, error: string) => NextResponse.json({ error }, { status })
// 誰に許すかは TENJIKAI_IMAGEGEN_ROLLOUT（off / preview / all）で決める（src/lib/tenjikai/imagegen-flag.ts）。off ならセッションも読まない
const enabled = () => isTenjikaiImagegenAllowed()
// 開発中の画面確認用。課金 API を呼ばずに見本の画像を返す。開発サーバー（next dev）でだけ効く
const mockMode = () => process.env.NODE_ENV === 'development' && process.env.TENJIKAI_IMAGEGEN_MOCK === 'true'

async function currentUserId() {
  const session = await getServerSession(authOptions).catch(() => null)
  return (session?.user as { id?: string } | undefined)?.id ?? null
}

// 画面に出す「きょう作れる残りの枚数」
export async function GET() {
  if (mockMode()) return NextResponse.json({ enabled: true, remaining: perUserDailyImages(), perDay: perUserDailyImages() })
  if (!(await enabled())) return NextResponse.json({ enabled: false, remaining: 0, perDay: perUserDailyImages() })
  const userId = await currentUserId()
  if (!userId) return fail(401, 'ログインが必要です。')
  return NextResponse.json({ enabled: true, remaining: await remainingImagesToday(userId), perDay: perUserDailyImages() })
}

// 以下がそろったときだけ実行する。
// 1. TENJIKAI_IMAGEGEN_ROLLOUT で許された人（preview は UI_PREVIEW_EMAILS の人だけ。本番では未設定のまま＝無効。src/lib/tenjikai/imagegen-flag.ts）
// 2. ログインしている
// 3. Gemini のキー（GEMINI_API_KEY か GOOGLE_GENAI_API_KEY）が設定されている
// 4. リクエストに approved: true がある（利用者が「作る」を押した）
async function postHandler(req: NextRequest) {
  const mock = mockMode()
  // ⚠️ 本番で「準備中」と出る理由はここ。TENJIKAI_IMAGEGEN_ROLLOUT で許された人でないと、課金の API を呼ぶ前に止める（変えるのは管理者）
  if (!mock && !(await enabled())) return fail(403, '画像の生成は準備中です。')

  let body: ImageGenRequest
  try {
    body = await req.json()
  } catch {
    return fail(400, 'リクエストの形式が正しくありません。')
  }
  if (typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > MAX_PROMPT_CHARS) {
    return fail(400, `指示文は1〜${MAX_PROMPT_CHARS}文字にしてください。`)
  }
  if (!(RATIOS as readonly string[]).includes(body.aspectRatio)) return fail(400, '対応していない縦横比です。')
  if (body.referencePng !== undefined && (typeof body.referencePng !== 'string' || body.referencePng.length * 0.75 > MAX_REFERENCE_BYTES || !/^[A-Za-z0-9+/=]+$/.test(body.referencePng))) {
    return fail(400, '参照画像は4MB以下のPNGにしてください。')
  }
  if (body.approved !== true) return fail(400, '作成の確認がありません。')
  const count = readCount(body.count)
  if (count === null) return fail(400, COUNT_ERROR)

  if (mock) return NextResponse.json({ images: Array.from({ length: count }, (_, i) => mockPanelImage(body.aspectRatio, i)), mock: true })

  const userId = await currentUserId()
  if (!userId) return fail(401, 'ログインが必要です。')
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY
  if (!apiKey) {
    console.error('[tenjikai/image] GEMINI_API_KEY is not set')
    return fail(500, '画像を作るための設定が済んでいないため、作れません。管理者に連絡してください。')
  }

  const kind = (JOB_KINDS as readonly string[]).includes(String(body.kind)) ? String(body.kind) : 'creative_image'
  const costYen = estimateQuotaYen(count)

  // 上限の消費（DB が使えなければ実行しない）
  const quota = await reserveImageQuota(userId, count, costYen)
  if (!quota.ok) return fail(quota.status, quota.message)

  // 実行の記録。記録できないときは実行しない（課金の跡が残らないため）
  let jobId: string
  try {
    const job = await prisma.tenjikaiGenerationJob.create({
      data: { userId, kind, model: TENJIKAI_IMAGE_MODEL_ID, size: IMAGE_SIZE, count, estimatedCostYen: costYen, approvedAt: new Date() },
      select: { id: true },
    })
    jobId = job.id
  } catch (e) {
    console.error('[tenjikai/image] failed to record job', { code: (e as { code?: string })?.code ?? 'unknown' })
    await refundImageQuota(quota.reserved, count)
    return fail(503, '実行の記録を残せないため、画像を作れません。時間をおいて、もう一度お試しください。')
  }
  const finish = (data: { status: 'done' | 'failed'; imageCount: number; errorCode?: string; model?: string }) =>
    prisma.tenjikaiGenerationJob.update({ where: { id: jobId }, data: { ...data, finishedAt: new Date() } }).catch((e) => {
      console.error('[tenjikai/image] failed to update job', { jobId, code: (e as { code?: string })?.code ?? 'unknown' })
    })

  const inputImages = body.referencePng ? [{ mimeType: 'image/png', base64: body.referencePng }] : []

  const images: string[] = []
  const used = TENJIKAI_IMAGE_MODEL_ID
  // 上流が応答を返した要求の数（作られて課金された）と、応答を待っている最中の要求（時間切れだと結果が分からない）
  let billed = 0
  let inFlight = false
  // 失敗の終わり方。上流に送っていない分だけ枠を戻す。1枚でも作られていれば、その画像を返す（作った分は使ったことにする）。
  // 何も返せず、課金されたかもしれないときは、ドヤパワーも戻さない（DOYA_POWER_CONSUMED_HEADER の印）
  const giveUp = async (errorCode: string, status: number, message: string) => {
    await finish({ status: 'failed', imageCount: images.length, errorCode, model: used })
    await refundImageQuota(quota.reserved, count - billed - (inFlight ? 1 : 0))
    if (images.length > 0) return NextResponse.json({ images, partial: true })
    const res = fail(status, message)
    if (billed > 0 || inFlight) res.headers.set(DOYA_POWER_CONSUMED_HEADER, '1')
    return res
  }
  // 画像は統一ディスパッチャ（src/lib/image-generator.ts の generateImageGeminiPro）で作る。モデルは gemini-3-pro-image だけ、解像度は 2K を必ず指定する
  for (let i = 0; i < count; i++) {
    inFlight = true
    try {
      const r = await generateImageGeminiPro({
        prompt: body.prompt,
        size: '1024x1024',
        aspectRatio: body.aspectRatio,
        geminiImageSize: IMAGE_SIZE,
        inputImages,
        fallbackTimeoutMs: 120_000,
      })
      inFlight = false
      billed++
      images.push(`data:${r.mimeType};base64,${r.base64}`)
    } catch (e) {
      const status = (e as { status?: unknown })?.status
      const message = e instanceof Error ? e.message : ''
      if (typeof status === 'number') {
        // 上流が失敗を返した（作られていない）。応答の本文はサーバーのログにだけ残す
        inFlight = false
        console.error('[tenjikai/image] upstream error', { jobId, model: used, status })
        return giveUp(`upstream_${status}`, 502, '画像を作れませんでした。時間をおいて、もう一度お試しください。')
      }
      if (/returned no image/.test(message)) {
        // 応答は返った（課金された）が、画像が入っていなかった
        inFlight = false
        billed++
        console.error('[tenjikai/image] upstream returned no image', { jobId, index: i })
        continue
      }
      // 時間切れ・通信の切断など。作られたかどうか分からないので、inFlight のまま giveUp に渡す（その1枚は戻さない）
      console.error('[tenjikai/image] upstream request failed', { jobId, kind: e instanceof Error ? e.name : 'unknown', timeout: /timeout/.test(message) })
      return giveUp('network', 502, '画像を作れませんでした。時間をおいて、もう一度お試しください。')
    }
  }

  if (images.length === 0) {
    console.error('[tenjikai/image] upstream returned no image', { jobId })
    return giveUp('no_image', 502, '画像を作れませんでした。内容を変えて、もう一度お試しください。')
  }
  await finish({ status: 'done', imageCount: images.length, model: used })
  // 画像の保存（Supabase Storage と TenjikaiCreative.imageUrl）は、プロジェクトの保存と一緒に入れる
  return NextResponse.json({ images })
}

// ドヤパワー（旗 DOYA_POWER_ROLLOUT の内側だけ）: 生成の前に減らし、失敗なら戻す。off のときは今までどおり（src/lib/doya-power/charge.ts）
// 参照画像（最大4MB の PNG を base64 にしたもの）が入るよう、課金のための読み込みの上限を 6MB にする（既定の 64KB だと 413 になる）。大きさの確かめは postHandler が続けて行う
export const POST = withDoyaPowerCharge({ action: 'tenjikai.image', bodyMaxBytes: 6 * 1024 * 1024, invalid: (b) => (readCount(b?.count) === null ? COUNT_ERROR : null), units: (b) => readCount(b?.count) ?? 1 }, postHandler)
