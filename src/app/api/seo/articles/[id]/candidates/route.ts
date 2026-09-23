import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { getSeoArticleOwner } from '@/lib/seoArticleOwner'
import { z } from 'zod'

export const runtime = 'nodejs'

const AddCandidateSchema = z.object({
  name: z.string().trim().min(1).max(100),
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
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const owner = await getSeoArticleOwner(_req)
    if (!owner) return NextResponse.json({ success: false, error: 'ログインまたはゲスト認証が必要です' }, { status: 401 })
    await ensureSeoSchema()
    const id = (await ctx.params).id

    const article = await (prisma as any).seoArticle.findFirst({
      where: { id, ...owner },
      select: {
        id: true,
        updatedAt: true,
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

    const candidates = Array.isArray(article.comparisonCandidates) ? article.comparisonCandidates : []
    const config = article.comparisonConfig || {}

    return NextResponse.json({
      success: true,
      candidates,
      config,
      count: candidates.length,
    })
  } catch (e: any) {
    if (e?.code === 'P2025') return NextResponse.json({ success: false, error: '記事が更新されたか、アクセス権が変わりました。再読み込みしてから操作してください。' }, { status: 409 })
    if (e?.name === 'SyntaxError' || e?.name === 'ZodError') return NextResponse.json({ success: false, error: '入力形式が正しくありません' }, { status: 400 })
    return NextResponse.json({ success: false, error: e?.message || '不明なエラー' }, { status: 500 })
  }
}

// POST: 候補を追加
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const owner = await getSeoArticleOwner(req)
    if (!owner) return NextResponse.json({ success: false, error: 'ログインまたはゲスト認証が必要です' }, { status: 401 })
    await ensureSeoSchema()
    const id = (await ctx.params).id

    const article = await (prisma as any).seoArticle.findFirst({
      where: { id, ...owner },
      select: {
        id: true,
        updatedAt: true,
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

    const newJobId = await prisma.$transaction(async (tx) => {
      await tx.seoArticle.update({
        where: { id, ...owner, updatedAt: article.updatedAt },
        data: {
          comparisonCandidates: merged as any,
          mode: 'comparison_research',
          updatedAt: new Date(Math.max(Date.now(), new Date(article.updatedAt).getTime() + 1)),
        },
      })
      if (!body.regenerate) return null
      await tx.seoJob.updateMany({
        where: { articleId: id, supersededAt: null },
        data: { supersededAt: new Date(), executionToken: null, executionExpiresAt: null },
      })
      await tx.seoJob.updateMany({
        where: { articleId: id, status: { in: ['queued', 'running', 'paused', 'error'] } },
        data: { status: 'cancelled', executionToken: null, executionExpiresAt: null, finishedAt: new Date(), error: '新しい再生成ジョブに置き換えられました' },
      })
      const job = await tx.seoJob.create({
        data: { articleId: id, status: 'queued', step: 'init', progress: 0 },
      })
      return job.id
    })

    return NextResponse.json({
      success: true,
      candidates: merged,
      count: merged.length,
      addedCount: merged.length - uniqCandidatesByName(existing).length,
      jobId: newJobId,
    })
  } catch (e: any) {
    if (e?.code === 'P2025') return NextResponse.json({ success: false, error: '記事が更新されたか、アクセス権が変わりました。再読み込みしてから操作してください。' }, { status: 409 })
    if (e?.name === 'SyntaxError' || e?.name === 'ZodError') return NextResponse.json({ success: false, error: '入力形式が正しくありません' }, { status: 400 })
    if (e?.name === 'ZodError') {
      return NextResponse.json({ success: false, error: '入力形式が正しくありません', details: e.errors }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: e?.message || '不明なエラー' }, { status: 500 })
  }
}

// DELETE: 候補を削除
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const owner = await getSeoArticleOwner(req)
    if (!owner) return NextResponse.json({ success: false, error: 'ログインまたはゲスト認証が必要です' }, { status: 401 })
    await ensureSeoSchema()
    const id = (await ctx.params).id

    const { candidateName } = z.object({ candidateName: z.string().trim().min(1).max(100) }).parse(await req.json())
    if (!candidateName) {
      return NextResponse.json({ success: false, error: 'candidateName is required' }, { status: 400 })
    }

    const article = await (prisma as any).seoArticle.findFirst({
      where: { id, ...owner },
      select: {
        id: true,
        updatedAt: true,
        userId: true,
        guestId: true,
        comparisonCandidates: true,
      },
    })

    if (!article) {
      return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
    }

    const existing = Array.isArray(article.comparisonCandidates) ? article.comparisonCandidates : []
    const targetKey = candidateName.trim().toLowerCase()
    const filtered = existing.filter((c: any) => String(c?.name || '').trim().toLowerCase() !== targetKey)

    await (prisma as any).seoArticle.update({
      where: { id, ...owner, updatedAt: article.updatedAt },
      data: { comparisonCandidates: filtered as any, updatedAt: new Date(Math.max(Date.now(), new Date(article.updatedAt).getTime() + 1)) },
    })

    return NextResponse.json({
      success: true,
      candidates: filtered,
      count: filtered.length,
      removedCount: existing.length - filtered.length,
    })
  } catch (e: any) {
    if (e?.code === 'P2025') return NextResponse.json({ success: false, error: '記事が更新されたか、アクセス権が変わりました。再読み込みしてから操作してください。' }, { status: 409 })
    if (e?.name === 'SyntaxError' || e?.name === 'ZodError') return NextResponse.json({ success: false, error: '入力形式が正しくありません' }, { status: 400 })
    return NextResponse.json({ success: false, error: e?.message || '不明なエラー' }, { status: 500 })
  }
}

