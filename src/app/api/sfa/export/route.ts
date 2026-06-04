export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSfaContext, orgSlugFrom } from '@/lib/sfa/access'

function csvCell(v: unknown): string {
  const s = v == null ? '' : typeof v === 'bigint' ? String(v) : String(v)
  // CSVインジェクション対策（先頭の = + - @ をエスケープ）＋ダブルクオート
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return `"${safe.replace(/"/g, '""')}"`
}
function toCsv(headers: string[], rows: (unknown[])[]): string {
  const lines = [headers.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))]
  return '﻿' + lines.join('\r\n') // BOM付き（Excel日本語対策）
}

// GET /api/sfa/export?type=accounts|deals — BOM付きCSVダウンロード
export async function GET(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  const type = new URL(req.url).searchParams.get('type') === 'deals' ? 'deals' : 'accounts'

  let csv = ''
  let filename = ''
  if (type === 'accounts') {
    const rows = await prisma.sfaAccount.findMany({
      where: { organizationId: ctx.organizationId, isActive: true },
      orderBy: { name: 'asc' },
      take: 5000,
    })
    csv = toCsv(
      ['会社名', '業界', '都道府県', '住所', 'URL', '法人番号', '従業員数', '与信ランク', '登録日'],
      rows.map((a) => [a.name, a.industry, a.prefecture, a.address, a.url, a.corporateNumber, a.employeeCount, a.creditRank, a.createdAt.toISOString().slice(0, 10)])
    )
    filename = 'sfa_accounts.csv'
  } else {
    const deals = await prisma.sfaDeal.findMany({
      where: { organizationId: ctx.organizationId, isActive: true },
      orderBy: { updatedAt: 'desc' },
      take: 5000,
    })
    const accIds = Array.from(new Set(deals.map((d) => d.accountId).filter(Boolean))) as string[]
    const accs = accIds.length ? await prisma.sfaAccount.findMany({ where: { id: { in: accIds } }, select: { id: true, name: true } }) : []
    const stageIds = Array.from(new Set(deals.map((d) => d.stageId).filter(Boolean))) as string[]
    const stages = stageIds.length ? await prisma.sfaStage.findMany({ where: { id: { in: stageIds } }, select: { id: true, name: true } }) : []
    const accMap = Object.fromEntries(accs.map((a) => [a.id, a.name]))
    const stMap = Object.fromEntries(stages.map((s) => [s.id, s.name]))
    csv = toCsv(
      ['商談名', '取引先', '金額', 'ステージ', '確度', 'ステータス', '予定クローズ日', '更新日'],
      deals.map((d) => [
        d.name,
        d.accountId ? accMap[d.accountId] || '' : '',
        Number(d.amount),
        d.stageId ? stMap[d.stageId] || '' : '',
        `${d.probability}%`,
        d.status,
        d.expectedCloseDate ? d.expectedCloseDate.toISOString().slice(0, 10) : '',
        d.updatedAt.toISOString().slice(0, 10),
      ])
    )
    filename = 'sfa_deals.csv'
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
