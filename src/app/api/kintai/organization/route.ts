export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getOrCreateOrganization } from '@/lib/kintai/access'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body = await req.json()
    const { name, employeeName } = body
    if (!name || !employeeName) {
      return NextResponse.json({ error: '組織名と氏名は必須です' }, { status: 400 })
    }

    const email = session?.user?.email || ''
    const org = await getOrCreateOrganization(userId, name, employeeName, email)

    return NextResponse.json({ organization: org })
  } catch (e) {
    console.error('[kintai/organization] Error:', e)
    return NextResponse.json({ error: '組織の作成に失敗しました' }, { status: 500 })
  }
}
