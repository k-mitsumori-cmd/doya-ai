export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { IMAGE_MODELS, RATIOS, estimateCost, type ImageGenRequest } from '@/lib/tenjikai/imagegen'

const MAX_COUNT = 4
const MAX_PROMPT_CHARS = 4000
const MAX_REFERENCE_BYTES = 4 * 1024 * 1024
const PER_CLIENT_PER_HOUR = 10

// 画面から送られる expectedCostYen は利用者への確認表示にすぎず、課金の防御にはならない。
// そのためサーバー側で1日の上限額と送信元ごとの回数制限をかける（プロトタイプ用にプロセス内で保持）。
// ログイン必須（getServerSession）。正式公開までに、利用者のプランと
// TenjikaiGenerationJob に記録した当日の使用額で上限を判定する形に置き換える。
const usage = { day: '', spentYen: 0 }
const hits = new Map<string, number[]>()

function dailyLimitYen() {
  const n = Number(process.env.TENJIKAI_IMAGEGEN_DAILY_LIMIT_YEN ?? 500)
  return Number.isFinite(n) && n > 0 ? n : 500
}


// 従量課金API。以下の4つがそろったときだけ実行する。
// 1. TENJIKAI_IMAGEGEN_ENABLED=true（明示的に有効化。本番では未設定のまま＝無効）
// 2. ログインしている
// 3. GEMINI_API_KEY が設定されている
// 4. リクエストに approved: true と、サーバー側の見積と一致する expectedCostYen がある
export async function POST(req: NextRequest) {
  if (process.env.TENJIKAI_IMAGEGEN_ENABLED !== 'true') {
    return NextResponse.json({ error: '画像生成は無効です。TENJIKAI_IMAGEGEN_ENABLED=true を設定すると有効になります。' }, { status: 403 })
  }
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 })
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY が設定されていません。' }, { status: 500 })

  let body: ImageGenRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'リクエストの形式が正しくありません。' }, { status: 400 })
  }

  if (typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > MAX_PROMPT_CHARS) {
    return NextResponse.json({ error: `プロンプトは1〜${MAX_PROMPT_CHARS}文字で指定してください。` }, { status: 400 })
  }
  if (!(RATIOS as readonly string[]).includes(body.aspectRatio)) return NextResponse.json({ error: '対応していないアスペクト比です。' }, { status: 400 })
  if (body.referencePng !== undefined && (typeof body.referencePng !== 'string' || body.referencePng.length * 0.75 > MAX_REFERENCE_BYTES || !/^[A-Za-z0-9+/=]+$/.test(body.referencePng))) {
    return NextResponse.json({ error: '参照画像は4MB以下のPNGにしてください。' }, { status: 400 })
  }
  if (body.approved !== true) return NextResponse.json({ error: '見込み額の承認がありません。' }, { status: 400 })
  if (!IMAGE_MODELS.some((m) => m.id === body.model)) return NextResponse.json({ error: '対応していないモデルです。' }, { status: 400 })
  if (!['1K', '2K', '4K'].includes(body.size)) return NextResponse.json({ error: '解像度は 1K / 2K / 4K から指定してください。' }, { status: 400 })
  const count = Math.min(Math.max(1, Math.floor(body.count || 1)), MAX_COUNT)
  const est = estimateCost(body.model, body.size, count)
  if (est.totalYen !== body.expectedCostYen) {
    return NextResponse.json({ error: `見込み額が一致しません（サーバー計算 ¥${est.totalYen}）。画面を更新して再度承認してください。` }, { status: 409 })
  }

  const now = Date.now()
  const key = userId
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 3600_000)
  if (recent.length >= PER_CLIENT_PER_HOUR) return NextResponse.json({ error: '1時間あたりの生成回数の上限に達しました。' }, { status: 429 })
  const today = new Date(now).toISOString().slice(0, 10)
  if (usage.day !== today) {
    usage.day = today
    usage.spentYen = 0
  }
  if (usage.spentYen + est.totalYen > dailyLimitYen()) {
    return NextResponse.json({ error: `本日の画像生成の上限（¥${dailyLimitYen()}）を超えるため実行しません。` }, { status: 429 })
  }
  hits.set(key, [...recent, now])
  usage.spentYen += est.totalYen

  const parts: unknown[] = [{ text: body.prompt }]
  if (body.referencePng) parts.push({ inline_data: { mime_type: 'image/png', data: body.referencePng } })

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${body.model}:generateContent`
  const images: string[] = []
  for (let i = 0; i < count; i++) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseModalities: ['IMAGE'],
          imageConfig: body.model.includes('pro') ? { aspectRatio: body.aspectRatio, imageSize: body.size } : { aspectRatio: body.aspectRatio },
        },
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `画像生成に失敗しました（${res.status}）`, detail: text.slice(0, 500), images }, { status: 502 })
    }
    const json = await res.json()
    const found = json?.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData?.data || p?.inline_data?.data)
    const data = found?.inlineData?.data ?? found?.inline_data?.data
    const mime = found?.inlineData?.mimeType ?? found?.inline_data?.mime_type ?? 'image/png'
    if (data) images.push(`data:${mime};base64,${data}`)
  }

  // 本番では Supabase Storage に保存し、TenjikaiCreative.imageUrl と TenjikaiGenerationJob を更新する
  return NextResponse.json({ images, costYen: est.totalYen, model: body.model, size: body.size })
}
