import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BANNER_PRICING, isWithinFreeHour } from '@/lib/pricing'
import sharp from 'sharp'
import { decodeBannerHistoryCursor, encodeBannerHistoryCursor } from '@/lib/banner/history-cursor'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseIntParam(v: string | null, fallback: number) {
  if (v === null || v.trim() === '') return fallback
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

// 契約の正本はDB。古いセッションに残った有料プラン表示で履歴権限を与えない。
async function isProUserByDb(userId: string): Promise<boolean> {
  const sub = await prisma.userServiceSubscription.findUnique({
    where: { userId_serviceId: { userId, serviceId: 'banner' } },
    select: { plan: true },
  })
  const account = !sub ? await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } }) : null
  const plan = String(sub?.plan || account?.plan || 'FREE').toUpperCase()
  return ['LIGHT', 'PRO', 'ENTERPRISE', 'BUNDLE', 'BASIC', 'STARTER', 'BUSINESS'].includes(plan)
}

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
    const isPro = isFreeHourActive || (await isProUserByDb(userId))
    const historyDays = isPro ? BANNER_PRICING.historyDays.pro : BANNER_PRICING.historyDays.free

    // 無料ユーザーは履歴閲覧不可（ただし1時間生成し放題中は解放）
    if (historyDays === 0) {
      return NextResponse.json({
        items: [],
        message: '履歴機能は有料プラン限定です。プランをアップグレードしてください。',
        requiresUpgrade: true,
      })
    }

    // プラン別の閲覧期間。GET時に履歴は削除しない（プラン変更後のデータ消失を防ぐ）。
    const cutoffDate = new Date()
    if (historyDays > 0) {
      cutoffDate.setDate(cutoffDate.getDate() - historyDays)
    } else {
      // -1（無制限）: 保存済みの全履歴を返す
      cutoffDate.setTime(0)
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
    let cursor: ReturnType<typeof decodeBannerHistoryCursor> | null = null
    try {
      if (searchParams.has('cursor')) cursor = decodeBannerHistoryCursor(searchParams.get('cursor') || '', userId)
    } catch {
      return NextResponse.json({ error: '履歴の取得位置が正しくありません。最初から読み直してください。' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
    }

    // images=0 の場合は output を取らず、レスポンスを極力軽くする
    const rows = await prisma.generation.findMany({
      where: {
        userId,
        serviceId: 'banner',
        outputType: 'IMAGE',
        createdAt: { gte: cutoffDate }, // 保存期間内のみ取得
        ...(cursor ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: takeRows + 1,
      select: includeImages
        ? { id: true, output: true, createdAt: true, input: true, metadata: true }
        : { id: true, createdAt: true, input: true, metadata: true },
    })

    const byBatch = new Map<string, HistoryBatch & { _createdAtMs: number }>()

    let processed = 0
    for (const r of rows) {
      const meta: any = r.metadata || {}
      const input: any = r.input || {}
      const batchId = typeof meta?.batchId === 'string' ? meta.batchId : ''
      const createdAtIso = r.createdAt.toISOString()
      const key =
        batchId ||
        // 古いデータの救済：近い作成時刻＋入力でまとめる
        `${createdAtIso.slice(0, 16)}|${String(input?.keyword || meta?.keyword || '')}|${String(input?.size || meta?.size || '')}`
      if (byBatch.size >= takeBatches && !byBatch.has(key)) break
      if (processed >= takeRows) break
      processed++

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

    const nextCursor = rows.length > processed && processed > 0
      ? encodeBannerHistoryCursor(rows[processed - 1], userId) : null
    return NextResponse.json({ items, nextCursor }, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
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
