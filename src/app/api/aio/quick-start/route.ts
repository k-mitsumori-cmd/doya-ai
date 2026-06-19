export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAioOrganization } from '@/lib/aio/access'
import { suggestBrandSetup, deriveBrandFromUrl, normalizeUrl } from '@/lib/aio/suggest'

// 同一サイト判定用にホスト名を正規化（www除去・小文字）。失敗時は空文字。
function hostnameOf(u: string): string {
  try {
    return new URL(u).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

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
    const host = hostnameOf(url)

    // 1) 同じサイト(ホスト名)の既存ワークスペースがあれば再利用＝定点観測の継続。
    //    末尾スラッシュ/パス/http差で別物にならないようホスト名で照合する。
    const memberships = await prisma.aioMember.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { organization: { include: { profile: { select: { brandUrl: true } } } } },
      orderBy: { createdAt: 'desc' },
    })
    const matched = memberships.find((m) => {
      const bu = m.organization.profile?.brandUrl
      return !!bu && hostnameOf(bu) === host
    })?.organization

    // 既存サイトの再観測なら、外部fetch/AI生成をやり直さず即返す（再スキャンは ?scan=1 で実行・高速）
    if (matched) {
      return NextResponse.json({ organizationId: matched.id, slug: matched.slug })
    }

    // 2) 新規: URLからサービス名を自動導出（サイトタイトル→AI整形、失敗時はドメイン名）
    const derived = await deriveBrandFromUrl(url)
    const brandName = derived.brandName
    const memberName = (session?.user?.name as string)?.trim() || 'オーナー'
    const org = await createAioOrganization(userId, brandName.slice(0, 120), memberName.slice(0, 80))

    // 3) AIでカテゴリ・別名・競合・監視プロンプトを生成
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
