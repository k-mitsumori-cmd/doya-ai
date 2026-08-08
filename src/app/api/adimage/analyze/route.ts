export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/adimage/analyze — サービスURLからブランド情報とコピー候補を作る
// ⚠️ 画像生成の前にコピーを確定させる。全アスペクトで同一コピーを使い、一貫性を保つ。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureGuestId, getIdentity, GUEST_COOKIE, ownerWhere } from '@/lib/adimage/access'
import { analyzeBrand } from '@/lib/adimage/brand'
import { findRiskyExpressions, generateConcepts } from '@/lib/adimage/copy'
import type { BrandProfile } from '@/lib/adimage/types'

export async function POST(req: NextRequest) {
  const base = await getIdentity(req)
  const { identity, newGuestId } = ensureGuestId(base)
  const where = ownerWhere(identity)
  if (!where) return NextResponse.json({ error: '利用者を識別できませんでした' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const rawUrl = String(body?.url || '').trim()
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

  let brand: BrandProfile
  try {
    brand = await analyzeBrand(url.toString())
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'サイトの解析に失敗しました'
    console.error('[adimage] analyze failed', msg)
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  let concepts
  try {
    concepts = await generateConcepts({
      brand,
      appeal: body?.appeal ? String(body.appeal).slice(0, 500) : undefined,
      objective: body?.objective ? String(body.objective).slice(0, 100) : undefined,
    })
  } catch (err) {
    console.error('[adimage] concepts failed', err instanceof Error ? err.message : err)
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
}
