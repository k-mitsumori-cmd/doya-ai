export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getOrCreateOrganization } from '@/lib/aio/access'
import { suggestBrandSetup } from '@/lib/aio/suggest'

// POST /api/aio/quick-start — 「サービスURL＋サービス名」だけで開始する入口。
// 組織作成を意識させず、裏でワークスペース＋ブランド設定＋AI生成の監視プロンプトを用意し、
// 返した slug のダッシュボードへ遷移してそのままスキャンできる状態にする。
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    let userId = (session?.user as any)?.id as string | undefined
    if (!userId && session?.user?.email) {
      const u = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
      userId = u?.id
    }
    if (!userId) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const brandName = (body.brandName as string)?.trim()
    const url = (body.url as string)?.trim() || null
    if (!brandName) return NextResponse.json({ error: 'サービス名は必須です' }, { status: 400 })

    // 1) ワークスペースを用意（冪等：既存があれば再利用。ユーザーには組織作成を見せない）
    const memberName = (session?.user?.name as string)?.trim() || 'オーナー'
    const org = await getOrCreateOrganization(userId, brandName.slice(0, 120), memberName.slice(0, 80))

    // 2) AIでカテゴリと監視プロンプトを生成（URL＋名前だけから）
    const setup = await suggestBrandSetup({ brandName, url })

    // 3) ブランドプロフィールを upsert（入力値で初期化。category は推定値）
    await prisma.aioBrandProfile.upsert({
      where: { organizationId: org.id },
      create: { organizationId: org.id, brandName: brandName.slice(0, 120), brandUrl: url, category: setup.category },
      update: { brandName: brandName.slice(0, 120), brandUrl: url, ...(setup.category ? { category: setup.category } : {}) },
    })

    // 4) 監視プロンプトが未登録なら、生成したものを投入（既存があれば尊重して触らない）
    const existing = await prisma.aioPrompt.count({ where: { organizationId: org.id } })
    if (existing === 0 && setup.prompts.length) {
      await prisma.aioPrompt.createMany({
        data: setup.prompts.map((text) => ({ organizationId: org.id, text: text.slice(0, 500), isActive: true })),
      })
    }

    return NextResponse.json({ organizationId: org.id, slug: org.slug })
  } catch (e: any) {
    console.error('[aio/quick-start]', e?.message)
    return NextResponse.json({ error: '開始処理に失敗しました' }, { status: 500 })
  }
}
