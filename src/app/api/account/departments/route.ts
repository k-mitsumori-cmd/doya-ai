// ============================================
// 主に使う部署（はじめの設定・会社情報の画面で選ぶ）
// ============================================
// 設計: docs/architecture/management-agent/DEPARTMENTS-2026-10-26.md §2・§6（段2）
// GET … 選べる部署と、今の選択（cookie doya_departments）
// PUT … 選択を cookie に書く（{ departments: string[] }）。DB には書かない。
// ⚠️ 旗 DEPARTMENTS_ROLLOUT が off の人、ログインしていない人には 404（旗の判定はセッションを読む前に off を返す）。
// ⚠️ 知らない id は捨て、重複は1つにまとめる（departments.ts の parseDepartmentsCookie）。
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { DEPARTMENTS, DEPARTMENTS_COOKIE, parseDepartmentsCookie, serializeDepartments } from '@/lib/departments'
import { isDepartmentsEnabled } from '@/lib/departments/flag'

const NO_STORE = { 'Cache-Control': 'private, no-store' }
const ONE_YEAR = 60 * 60 * 24 * 365

function notFound() {
  return NextResponse.json({ error: 'Not Found' }, { status: 404, headers: NO_STORE })
}

export async function GET() {
  if (!(await isDepartmentsEnabled())) return notFound()
  const primary = parseDepartmentsCookie((await cookies()).get(DEPARTMENTS_COOKIE)?.value)
  return NextResponse.json(
    { departments: DEPARTMENTS.map((d) => ({ id: d.id, name: d.name, short: d.short })), primary },
    { headers: NO_STORE },
  )
}

export async function PUT(req: NextRequest) {
  if (!(await isDepartmentsEnabled())) return notFound()
  const body = (await req.json().catch(() => null)) as { departments?: unknown } | null
  const raw = body?.departments
  if (!Array.isArray(raw) || raw.length > DEPARTMENTS.length * 2 || !raw.every((v) => typeof v === 'string')) {
    return NextResponse.json({ error: '部署の選び方が正しくありません' }, { status: 400, headers: NO_STORE })
  }
  const primary = parseDepartmentsCookie((raw as string[]).join(','))
  const res = NextResponse.json({ primary }, { headers: NO_STORE })
  res.cookies.set(DEPARTMENTS_COOKIE, serializeDepartments(primary), {
    path: '/',
    sameSite: 'lax',
    maxAge: primary.length ? ONE_YEAR : 0,
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
  })
  return res
}
