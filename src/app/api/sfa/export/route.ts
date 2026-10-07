export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import type { Prisma } from '@prisma/client'
import type { SfaContext } from '@/lib/sfa/types'
import { lockSfaMutationActor, SfaMutationError } from '@/lib/sfa/mutation-authority'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSfaContext, orgSlugFrom } from '@/lib/sfa/access'

function csvCell(v: unknown): string {
  const s = v == null ? '' : typeof v === 'bigint' ? String(v) : String(v)
  // CSVインジェクション対策（先頭の = + - @ をエスケープ）＋ダブルクオート
  const safe = /^[\s\u0000-\u001f\uFEFF]*[=+\-@]/.test(s) ? `'${s}` : s
  return `"${safe.replace(/"/g, '""')}"`
}
const BATCH_SIZE = 500
const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }

async function authorizedRead<T>(ctx: SfaContext, signal: AbortSignal, read: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  signal.throwIfAborted()
  const value = await prisma.$transaction(async tx => {
    // ReadCommitted sees membership changes committed while waiting for its lock.
    await lockSfaMutationActor(tx, ctx)
    signal.throwIfAborted()
    return read(tx)
  }, { isolationLevel: 'ReadCommitted', maxWait: 10000, timeout: 30000 })
  signal.throwIfAborted()
  return value
}

function csvChunk(headers: string[], rows: unknown[][], first: boolean): Uint8Array {
  const lines = [
    ...(first ? [headers.map(csvCell).join(',')] : []),
    ...rows.map((row) => row.map(csvCell).join(',')),
  ]
  return new TextEncoder().encode((first ? '\uFEFF' : '') + lines.join('\r\n') + '\r\n')
}

async function exportCsv<T extends { id: string }>(
  ctx: SfaContext,
  signal: AbortSignal,
  headers: string[],
  filename: string,
  loadPage: (afterId: string | null, tx: Prisma.TransactionClient) => Promise<T[]>,
  toRows: (page: T[], tx: Prisma.TransactionClient) => Promise<unknown[][]>,
): Promise<NextResponse> {
  // 最初のDB読み込みは応答開始前に行い、障害を成功CSVとして返さない。
  const batch = (afterId: string | null) => authorizedRead(ctx, signal, async tx => {
    const page = await loadPage(afterId, tx)
    const rows = await toRows(page, tx)
    return { page, rows }
  })
  const { page: firstPage, rows: firstRows } = await batch(null)
  let cursor = firstPage.at(-1)?.id ?? null
  let first = true
  let cancelled = false
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (cancelled) return
        signal.throwIfAborted()
        if (first) {
          first = false
          controller.enqueue(csvChunk(headers, firstRows, true))
          if (firstPage.length < BATCH_SIZE) controller.close()
          return
        }
        if (!cursor) {
          controller.close()
          return
        }
        const { page, rows } = await batch(cursor)
        if (cancelled) return
        if (page.length === 0) {
          controller.close()
          return
        }
        cursor = page[page.length - 1].id
        controller.enqueue(csvChunk(headers, rows, false))
        if (page.length < BATCH_SIZE) controller.close()
      } catch {
        // 途中障害ではストリームを失敗させ、途中までのCSVを正常なダウンロードにしない。
        if (!cancelled) controller.error(new Error('CSV出力を完了できませんでした'))
      }
    },
    cancel() { cancelled = true },
  })
  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      ...privateHeaders,
    },
  })
}

// GET /api/sfa/export?type=accounts|deals — BOM付きCSVダウンロード
export async function GET(req: NextRequest) {
  const type = new URL(req.url).searchParams.get('type') === 'deals' ? 'deals' : 'accounts'
  const startedAt = new Date()

  try {
    const ctx = await getSfaContext(orgSlugFrom(req))
    if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401, headers: privateHeaders })
    if (type === 'accounts') {
      const boundary = await authorizedRead(ctx, req.signal, tx => tx.sfaAccount.findFirst({
        where: { organizationId: ctx.organizationId, isActive: true, createdAt: { lte: startedAt } },
        orderBy: { id: 'desc' },
        select: { id: true },
      }))
      return await exportCsv(
        ctx, req.signal,
        ['会社名', '業界', '都道府県', '住所', 'URL', '法人番号', '従業員数', '与信ランク', '登録日'],
        'sfa_accounts.csv',
        (afterId, tx) => boundary ? tx.sfaAccount.findMany({
          where: { organizationId: ctx.organizationId, isActive: true, createdAt: { lte: startedAt }, id: { lte: boundary.id, ...(afterId ? { gt: afterId } : {}) } },
          orderBy: { id: 'asc' },
          take: BATCH_SIZE,
        }) : Promise.resolve([]),
        async (page) => page.map((account) => [
          account.name, account.industry, account.prefecture, account.address, account.url,
          account.corporateNumber, account.employeeCount, account.creditRank, account.createdAt.toISOString().slice(0, 10),
        ]),
      )
    }

    const boundary = await authorizedRead(ctx, req.signal, tx => tx.sfaDeal.findFirst({
      where: { organizationId: ctx.organizationId, isActive: true, createdAt: { lte: startedAt } },
      orderBy: { id: 'desc' },
      select: { id: true },
    }))
    return await exportCsv(
        ctx, req.signal,
      ['商談名', '取引先', '金額', 'ステージ', '確度', 'ステータス', '予定クローズ日', '更新日'],
      'sfa_deals.csv',
      (afterId, tx) => boundary ? tx.sfaDeal.findMany({
        where: { organizationId: ctx.organizationId, isActive: true, createdAt: { lte: startedAt }, id: { lte: boundary.id, ...(afterId ? { gt: afterId } : {}) } },
        orderBy: { id: 'asc' },
        take: BATCH_SIZE,
      }) : Promise.resolve([]),
      async (page, tx) => {
        const accountIds = Array.from(new Set(page.map((deal) => deal.accountId).filter(Boolean))) as string[]
        const stageIds = Array.from(new Set(page.map((deal) => deal.stageId).filter(Boolean))) as string[]
        const [accounts, stages] = await Promise.all([
          accountIds.length ? tx.sfaAccount.findMany({ where: { id: { in: accountIds }, organizationId: ctx.organizationId }, select: { id: true, name: true } }) : [],
          stageIds.length ? tx.sfaStage.findMany({ where: { id: { in: stageIds }, pipeline: { organizationId: ctx.organizationId } }, select: { id: true, name: true } }) : [],
        ])
        const accountNames = Object.fromEntries(accounts.map((account) => [account.id, account.name]))
        const stageNames = Object.fromEntries(stages.map((stage) => [stage.id, stage.name]))
        return page.map((deal) => [
          deal.name,
          deal.accountId ? accountNames[deal.accountId] || '' : '',
          String(deal.amount),
          deal.stageId ? stageNames[deal.stageId] || '' : '',
          `${deal.probability}%`,
          deal.status,
          deal.expectedCloseDate ? deal.expectedCloseDate.toISOString().slice(0, 10) : '',
          deal.updatedAt.toISOString().slice(0, 10),
        ])
      },
    )
  } catch (error) {
    if (error instanceof SfaMutationError) return NextResponse.json({ error: error.message }, { status: error.status, headers: privateHeaders })
    return NextResponse.json({ error: 'CSV出力に失敗しました。時間をおいて再試行してください。' }, { status: 503, headers: privateHeaders })
  }
}
