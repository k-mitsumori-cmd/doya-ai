import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { canManageAccounts, getAuthContext, isAuthenticated } from '@/lib/auth'
import { deleteAccount, resetAccountPassword, updateAccountRole } from '@/lib/accounts/store'
import type { AdminRole } from '@/lib/accounts/types'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const ok = await isAuthenticated()
  if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const ctx = await getAuthContext()
  if (!ctx || !canManageAccounts(ctx.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as { role?: AdminRole; password?: string }

  try {
    if (body.role) {
      const account = updateAccountRole(params.id, body.role)
      return NextResponse.json({ account })
    }
    if (typeof body.password === 'string') {
      const account = resetAccountPassword(params.id, body.password)
      return NextResponse.json({ account })
    }
    return NextResponse.json({ error: 'role or password is required' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'failed' }, { status: 400 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const ok = await isAuthenticated()
  if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const ctx = await getAuthContext()
  if (!ctx || !canManageAccounts(ctx.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    deleteAccount(params.id)
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'failed' }, { status: 400 })
  }
}





