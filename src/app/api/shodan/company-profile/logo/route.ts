export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getShodanContext, hasMinRole, orgSlugFrom } from '@/lib/shodan/access'
import { uploadFile, signedUrl } from '@/lib/shodan/storage'

const ALLOWED: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }
const MAX = 5 * 1024 * 1024

// POST /api/shodan/company-profile/logo — 自社ロゴをアップロードしてパス＋表示URLを返す
export async function POST(req: NextRequest) {
  const ctx = await getShodanContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  if (!hasMinRole(ctx.role, 'manager')) return NextResponse.json({ error: '自社情報の編集権限がありません' }, { status: 403 })

  let form: FormData
  try { form = await req.formData() } catch { return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 }) }
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'ファイルを選択してください' }, { status: 400 })
  const ext = ALLOWED[file.type]
  if (!ext) return NextResponse.json({ error: 'PNG / JPG / WebP のみ対応しています' }, { status: 400 })
  if (file.size > MAX) return NextResponse.json({ error: 'ファイルが大きすぎます（5MBまで）' }, { status: 400 })

  try {
    const buf = Buffer.from(await file.arrayBuffer())
    const path = `shodan/logos/${ctx.organizationId}/${crypto.randomUUID()}.${ext}`
    await uploadFile(path, buf, file.type)
    return NextResponse.json({ ok: true, path, url: await signedUrl(path) })
  } catch (e: any) {
    console.error('[shodan/company-profile/logo]', e?.message)
    return NextResponse.json({ error: 'ロゴのアップロードに失敗しました' }, { status: 500 })
  }
}
