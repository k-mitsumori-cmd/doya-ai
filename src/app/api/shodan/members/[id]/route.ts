export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { mutateShodanMember } from '@/lib/shodan/member-write'
import { LifecycleError } from '@/lib/account-lifecycle/state'
import { getShodanContext, hasMinRole, orgSlugFrom } from '@/lib/shodan/access'

type Ctx = { params: Promise<{ id: string }> }
const EDITABLE_ROLES = ['member', 'manager', 'admin']

// PATCH /api/shodan/members/[id] — 権限変更（admin+）
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const p = await ctx.params
  const sctx = await getShodanContext(orgSlugFrom(req))
  if (!sctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  if (!hasMinRole(sctx.role, 'admin')) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const role = EDITABLE_ROLES.includes(body?.role) ? (body.role as string) : null
  if (!role) return NextResponse.json({ error: '不正な権限です' }, { status: 400 })
  let result
  try { result = await mutateShodanMember(sctx, p.id, 'update', role) } catch (error) {
    if (error instanceof LifecycleError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    throw error
  }
  if (result.kind === 'forbidden') return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  if (result.kind === 'missing') return NextResponse.json({ error: 'メンバーが見つかりません' }, { status: 404 })
  if (result.kind === 'owner') return NextResponse.json({ error: 'オーナーの権限は変更できません' }, { status: 403 })
  if (result.kind === 'self') return NextResponse.json({ error: '自分自身の権限は変更できません' }, { status: 400 })
  if (result.kind === 'peer') return NextResponse.json({ error: '自分と同格以上のメンバーは変更できません' }, { status: 403 })
  if (result.kind === 'role') return NextResponse.json({ error: '自分と同格以上には変更できません' }, { status: 403 })
  if (result.kind !== 'updated') return NextResponse.json({ error: 'メンバーの変更を確認できませんでした' }, { status: 409 })
  return NextResponse.json({ ok: true, member: { id: result.member.id, role: result.member.role } })
}

// DELETE /api/shodan/members/[id] — メンバー削除/招待取消（admin+）
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const p = await ctx.params
  const sctx = await getShodanContext(orgSlugFrom(req))
  if (!sctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  if (!hasMinRole(sctx.role, 'admin')) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

  let result
  try { result = await mutateShodanMember(sctx, p.id, 'delete') } catch (error) {
    if (error instanceof LifecycleError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    throw error
  }
  if (result.kind === 'forbidden') return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  if (result.kind === 'missing') return NextResponse.json({ error: 'メンバーが見つかりません' }, { status: 404 })
  if (result.kind === 'owner') return NextResponse.json({ error: 'オーナーは削除できません' }, { status: 403 })
  if (result.kind === 'self') return NextResponse.json({ error: '自分自身は削除できません' }, { status: 400 })
  if (result.kind === 'peer') return NextResponse.json({ error: '自分と同格以上のメンバーは削除できません' }, { status: 403 })
  if (result.kind !== 'deleted') return NextResponse.json({ error: 'メンバーの削除を確認できませんでした' }, { status: 409 })
  return NextResponse.json({ ok: true, memberId: p.id })
}
