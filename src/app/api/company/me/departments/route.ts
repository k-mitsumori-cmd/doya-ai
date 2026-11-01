// ============================================
// 自分の部署 GET /api/company/me/departments → { primary, all }
// ============================================
// 部署ごとの入口（メニューの並び）が使う。旗が off・会社に入っていない・表が無いときは { primary: [], all: true }（全部を出す）。
// ⚠️ 部署は並びに使うだけで、権限の判定には使わない。
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getMemberDepartments } from '@/lib/company-roles/departments.server'

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
  const d = await getMemberDepartments(userId, session?.user?.email ?? null)
  return NextResponse.json(d, { headers: { 'Cache-Control': 'private, no-store' } })
}
