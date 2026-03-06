// ============================================
// POST /api/copy/generate-search
// ============================================
// 検索広告RSAコピーを生成

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateSearchCopies } from '@/lib/copy/gemini'
import {
  COPY_PRICING,
  getCopyMonthlyLimitByUserPlan,
  shouldResetMonthlyUsage,
  isWithinFreeHour,
  isCopyProPlan,
} from '@/lib/pricing'
import type { ProductInfo, PersonaData } from '@/lib/copy/gemini'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id

    const { projectId, productInfo, persona, platform, keywords } = await req.json() as {
      projectId: string
      productInfo: ProductInfo
      persona: PersonaData
      platform: 'google' | 'yahoo'
      keywords: string[]
    }

    if (!projectId || !productInfo || !persona) {
      return NextResponse.json({ error: 'projectId、productInfo、personaは必須です' }, { status: 400 })
    }

    // ===== 検索広告はProプラン以上限定 =====
    if (userId) {
      const planUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true },
      })
      if (!isCopyProPlan(planUser?.plan)) {
        return NextResponse.json(
          { error: '検索広告生成はProプラン以上で利用可能です', upgradePath: '/copy/pricing' },
          { status: 403 }
        )
      }
    } else {
      // ゲスト（未ログイン）は利用不可
      return NextResponse.json(
        { error: '検索広告生成はProプラン以上で利用可能です', upgradePath: '/copy/pricing' },
        { status: 403 }
      )
    }

    // ===== 使用制限チェック =====
    let monthlyLimit = COPY_PRICING.guestLimit
    let usedThisMonth = 0
    let isUnlimited = false

    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true, firstLoginAt: true },
      })

      if (user) {
        if (isWithinFreeHour(user.firstLoginAt)) isUnlimited = true

        monthlyLimit = getCopyMonthlyLimitByUserPlan(user.plan)
        if (monthlyLimit < 0) isUnlimited = true

        if (!isUnlimited) {
          let sub = await prisma.userServiceSubscription.findUnique({
            where: { userId_serviceId: { userId, serviceId: 'copy' } },
          })

          if (!sub) {
            sub = await prisma.userServiceSubscription.create({
              data: { userId, serviceId: 'copy', plan: user.plan || 'FREE' },
            })
          }

          if (shouldResetMonthlyUsage(sub.lastUsageReset)) {
            await prisma.userServiceSubscription.update({
              where: { id: sub.id },
              data: { monthlyUsage: 0, lastUsageReset: new Date() },
            })
            usedThisMonth = 0
          } else {
            usedThisMonth = sub.monthlyUsage || 0
          }
        }
      }
    } else {
      // ゲスト: guestIdベースでCopyProjectをカウントし月次制限を適用
      monthlyLimit = COPY_PRICING.guestLimit
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const proj = await prisma.copyProject.findUnique({
        where: { id: projectId },
        select: { guestId: true },
      })
      if (proj?.guestId) {
        usedThisMonth = await prisma.copyProject.count({
          where: {
            guestId: proj.guestId,
            createdAt: { gte: monthStart },
          },
        })
      }
    }

    if (!isUnlimited && usedThisMonth >= monthlyLimit) {
      return NextResponse.json(
        {
          error: userId
            ? `今月の生成上限（${monthlyLimit}回）に達しました`
            : `ゲストの月間生成上限（${monthlyLimit}回）に達しました。ログインするとより多く利用できます。`,
          limitReached: true,
          usedThisMonth,
          monthlyLimit,
        },
        { status: 429 }
      )
    }

    const effectiveKeywords = keywords?.length ? keywords : (persona.keywords?.length ? persona.keywords : null)
    if (!effectiveKeywords?.length) {
      return NextResponse.json({ error: '検索キーワードが必要です（keywordsかペルソナのkeywordsを指定してください）' }, { status: 400 })
    }

    const project = await prisma.copyProject.findUnique({
      where: { id: projectId },
      select: { userId: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
    }

    if (project.userId && project.userId !== userId) {
      return NextResponse.json({ error: 'アクセス権限がありません' }, { status: 403 })
    }

    const searchCopy = await generateSearchCopies(
      productInfo,
      persona,
      platform || 'google',
      effectiveKeywords,
    )

    // DBに保存
    const saved = await prisma.copyItem.create({
      data: {
        projectId,
        type: 'search',
        platform: platform || 'google',
        writerType: 'rsa',
        headline: searchCopy.headlines[0] || '',
        description: searchCopy.descriptions[0] || '',
        catchcopy: searchCopy.displayPath.join('/'),
        cta: '',
        appealAxis: 'RSA',
        hashtags: [],
      },
    })

    // 使用回数インクリメント
    if (userId) {
      await prisma.userServiceSubscription.update({
        where: { userId_serviceId: { userId, serviceId: 'copy' } },
        data: { monthlyUsage: { increment: 1 } },
      }).catch(() => {}) // サブスクリプションが存在しない場合は無視
    }

    return NextResponse.json({ success: true, copy: saved, searchCopy })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Copy generate-search error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
