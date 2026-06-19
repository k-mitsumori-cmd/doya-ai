export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAioOrganization } from '@/lib/aio/access'
import { suggestBrandSetup, deriveBrandFromUrl, normalizeUrl } from '@/lib/aio/suggest'

// POST /api/aio/quick-start — 「サービスURL」だけで開始する入口（サービス名はURLから自動導出）。
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
    const url = normalizeUrl((body.url as string) || '')
    if (!url) return NextResponse.json({ error: '有効なURLを入力してください' }, { status: 400 })

    // 1) URLからサービス名を自動導出（サイトタイトル→AI整形、失敗時はドメイン名）。ユーザーは名前入力不要。
    const derived = await deriveBrandFromUrl(url)
    const brandName = derived.brandName
    const memberName = (session?.user?.name as string)?.trim() || 'オーナー'

    // 2) 同じURLの既存ワークスペースがあれば再利用（＝定点観測の継続）。無ければURLごとに新規作成。
    //    こうして1ワークスペース=1URL=独立した時系列を保ち、別URL投入で過去結果を汚染しない。
    const memberships = await prisma.aioMember.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { organization: { include: { profile: { select: { brandUrl: true } } } } },
      orderBy: { createdAt: 'desc' },
    })
    const matched = memberships.find((m) => (m.organization.profile?.brandUrl || '') === url)?.organization
    const org = matched ?? (await createAioOrganization(userId, brandName.slice(0, 120), memberName.slice(0, 80)))

    // 3) AIでカテゴリと監視プロンプトを生成（URL＋導出名から）
    const setup = await suggestBrandSetup({ brandName, url })

    // 4) ブランドプロフィールを upsert（入力URLで初期化。category は推定値）
    const aliasesData = setup.aliases.length ? (setup.aliases as any) : undefined
    const competitorsData = setup.competitors.length ? (setup.competitors as any) : undefined
    await prisma.aioBrandProfile.upsert({
      where: { organizationId: org.id },
      create: { organizationId: org.id, brandName: brandName.slice(0, 120), brandUrl: url, category: setup.category, aliases: aliasesData, competitors: competitorsData },
      update: { brandName: brandName.slice(0, 120), brandUrl: url, ...(setup.category ? { category: setup.category } : {}), ...(aliasesData ? { aliases: aliasesData } : {}), ...(competitorsData ? { competitors: competitorsData } : {}) },
    })

    // 5) 監視プロンプトが未登録なら投入（同URL再実行では既存を尊重し履歴を保つ）
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
