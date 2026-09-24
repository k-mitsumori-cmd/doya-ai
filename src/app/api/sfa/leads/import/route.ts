export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSfaContext, orgSlugFrom } from '@/lib/sfa/access'

// 取込1回あたりの上限（巨大ファイル対策）
const MAX_ROWS = 500

type RawRow = Record<string, unknown>

const str = (v: unknown, max: number): string | null => {
  if (v == null) return null
  if (typeof v !== 'string' && typeof v !== 'number') return null
  const s = String(v).trim()
  return s ? s.slice(0, max) : null
}

// POST /api/sfa/leads/import — リード一括取込（ドヤリスト/CSV）
// body: { source?: 'doyalist'|'csv', rows: Array<{ name, corporateNumber?, contactName?, email?, phone?, prefecture?, url?, industry?, employeeCount?, capital?, note? }> }
export async function POST(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: '取込内容が正しくありません' }, { status: 400 })
  }
  const rows = Array.isArray(body.rows) ? (body.rows as unknown[]) : null
  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: '取込データがありません' }, { status: 400 })
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `一度に取り込めるのは${MAX_ROWS}件までです` }, { status: 413 })
  }
  const source = body.source === 'doyalist' ? 'doyalist' : 'csv'

  // name 必須の行のみ採用。属性は raw に保持（スコアリングで利用）。
  const data = rows
    .map((r) => {
      if (!r || typeof r !== 'object' || Array.isArray(r)) return null
      const row = r as RawRow
      const name = str(row.name ?? row.companyName ?? row.会社名 ?? row.企業名, 200)
      if (!name) return null
      const raw: RawRow = {
        prefecture: str(row.prefecture ?? row.都道府県, 40),
        url: str(row.url ?? row.URL ?? row.website, 300),
        industry: str(row.industry ?? row.業界, 80),
        employeeCount: row.employeeCount ?? row.従業員数 ?? null,
        capital: row.capital ?? row.資本金 ?? null,
        representative: str(row.representative ?? row.代表者, 80),
        address: str(row.address ?? row.住所, 200),
      }
      return {
        organizationId: ctx.organizationId,
        name,
        corporateNumber: str(row.corporateNumber ?? row.法人番号, 20),
        contactName: str(row.contactName ?? row.representative ?? row.代表者, 80),
        email: str(row.email ?? row.メール, 200),
        phone: str(row.phone ?? row.電話番号 ?? row.tel, 40),
        note: str(row.note ?? row.メモ, 2000),
        source,
        status: 'new' as const,
        assigneeMemberId: ctx.memberId,
        raw: raw as any,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  if (data.length === 0) {
    return NextResponse.json({ error: '有効な行（企業名）がありませんでした' }, { status: 400 })
  }

  const created = await prisma.sfaLead.createMany({ data })
  return NextResponse.json({ ok: true, imported: created.count, skipped: rows.length - data.length })
}
