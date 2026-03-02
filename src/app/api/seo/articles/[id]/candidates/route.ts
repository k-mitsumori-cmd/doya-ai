import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { getGuestIdFromRequest } from '@/lib/seoAccess'
import { z } from 'zod'

export const runtime = 'nodejs'

const AddCandidateSchema = z.object({
  name: z.string().min(1).max(100),
  websiteUrl: z.string().url().optional(),
  pricing: z.string().max(200).optional(),
  features: z.array(z.string().max(100)).max(10).optional(),
  description: z.string().max(500).optional(),
})

const AddCandidatesBodySchema = z.object({
  candidates: z.array(AddCandidateSchema).min(1).max(20),
  regenerate: z.boolean().optional().default(false),
})

function uniqCandidatesByName(items: any[]): any[] {
  const seen = new Set<string>()
  const out: any[] = []
  for (const it of items) {
    const name = String(it?.name || '').trim()
    const key = name.toLowerCase()
    if (!name) continue
    if (seen.has(key)) continue
    seen.add(key)
    out.push(it)
  }
  return out
}

// GET: 現在の候補一覧を取得
export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    await ensureSeoSchema()
    const id = ctx.params.id
    const session = await getServerSession(authOptions)
    const user: any = session?.user || null
    const userId = String(user?.id || '').trim()
    const guestId = getGuestIdFromRequest(_req)

    const article = await (prisma as any).seoArticle.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        guestId: true,
        mode: true,
        comparisonCandidates: true,
        comparisonConfig: true,
      },
    })

    if (!article) {
      return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
    }

    // 所有者チェック
    const articleUserId = String(article.userId || '').trim()
    const articleGuestId = String(article.guestId || '').trim()
    const canAccess =
      (userId && articleUserId && articleUserId === userId) ||
      (guestId && articleGuestId && articleGuestId === guestId)

    if (!canAccess) {
      return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
    }

    const candidates = Array.isArray(article.comparisonCandidates) ? article.comparisonCandidates : []
    const config = article.comparisonConfig || {}

    return NextResponse.json({
      success: true,
      candidates,
      config,
      count: candidates.length,
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '不明なエラー' }, { status: 500 })
  }
}

// POST: 候補を追加
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    await ensureSeoSchema()
    const id = ctx.params.id
    const session = await getServerSession(authOptions)
    const user: any = session?.user || null
    const userId = String(user?.id || '').trim()
    const guestId = getGuestIdFromRequest(req)

    const article = await (prisma as any).seoArticle.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        guestId: true,
        mode: true,
        comparisonCandidates: true,
        comparisonConfig: true,
      },
    })

    if (!article) {
      return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
    }

    // 所有者チェック
    const articleUserId = String(article.userId || '').trim()
    const articleGuestId = String(article.guestId || '').trim()
    const canAccess =
      (userId && articleUserId && articleUserId === userId) ||
      (guestId && articleGuestId && articleGuestId === guestId)

    if (!canAccess) {
      return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
    }

    const body = AddCandidatesBodySchema.parse(await req.json())
    const existing = Array.isArray(article.comparisonCandidates) ? article.comparisonCandidates : []

    // 新しい候補を追加（重複を除去）
    const newCandidates = body.candidates.map((c) => ({
      name: c.name.trim(),
      websiteUrl: c.websiteUrl || undefined,
      pricing: c.pricing || '要問い合わせ',
      features: c.features || [],
      description: c.description || undefined,
      source: 'manual',
      addedAt: new Date().toISOString(),
    }))

    const merged = uniqCandidatesByName([...existing, ...newCandidates])

    // DBを更新
    await (prisma as any).seoArticle.update({
      where: { id },
      data: {
        comparisonCandidates: merged as any,
        // 比較モードでなければ有効化
        mode: article.mode === 'comparison_research' ? article.mode : 'comparison_research',
      },
    })

    // regenerate=true の場合、新しいジョブを作成して再生成
    let newJobId: string | null = null
    if (body.regenerate) {
      const job = await (prisma as any).seoJob.create({
        data: {
          articleId: id,
          status: 'queued',
          step: 'init',
          progress: 0,
        },
      })
      newJobId = job.id
    }

    return NextResponse.json({
      success: true,
      candidates: merged,
      count: merged.length,
      addedCount: newCandidates.length,
      jobId: newJobId,
    })
  } catch (e: any) {
    if (e?.name === 'ZodError') {
      return NextResponse.json({ success: false, error: '入力形式が正しくありません', details: e.errors }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: e?.message || '不明なエラー' }, { status: 500 })
  }
}

// DELETE: 候補を削除
export async function DELETE(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    await ensureSeoSchema()
    const id = ctx.params.id
    const session = await getServerSession(authOptions)
    const user: any = session?.user || null
    const userId = String(user?.id || '').trim()
    const guestId = getGuestIdFromRequest(req)

    const { candidateName } = await req.json()
    if (!candidateName || typeof candidateName !== 'string') {
      return NextResponse.json({ success: false, error: 'candidateName is required' }, { status: 400 })
    }

    const article = await (prisma as any).seoArticle.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        guestId: true,
        comparisonCandidates: true,
      },
    })

    if (!article) {
      return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
    }

    // 所有者チェック
    const articleUserId = String(article.userId || '').trim()
    const articleGuestId = String(article.guestId || '').trim()
    const canAccess =
      (userId && articleUserId && articleUserId === userId) ||
      (guestId && articleGuestId && articleGuestId === guestId)

    if (!canAccess) {
      return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
    }

    const existing = Array.isArray(article.comparisonCandidates) ? article.comparisonCandidates : []
    const targetKey = candidateName.trim().toLowerCase()
    const filtered = existing.filter((c: any) => String(c?.name || '').trim().toLowerCase() !== targetKey)

    await (prisma as any).seoArticle.update({
      where: { id },
      data: { comparisonCandidates: filtered as any },
    })

    return NextResponse.json({
      success: true,
      candidates: filtered,
      count: filtered.length,
      removedCount: existing.length - filtered.length,
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '不明なエラー' }, { status: 500 })
  }
}

