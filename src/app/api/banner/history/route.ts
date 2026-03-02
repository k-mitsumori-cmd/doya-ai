import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BANNER_PRICING, isWithinFreeHour } from '@/lib/pricing'
import sharp from 'sharp'

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
  bannerCount: number
  // 一覧表示用（最初の数枚だけ）: 画像は別APIでバイナリ配信
  previewThumbs?: string[]
  previewIds?: string[]
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
  return !!(globalPlan && globalPlan !== 'FREE')
}

// クリーンアップ頻度を抑えてレスポンスを軽くする（サーバレスでも一定効果）
const lastCleanupAtByUser = new Map<string, number>()
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6時間

async function toJpegThumbDataUrl(output: unknown): Promise<string | null> {
  const s = typeof output === 'string' ? output : ''
  if (!s) return null
  if (!s.startsWith('data:image/')) return s // URL等はそのまま
  const comma = s.indexOf(',')
  if (comma === -1) return null
  const b64 = s.slice(comma + 1)
  try {
    const input = Buffer.from(b64, 'base64')
    const buf = await sharp(input)
      .resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 35, mozjpeg: true })
      .toBuffer()
    return `data:image/jpeg;base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const batchIdParam = searchParams.get('batchId') || ''
    const includeImages = (searchParams.get('images') || '1') !== '0'
    const thumbMode = (searchParams.get('thumb') || '0') === '1'

    // 有料プラン判定（1時間生成し放題中も有料扱い）
    const firstLoginAt = (session?.user as any)?.firstLoginAt
    const isFreeHourActive = isWithinFreeHour(firstLoginAt)
    const isPro = isFreeHourActive || isProFromSession(session) || (await isProUserByDb(userId))
    const historyDays = isPro ? BANNER_PRICING.historyDays.pro : BANNER_PRICING.historyDays.free

    // 無料ユーザーは履歴閲覧不可（ただし1時間生成し放題中は解放）
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

    // 単一バッチの画像だけ返す（履歴一覧を軽くするため）
    if (batchIdParam) {
      // まず metadata.batchId で探す（基本ケース）
      const rowsByBatch = await prisma.generation.findMany({
        where: {
          userId,
          serviceId: 'banner',
          outputType: 'IMAGE',
          createdAt: { gte: cutoffDate },
          metadata: { path: ['batchId'], equals: batchIdParam },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 12,
        select: { id: true, output: true, createdAt: true, input: true, metadata: true },
      })

      // 古いデータ救済：fallback key（YYYY-MM-DDTHH:MM|keyword|size）でも探す
      let rows = rowsByBatch
      if (rows.length === 0 && batchIdParam.includes('|')) {
        const [tsPart, kwPart, sizePart] = batchIdParam.split('|')
        if (tsPart && kwPart !== undefined && sizePart !== undefined) {
          const start = new Date(`${tsPart}:00.000Z`)
          const end = new Date(`${tsPart}:59.999Z`)
          rows = await prisma.generation.findMany({
            where: {
              userId,
              serviceId: 'banner',
              outputType: 'IMAGE',
              createdAt: { gte: start, lte: end },
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 12,
            select: { id: true, output: true, createdAt: true, input: true, metadata: true },
          })
            // keyword/size が一致するものだけ残す
            .then((rs) =>
              rs.filter((r) => {
                const meta: any = r.metadata || {}
                const input: any = r.input || {}
                const kw = String(input?.keyword || meta?.keyword || '')
                const sz = String(input?.size || meta?.size || '')
                return kw === kwPart && sz === sizePart
              })
            )
        }
      }

      // 返却は「サムネURL」にしてJSONを軽くする（画像は別APIでバイナリ配信）
      const bannerIds = rows.map((r) => r.id)
      const thumbs = bannerIds.map((id) => `/api/banner/history/thumb?id=${encodeURIComponent(id)}`)

      return NextResponse.json({
        id: batchIdParam,
        // 互換: banners は “表示用サムネURL” を返す
        banners: thumbs,
        bannerIds,
        bannerCount: rows.length,
      }, {
        headers: {
          // 履歴はユーザー固有なので private キャッシュのみ
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        }
      })
    }

    const takeRaw = parseIntParam(searchParams.get('take'), 20)
    const takeBatches = Math.min(Math.max(takeRaw, 1), 50)
    const takeRows = takeBatches * 12 // 1バッチ最大10枚を想定し余裕を持たせる

    // images=0 の場合は output を取らず、レスポンスを極力軽くする
    const rows = await prisma.generation.findMany({
      where: {
        userId,
        serviceId: 'banner',
        outputType: 'IMAGE',
        createdAt: { gte: cutoffDate }, // 保存期間内のみ取得
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: takeRows,
      select: includeImages
        ? { id: true, output: true, createdAt: true, input: true, metadata: true }
        : { id: true, createdAt: true, input: true, metadata: true },
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
        const previewIds = [r.id]
        byBatch.set(key, {
          id: batchId || key,
          category: String(input?.category || meta?.category || ''),
          keyword: String(input?.keyword || meta?.keyword || ''),
          size: String(input?.size || meta?.size || ''),
          purpose: String(input?.purpose || meta?.purpose || ''),
          createdAt: createdAtIso,
          banners: includeImages && typeof (r as any).output === 'string' ? [(r as any).output] : [],
          bannerCount: 1,
          previewIds,
          previewThumbs: previewIds.map((id) => `/api/banner/history/thumb?id=${encodeURIComponent(id)}`),
          _createdAtMs: createdAtMs,
        })
      } else {
        cur.bannerCount += 1
        if (includeImages && typeof (r as any).output === 'string') cur.banners.push((r as any).output)
        // 一覧表示用に最初の3枚だけIDを保持（画像はthumb APIで取得）
        const ids = Array.isArray(cur.previewIds) ? cur.previewIds : []
        if (ids.length < 3) {
          ids.push(r.id)
          cur.previewIds = ids
          cur.previewThumbs = ids.map((id) => `/api/banner/history/thumb?id=${encodeURIComponent(id)}`)
        }
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
    const deleted = await prisma.generation.deleteMany({
      where: {
        userId,
        serviceId: 'banner',
        outputType: 'IMAGE',
        metadata: { path: ['batchId'], equals: batchId },
      },
    })

    // 古いデータ救済（fallback key）の場合
    if (deleted.count === 0 && batchId.includes('|')) {
      const [tsPart, kwPart, sizePart] = batchId.split('|')
      if (tsPart && kwPart !== undefined && sizePart !== undefined) {
        const start = new Date(`${tsPart}:00.000Z`)
        const end = new Date(`${tsPart}:59.999Z`)
        const rows = await prisma.generation.findMany({
          where: {
            userId,
            serviceId: 'banner',
            outputType: 'IMAGE',
            createdAt: { gte: start, lte: end },
          },
          select: { id: true, input: true, metadata: true },
          take: 20,
        })
        const ids = rows
          .filter((r) => {
            const meta: any = r.metadata || {}
            const input: any = r.input || {}
            const kw = String(input?.keyword || meta?.keyword || '')
            const sz = String(input?.size || meta?.size || '')
            return kw === kwPart && sz === sizePart
          })
          .map((r) => r.id)
        if (ids.length > 0) {
          await prisma.generation.deleteMany({
            where: { id: { in: ids }, userId, serviceId: 'banner', outputType: 'IMAGE' },
          })
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[banner history] delete failed', e)
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
}


