import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { createBannerAdminUpload, validBannerAdminFile } from '@/lib/banner-admin-image-storage'
import { readOperationalJson, OperationalBodyError } from '@/lib/operational-json'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const denied = await requireAdmin()
  if (denied) return denied
  let body: Record<string, unknown>
  try {
    body = await readOperationalJson(request, 4096)
  } catch (error) {
    return NextResponse.json({ error: 'リクエストが不正です' }, { status: error instanceof OperationalBodyError ? error.status : 400 })
  }
  const { mimeType, fileSize } = body
  if (!validBannerAdminFile(mimeType, fileSize)) {
    return NextResponse.json({ error: 'PNG・JPEG・WEBP形式の5MB以下の画像を選択してください' }, { status: 400 })
  }
  try {
    return NextResponse.json(await createBannerAdminUpload(mimeType))
  } catch (error) {
    console.error('[POST /api/admin/doyamana/images/upload-url] Error:', error)
    return NextResponse.json({ error: '画像アップロードの準備に失敗しました' }, { status: 502 })
  }
}
