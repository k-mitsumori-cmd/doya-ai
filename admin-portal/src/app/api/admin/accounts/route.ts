import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { canManageAccounts, getAuthContext, isAuthenticated } from '@/lib/auth'
import { createAccount, listAccounts } from '@/lib/accounts/store'
import type { AdminRole } from '@/lib/accounts/types'

export async function GET() {
  const ok = await isAuthenticated()
  if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const ctx = await getAuthContext()
  if (!ctx || !canManageAccounts(ctx.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  return NextResponse.json({ accounts: listAccounts() })
}

export async function POST(request: NextRequest) {
  const ok = await isAuthenticated()
  if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const ctx = await getAuthContext()
  if (!ctx || !canManageAccounts(ctx.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: string
    name?: string
    role?: AdminRole
    password?: string
  }

  if (!body.email || !body.password || !body.role) {
    return NextResponse.json({ error: 'email, password, role are required' }, { status: 400 })
  }

  try {
    const created = createAccount({
      email: body.email,
      name: body.name || body.email,
      role: body.role,
      password: body.password,
    })
    return NextResponse.json({ account: created })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'failed' }, { status: 400 })
  }
}



