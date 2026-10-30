export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/doyaslide/access'
import { issueStagedImageUpload } from '@/lib/direct-upload/stage'

// POST /api/doyaslide/assets/logo/upload-url — ロゴの署名付きアップロードURLを発行
// 続きは /api/doyaslide/assets/logo（完了通知）。SVGはスクリプト混入の恐れがあるため対象外。
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    const body = await req.json().catch(() => null)
    const r = await issueStagedImageUpload({ ownerKey: userId, body })
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
    return NextResponse.json({ success: true, signedUrl: r.upload.signedUrl, path: r.upload.path })
  } catch {
    console.error('[doyaslide/assets/logo/upload-url]')
    return NextResponse.json({ error: 'アップロードの準備ができませんでした' }, { status: 503 })
  }
}
