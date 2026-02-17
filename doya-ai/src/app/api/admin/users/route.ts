import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import Stripe from 'stripe'

// cookies() を使用するため、静的最適化を無効化
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
})

export async function GET(request: NextRequest) {
  try {
    // 管理者認証チェック
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value

    const { valid } = await verifyAdminSession(token || null)
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    // ユーザー一覧を取得（サービス別サブスクリプション情報も含む）
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        plan: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        serviceSubscriptions: {
          select: {
            id: true,
            serviceId: true,
            plan: true,
            dailyUsage: true,
            monthlyUsage: true,
            lastUsageReset: true,
            stripeSubscriptionId: true,
          },
        },
        _count: {
          select: { generations: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Stripe情報を取得（サブスクリプションがあるユーザーのみ）
    const stripeInfoMap: Record<string, any> = {}
    const usersWithStripe = users.filter((u: any) => u.stripeSubscriptionId)
    
    // 並列でStripe情報を取得（パフォーマンス向上）
    await Promise.all(
      usersWithStripe.map(async (user: any) => {
        try {
          const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId)
          stripeInfoMap[user.id] = {
            status: subscription.status,
            currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
            created: new Date(subscription.created * 1000).toISOString(),
            amount: subscription.items.data[0]?.price?.unit_amount || 0,
            interval: subscription.items.data[0]?.price?.recurring?.interval || 'month',
          }
        } catch (e) {
          console.error(`Stripe fetch error for user ${user.id}:`, e)
          stripeInfoMap[user.id] = null
        }
      })
    )

    const formattedUsers = users.map((user: any) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      plan: user.plan,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId: user.stripeSubscriptionId,
      stripeInfo: stripeInfoMap[user.id] || null,
      totalGenerations: user._count.generations,
      // サービス別の情報
      serviceSubscriptions: user.serviceSubscriptions.map((sub: any) => ({
        id: sub.id,
        serviceId: sub.serviceId,
        plan: sub.plan,
        dailyUsage: sub.dailyUsage,
        monthlyUsage: sub.monthlyUsage,
        lastUsageReset: sub.lastUsageReset,
        hasStripe: !!sub.stripeSubscriptionId,
      })),
      // 利用中のサービスID一覧
      services: user.serviceSubscriptions.map((sub: any) => sub.serviceId),
    }))

    return NextResponse.json(formattedUsers)
  } catch (error) {
    console.error('Admin users error:', error)
    return NextResponse.json(
      { error: 'ユーザー一覧の取得に失敗しました' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    // 管理者認証チェック
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value

    const { valid } = await verifyAdminSession(token || null)
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    const body = await req.json()
    const { userId, plan, role, serviceId, servicePlan, resetDailyUsage, resetMonthlyUsage, setDailyUsage, setMonthlyUsage } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // ユーザー基本情報の更新（プランはユーザーテーブルと両サービスに同時適用）
    if (plan !== undefined || role !== undefined) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          ...(plan !== undefined && { plan }),
          ...(role !== undefined && { role }),
        },
      })
      
      // プランが変更された場合、両サービスのサブスクリプションも同じプランに更新
      if (plan !== undefined) {
        const serviceIds = ['banner', 'writing']
        for (const svcId of serviceIds) {
          const existing = await prisma.userServiceSubscription.findUnique({
            where: { userId_serviceId: { userId, serviceId: svcId } },
          })
          
          if (existing) {
            await prisma.userServiceSubscription.update({
              where: { id: existing.id },
              data: { plan },
            })
          } else {
            // サブスクリプションが存在しない場合は作成
            await prisma.userServiceSubscription.create({
              data: {
                userId,
                serviceId: svcId,
                plan,
                dailyUsage: 0,
                monthlyUsage: 0,
              },
            })
          }
        }
      }
    }

    // サービス別プラン・使用回数の更新（個別サービスの設定用）
    if (serviceId) {
      const existing = await prisma.userServiceSubscription.findUnique({
        where: { userId_serviceId: { userId, serviceId } },
      })

      const updateData: any = {}
      if (servicePlan !== undefined) updateData.plan = servicePlan
      if (resetDailyUsage) updateData.dailyUsage = 0
      if (resetMonthlyUsage) updateData.monthlyUsage = 0
      if (typeof setDailyUsage === 'number') updateData.dailyUsage = setDailyUsage
      if (typeof setMonthlyUsage === 'number') updateData.monthlyUsage = setMonthlyUsage
      if (resetDailyUsage || resetMonthlyUsage) updateData.lastUsageReset = new Date()

      if (existing) {
        await prisma.userServiceSubscription.update({
          where: { id: existing.id },
          data: updateData,
        })
      } else if (servicePlan) {
        // 存在しない場合は作成
        await prisma.userServiceSubscription.create({
          data: {
            userId,
            serviceId,
            plan: servicePlan,
            dailyUsage: 0,
            monthlyUsage: 0,
          },
        })
      }
    }

    // 更新後のユーザー情報を返す
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        role: true,
        serviceSubscriptions: {
          select: {
            serviceId: true,
            plan: true,
            dailyUsage: true,
            monthlyUsage: true,
          },
        },
      },
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Admin user update error:', error)
    return NextResponse.json(
      { error: 'ユーザーの更新に失敗しました' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // 管理者認証チェック
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value

    const { valid } = await verifyAdminSession(token || null)
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // ユーザーの存在確認
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
    }

    // Stripeサブスクリプションがあればキャンセル
    if (user.stripeSubscriptionId) {
      try {
        await stripe.subscriptions.cancel(user.stripeSubscriptionId)
      } catch (e) {
        console.error('Stripe subscription cancel error:', e)
        // Stripeエラーでも削除は続行
      }
    }

    // 関連データを削除（カスケード削除されない場合）
    // サービスサブスクリプション
    await prisma.userServiceSubscription.deleteMany({
      where: { userId },
    })

    // 生成履歴
    await prisma.generation.deleteMany({
      where: { userId },
    })

    // セッション
    await prisma.session.deleteMany({
      where: { userId },
    })

    // アカウント（OAuth連携）
    await prisma.account.deleteMany({
      where: { userId },
    })

    // ユーザー本体を削除
    await prisma.user.delete({
      where: { id: userId },
    })

    return NextResponse.json({ 
      success: true, 
      message: `ユーザー ${user.email || userId} を削除しました` 
    })
  } catch (error) {
    console.error('Admin user delete error:', error)
    return NextResponse.json(
      { error: 'ユーザーの削除に失敗しました' },
      { status: 500 }
    )
  }
}
