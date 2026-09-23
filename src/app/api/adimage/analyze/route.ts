export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/adimage/analyze — サービスURLからブランド情報とコピー候補を作る
// ⚠️ 画像生成の前にコピーを確定させる。全アスペクトで同一コピーを使い、一貫性を保つ。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureGuestId, getIdentity, GUEST_COOKIE, ownerWhere, requireUser } from '@/lib/adimage/access'
import { analyzeBrand, BrandSourceError } from '@/lib/adimage/brand'
import { findRiskyExpressions, generateConcepts } from '@/lib/adimage/copy'
import type { BrandProfile } from '@/lib/adimage/types'
import { claimAnalysisBudget, finishAnalysisBudget } from '@/lib/adimage/analysis-budget'
import { readOperationalJson, OperationalBodyError } from '@/lib/operational-json'

export async function POST(req: NextRequest) {
  const base = await getIdentity(req)
  // ⚠️ ログイン必須。未ログインは識別子が無く、以降のスコープ条件が成立しない
  const auth = requireUser(base)
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 })
  const { identity, newGuestId } = ensureGuestId(base)
  const where = ownerWhere(identity)
  if (!where) return NextResponse.json({ error: '利用者を識別できませんでした' }, { status: 400 })

  let body: Record<string, unknown>
  try { body = await readOperationalJson(req, 64 * 1024) }
  catch (error) { return NextResponse.json({ error: '入力内容を確認してください。' }, { status: error instanceof OperationalBodyError ? error.status : 400 }) }
  if (typeof body.url !== 'string' || Buffer.byteLength(body.url, 'utf8') > 8192) {
    return NextResponse.json({ error: '有効なサービスのURLを入力してください' }, { status: 400 })
  }
  const rawUrl = body.url.trim()
  if (!rawUrl) return NextResponse.json({ error: 'サービスのURLを入力してください' }, { status: 400 })

  let url: URL
  try {
    url = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`)
  } catch {
    return NextResponse.json({ error: 'URLの形式が正しくありません' }, { status: 400 })
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return NextResponse.json({ error: 'httpsのURLを入力してください' }, { status: 400 })
  }
  if (url.username || url.password) {
    return NextResponse.json({ error: '認証情報を含まない公開URLを入力してください' }, { status: 400 })
  }
  const manualText = typeof body?.manualText === 'string' ? body.manualText.trim() : undefined
  if (body?.manualText !== undefined && (!manualText || manualText.length < 50 || manualText.length > 14000)) {
    return NextResponse.json({ error: 'サービスの説明を50〜14,000文字で入力してください' }, { status: 400 })
  }
  if ((body.appeal !== undefined && typeof body.appeal !== 'string') || (body.objective !== undefined && typeof body.objective !== 'string')) {
    return NextResponse.json({ error: '訴求内容と広告の目的を文章で入力してください' }, { status: 400 })
  }

  const admission = await claimAnalysisBudget(identity)
  if (!admission.ok) return NextResponse.json({ error: admission.reason === 'busy'
    ? '現在の解析が完了してから、もう一度お試しください。'
    : admission.reason === 'limit' ? '本日のブランド解析の上限に達しました。明日またご利用ください。'
    : '現在、解析の利用状況を確認できません。時間をおいてお試しください。'
  }, { status: admission.reason === 'unavailable' ? 503 : 429 })

  let refund = false
  try {

    let brand: BrandProfile
    try {
      brand = await analyzeBrand(url.toString(), manualText)
    } catch (err) {
      if (err instanceof BrandSourceError) {
        refund = true // Source rejection occurs before the first AI invocation.
        // Do not log source URLs or the user's private description.
        if (err.status === 503) console.error('[adimage] source temporarily unavailable', err.failure)
        else console.warn('[adimage] source cannot be imported', err.failure)
        return NextResponse.json({ error: err.message, code: 'WEBSITE_UNREADABLE', canUseManualInput: true }, { status: err.status })
      }
      console.error('[adimage] analyze failed')
      return NextResponse.json({ error: 'ブランド情報の解析に失敗しました。時間をおいて再度お試しください。' }, { status: 502 })
    }

    let concepts
    try {
      concepts = await generateConcepts({
        brand,
        appeal: typeof body.appeal === 'string' ? body.appeal.slice(0, 500) : undefined,
        objective: typeof body.objective === 'string' ? body.objective.slice(0, 100) : undefined,
      })
    } catch (err) {
      console.error('[adimage] concepts failed')
      return NextResponse.json({ error: 'コピーの生成に失敗しました。時間をおいて再度お試しください。' }, { status: 502 })
    }
    if (concepts.length === 0) {
      return NextResponse.json({ error: 'コピーを生成できませんでした。URLを変えてお試しください。' }, { status: 502 })
    }

    const saved = await prisma.adImageBrand.create({
      data: {
        ...where,
        name: brand.name,
        sourceUrl: url.toString(),
        description: brand.description ?? null,
        valueProps: brand.valueProps as any,
        colors: brand.colors as any,
        industry: brand.industry ?? null,
        tone: brand.tone ?? null,
      },
      select: { id: true },
    })

    const res = NextResponse.json({
      brandId: saved.id,
      brand,
      concepts: concepts.map((c) => ({
        ...c,
        // 誇大表現の疑いは画面に出して人に判断させる。黙って直さない
        warnings: findRiskyExpressions(c.copy),
      })),
    })
    if (newGuestId) {
      res.cookies.set(GUEST_COOKIE, newGuestId, {
        httpOnly: true, sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/', maxAge: 60 * 60 * 24 * 180,
      })
    }
    return res
  } finally {
    await finishAnalysisBudget(admission.lease, refund)
  }
}
