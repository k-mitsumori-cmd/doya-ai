export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { directUploadRollout } from '@/lib/direct-upload/flag'
import { NextRequest, NextResponse } from 'next/server'
import { getShodanContext, hasMinRole, orgSlugFrom } from '@/lib/shodan/access'
import { issueStagedImageUpload } from '@/lib/direct-upload/stage'

// POST /api/shodan/company-profile/logo/upload-url — 自社ロゴの署名付きアップロードURLを発行
// 続きは /api/shodan/company-profile/logo（完了通知）
export async function POST(req: NextRequest) {
  if (!directUploadRollout()) return NextResponse.json({ error: '直接アップロードは有効になっていません' }, { status: 404 })
  const ctx = await getShodanContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  if (!hasMinRole(ctx.role, 'manager')) return NextResponse.json({ error: '自社情報の編集権限がありません' }, { status: 403 })
  try {
    const body = await req.json().catch(() => null)
    const r = await issueStagedImageUpload({ ownerKey: ctx.organizationId, body })
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
    return NextResponse.json({ success: true, signedUrl: r.upload.signedUrl, path: r.upload.path })
  } catch {
    console.error('[shodan/company-profile/logo/upload-url]')
    return NextResponse.json({ error: 'アップロードの準備ができませんでした' }, { status: 503 })
  }
}
