export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getShodanContext, hasMinRole, orgSlugFrom } from '@/lib/shodan/access'
import { uploadFile, signedUrl } from '@/lib/shodan/storage'
import { readStagedImage, removeStaged } from '@/lib/direct-upload/stage'

const MIME_BY_EXT: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

// POST /api/shodan/company-profile/logo — 自社ロゴのアップロード完了通知。パス＋表示URLを返す
// ブラウザは ./upload-url の署名付きURLへ直接送り済み。JSON: { path }
export async function POST(req: NextRequest) {
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
