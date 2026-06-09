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
  const s = String(v).trim()
  return s ? s.slice(0, max) : null
}

// POST /api/sfa/leads/import — リード一括取込（ドヤリスト/CSV）
// body: { source?: 'doyalist'|'csv', rows: Array<{ name, corporateNumber?, contactName?, email?, phone?, prefecture?, url?, industry?, employeeCount?, capital?, note? }> }
export async function POST(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const rows = Array.isArray(body.rows) ? (body.rows as RawRow[]) : null
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
      const name = str(r.name ?? r.companyName ?? r.会社名 ?? r.企業名, 200)
      if (!name) return null
      const raw: RawRow = {
        prefecture: str(r.prefecture ?? r.都道府県, 40),
        url: str(r.url ?? r.URL ?? r.website, 300),
        industry: str(r.industry ?? r.業界, 80),
        employeeCount: r.employeeCount ?? r.従業員数 ?? null,
        capital: r.capital ?? r.資本金 ?? null,
        representative: str(r.representative ?? r.代表者, 80),
        address: str(r.address ?? r.住所, 200),
      }
      return {
        organizationId: ctx.organizationId,
        name,
        corporateNumber: str(r.corporateNumber ?? r.法人番号, 20),
        contactName: str(r.contactName ?? r.representative ?? r.代表者, 80),
        email: str(r.email ?? r.メール, 200),
        phone: str(r.phone ?? r.電話番号 ?? r.tel, 40),
        note: str(r.note ?? r.メモ, 2000),
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
