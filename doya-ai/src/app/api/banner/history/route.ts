import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BANNER_PRICING } from '@/lib/pricing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseIntParam(v: string | null, fallback: number) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.floor(n) : fallback
}

type HistoryBatch = {
  id: string
  category: string
  keyword: string
  size: string
  purpose: string
  createdAt: string
  banners: string[]
}

// ユーザーが有料プランかどうかを判定（DB優先。セッションにもフォールバック）
async function isProUserByDb(userId: string): Promise<boolean> {
  const sub = await prisma.userServiceSubscription.findUnique({
    where: { userId_serviceId: { userId, serviceId: 'banner' } },
    select: { plan: true },
  })
  const plan = (sub?.plan || 'FREE').toUpperCase()
  return plan !== 'FREE'
}

function isProFromSession(session: any): boolean {
  const bannerPlan = String(session?.user?.bannerPlan || '').toUpperCase()
  const globalPlan = String(session?.user?.plan || '').toUpperCase()
  // bannerPlan があればそれを優先。無ければ global plan を見る
  if (bannerPlan) return bannerPlan !== 'FREE'
  return globalPlan && globalPlan !== 'FREE'
}

// クリーンアップ頻度を抑えてレスポンスを軽くする（サーバレスでも一定効果）
const lastCleanupAtByUser = new Map<string, number>()
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6時間

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    // 有料プラン判定
    const isPro = isProFromSession(session) || (await isProUserByDb(userId))
    const historyDays = isPro ? BANNER_PRICING.historyDays.pro : BANNER_PRICING.historyDays.free

    // 無料ユーザーは履歴閲覧不可
    if (historyDays === 0) {
      return NextResponse.json({
        items: [],
        message: '履歴機能は有料プラン限定です。プランをアップグレードしてください。',
        requiresUpgrade: true,
      })
    }

    // 6ヶ月以上前のデータを自動削除（有料ユーザーでも180日を超えた履歴は削除）
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - historyDays)
    
    // バックグラウンドで古いデータを削除（非同期・エラーでも続行）
    const now = Date.now()
    const last = lastCleanupAtByUser.get(userId) || 0
    if (now - last > CLEANUP_INTERVAL_MS) {
      lastCleanupAtByUser.set(userId, now)
      prisma.generation
        .deleteMany({
          where: {
            userId,
            serviceId: 'banner',
            outputType: 'IMAGE',
            createdAt: { lt: cutoffDate },
          },
        })
        .catch((e) => console.error('[banner history] cleanup failed:', e))
    }

    const { searchParams } = new URL(request.url)
    const takeRaw = parseIntParam(searchParams.get('take'), 20)
    const takeBatches = Math.min(Math.max(takeRaw, 1), 50)
    const takeRows = takeBatches * 12 // 1バッチ最大10枚を想定し余裕を持たせる

    const rows = await prisma.generation.findMany({
      where: {
        userId,
        serviceId: 'banner',
        outputType: 'IMAGE',
        createdAt: { gte: cutoffDate }, // 保存期間内のみ取得
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: takeRows,
    })

    const byBatch = new Map<string, HistoryBatch & { _createdAtMs: number }>()

    for (const r of rows) {
      const meta: any = r.metadata || {}
      const input: any = r.input || {}
      const batchId = typeof meta?.batchId === 'string' ? meta.batchId : ''
      const createdAtIso = r.createdAt.toISOString()
      const key =
        batchId ||
        // 古いデータの救済：近い作成時刻＋入力でまとめる
        `${createdAtIso.slice(0, 16)}|${String(input?.keyword || meta?.keyword || '')}|${String(input?.size || meta?.size || '')}`

      const createdAtMs = r.createdAt.getTime()
      const cur = byBatch.get(key)
      if (!cur) {
        byBatch.set(key, {
          id: batchId || key,
          category: String(input?.category || meta?.category || ''),
          keyword: String(input?.keyword || meta?.keyword || ''),
          size: String(input?.size || meta?.size || ''),
          purpose: String(input?.purpose || meta?.purpose || ''),
          createdAt: createdAtIso,
          banners: typeof r.output === 'string' ? [r.output] : [],
          _createdAtMs: createdAtMs,
        })
      } else {
        if (typeof r.output === 'string') cur.banners.push(r.output)
        if (createdAtMs > cur._createdAtMs) {
          cur._createdAtMs = createdAtMs
          cur.createdAt = createdAtIso
        }
      }
    }

    const items = Array.from(byBatch.values())
      .sort((a, b) => b._createdAtMs - a._createdAtMs)
      .slice(0, takeBatches)
      .map(({ _createdAtMs, ...x }) => x)

    return NextResponse.json({ items })
  } catch (e: any) {
    console.error('[banner history] failed', e)
    return NextResponse.json({ error: '履歴の取得に失敗しました' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const batchId = searchParams.get('batchId') || ''
    if (!batchId) return NextResponse.json({ error: 'batchId is required' }, { status: 400 })

    // metadata.batchId が一致するものを削除（自分の分だけ）
    await prisma.generation.deleteMany({
      where: {
        userId,
        serviceId: 'banner',
        outputType: 'IMAGE',
        metadata: { path: ['batchId'], equals: batchId },
      },
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[banner history] delete failed', e)
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
}


