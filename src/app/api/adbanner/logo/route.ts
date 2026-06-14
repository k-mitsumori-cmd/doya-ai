export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getAdIdentity, ownerWhere } from '@/lib/adbanner/access'
import { uploadFile, signedUrl } from '@/lib/adbanner/storage'

const ALLOWED: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }
const MAX = 5 * 1024 * 1024

// POST /api/adbanner/logo — ロゴ画像をアップロードしてパスと表示URLを返す（multipart/form-data）
export async function POST(req: NextRequest) {
  const id = await getAdIdentity(req)
  if (!ownerWhere(id) && id.plan === 'GUEST') {
    // ゲストでもCookie未付与だと所有者特定不可。先にキャンペーン作成を促す。
  }
  let form: FormData
  try { form = await req.formData() } catch { return NextResponse.json({ success: false, error: 'ファイルがありません' }, { status: 400 }) }
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ success: false, error: 'ファイルを選択してください' }, { status: 400 })
  const ext = ALLOWED[file.type]
  if (!ext) return NextResponse.json({ success: false, error: 'PNG / JPG / WebP のみ対応しています' }, { status: 400 })
  if (file.size > MAX) return NextResponse.json({ success: false, error: 'ファイルが大きすぎます（5MBまで）' }, { status: 400 })

  try {
    const buf = Buffer.from(await file.arrayBuffer())
    const path = `adbanner/logos/${crypto.randomUUID()}.${ext}`
    await uploadFile(path, buf, file.type)
    return NextResponse.json({ success: true, data: { path, url: await signedUrl(path) } })
  } catch (e: any) {
    console.error('[adbanner/logo]', e?.message)
    return NextResponse.json({ success: false, error: 'ロゴのアップロードに失敗しました' }, { status: 500 })
  }
}
