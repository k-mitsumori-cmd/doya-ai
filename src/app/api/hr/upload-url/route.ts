export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getHrContext, hasMinRole } from '@/lib/hr/access'
import { HrMemberRole } from '@/lib/hr/types'
import { issueStagedImageUpload } from '@/lib/direct-upload/stage'

/**
 * POST /api/hr/upload-url — 従業員写真の署名付きアップロードURLを発行
 * 続きは /api/hr/upload（完了通知）。権限は ADMIN 以上。
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getHrContext()
    if (!ctx) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    if (!hasMinRole(ctx.role, HrMemberRole.ADMIN)) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

    const body = await req.json().catch(() => null)
    const r = await issueStagedImageUpload({ ownerKey: ctx.organizationId, body })
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
    return NextResponse.json({ success: true, signedUrl: r.upload.signedUrl, path: r.upload.path })
  } catch {
    console.error('[hr/upload-url]')
    return NextResponse.json({ error: 'アップロードの準備ができませんでした' }, { status: 503 })
  }
}
