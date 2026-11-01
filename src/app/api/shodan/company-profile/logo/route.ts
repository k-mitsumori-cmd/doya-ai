export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getShodanContext, hasMinRole, orgSlugFrom } from '@/lib/shodan/access'
import { uploadFile, signedUrl } from '@/lib/shodan/storage'
import { directUploadRollout, isDirectConfirm } from '@/lib/direct-upload/flag'
import { readStagedImage, removeStaged } from '@/lib/direct-upload/stage'

const LEGACY_ALLOWED: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }
const LEGACY_MAX = 5 * 1024 * 1024

// POST /api/shodan/company-profile/logo — 自社ロゴをアップロードしてパス＋表示URLを返す
async function postLegacy(req: NextRequest) {
  const ctx = await getShodanContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  if (!hasMinRole(ctx.role, 'manager')) return NextResponse.json({ error: '自社情報の編集権限がありません' }, { status: 403 })

  let form: FormData
  try { form = await req.formData() } catch { return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 }) }
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'ファイルを選択してください' }, { status: 400 })
  const ext = LEGACY_ALLOWED[file.type]
  if (!ext) return NextResponse.json({ error: 'PNG / JPG / WebP のみ対応しています' }, { status: 400 })
  if (file.size > LEGACY_MAX) return NextResponse.json({ error: 'ファイルが大きすぎます（5MBまで）' }, { status: 400 })

  try {
    const buf = Buffer.from(await file.arrayBuffer())
    const path = `shodan/logos/${ctx.organizationId}/${crypto.randomUUID()}.${ext}`
    await uploadFile(path, buf, file.type)
    return NextResponse.json({ ok: true, path, url: await signedUrl(path) })
  } catch (e: any) {
    console.error('[shodan/company-profile/logo]')
    return NextResponse.json({ error: 'ロゴのアップロードに失敗しました' }, { status: 500 })
  }
}

const MIME_BY_EXT: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

// POST /api/shodan/company-profile/logo — 自社ロゴのアップロード完了通知。パス＋表示URLを返す
// ブラウザは ./upload-url の署名付きURLへ直接送り済み。JSON: { path }
async function postDirect(req: NextRequest) {
  const ctx = await getShodanContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  if (!hasMinRole(ctx.role, 'manager')) return NextResponse.json({ error: '自社情報の編集権限がありません' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const staged = await readStagedImage(ctx.organizationId, body?.path)
  if (!staged.ok) return NextResponse.json({ error: staged.error }, { status: staged.status })

  try {
    const path = `shodan/logos/${ctx.organizationId}/${crypto.randomUUID()}.${staged.ext}`
    await uploadFile(path, staged.buffer, MIME_BY_EXT[staged.ext])
    await removeStaged(staged.path)
    return NextResponse.json({ ok: true, path, url: await signedUrl(path) })
  } catch (e: any) {
    console.error('[shodan/company-profile/logo]')
    return NextResponse.json({ error: 'ロゴのアップロードに失敗しました' }, { status: 500 })
  }
}

// 旗（DIRECT_UPLOAD_ROLLOUT）が off のあいだは、これまでの FormData の経路だけが動く。
export async function POST(req: NextRequest) {
  if (isDirectConfirm(req)) {
    if (!directUploadRollout()) return NextResponse.json({ error: '直接アップロードは有効になっていません' }, { status: 404 })
    return postDirect(req)
  }
  return postLegacy(req)
}
