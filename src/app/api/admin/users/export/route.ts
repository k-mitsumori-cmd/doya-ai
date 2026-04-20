import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSession, COOKIE_NAME } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    // 管理者認証チェック
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value

    const { valid } = await verifyAdminSession(token || null)
    if (!valid) {
      return NextResponse.json({ error: '管理者認証が必要です' }, { status: 401 })
    }

    // クエリパラメータ
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'csv'
    const includeStripe = searchParams.get('includeStripe') === 'true'

    // ユーザーデータを取得
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        stripeCustomerId: includeStripe,
        stripeSubscriptionId: includeStripe,
        stripeCurrentPeriodEnd: includeStripe,
        serviceSubscriptions: {
          select: {
            serviceId: true,
            plan: true,
            dailyUsage: true,
            monthlyUsage: true,
          },
        },
        _count: {
          select: { generations: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (format === 'json') {
      // JSON形式でエクスポート
      const jsonData = users.map((user: any) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        role: user.role,
        totalGenerations: user._count.generations,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        ...(includeStripe && {
          stripeCustomerId: user.stripeCustomerId,
          stripeSubscriptionId: user.stripeSubscriptionId,
          stripeCurrentPeriodEnd: user.stripeCurrentPeriodEnd?.toISOString(),
        }),
        services: user.serviceSubscriptions.map((sub: any) => ({
          serviceId: sub.serviceId,
          plan: sub.plan,
          dailyUsage: sub.dailyUsage,
          monthlyUsage: sub.monthlyUsage,
        })),
      }))

      return new NextResponse(JSON.stringify(jsonData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="users_${new Date().toISOString().split('T')[0]}.json"`,
        },
      })
    }

    // CSV形式でエクスポート
    const headers = [
      'ID',
      'ユーザー名',
      'メールアドレス',
      'プラン',
      'ロール',
      '総生成数',
      'バナーAIプラン',
      'バナーAI今日の使用数',
      '登録日',
      '更新日',
      ...(includeStripe ? ['Stripe顧客ID', 'Stripeサブスクリプション終了日'] : []),
    ]

    const rows = users.map((user: any) => {
      const bannerSub = user.serviceSubscriptions.find((s: any) => s.serviceId === 'banner')
      
      const row = [
        user.id,
        user.name || '',
        user.email || '',
        user.plan,
        user.role,
        user._count.generations,
        bannerSub?.plan || 'FREE',
        bannerSub?.dailyUsage || 0,
        user.createdAt.toISOString().split('T')[0],
        user.updatedAt.toISOString().split('T')[0],
      ]

      if (includeStripe) {
        row.push(
          user.stripeCustomerId || '',
          user.stripeCurrentPeriodEnd?.toISOString().split('T')[0] || ''
        )
      }

      return row
    })

    // BOMを追加してExcelで文字化けを防ぐ
    const BOM = '\uFEFF'
    const csvContent = BOM + [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        // カンマや改行を含む場合はダブルクォートで囲む
        const cellStr = String(cell)
        if (cellStr.includes(',') || cellStr.includes('\n') || cellStr.includes('"')) {
          return `"${cellStr.replace(/"/g, '""')}"`
        }
        return cellStr
      }).join(','))
    ].join('\n')

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="users_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (error) {
    console.error('Export users error:', error)
    return NextResponse.json({ error: 'エクスポートに失敗しました' }, { status: 500 })
  }
}





