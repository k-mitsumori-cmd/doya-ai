export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getHrContext, hasMinRole } from '@/lib/hr/access'
import { HrMemberRole } from '@/lib/hr/types'
import { uploadHrPhoto } from '@/lib/hr/storage'
import { readStagedImage, removeStaged } from '@/lib/direct-upload/stage'

const MIME_BY_EXT: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

/**
 * POST /api/hr/upload
 * 従業員の顔写真のアップロード完了通知。ブラウザは /api/hr/upload-url で受け取った
 * 署名付きURLへ直接送り済み。ここで一時ファイルを確かめ、最終の保存先に置いて公開URLを返す。
 * JSON: { path }  →  { url: string }
 * 権限: ADMIN 以上（従業員情報の編集権限と同等）
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getHrContext()
    if (!ctx) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }
    if (!hasMinRole(ctx.role, HrMemberRole.ADMIN)) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    const staged = await readStagedImage(ctx.organizationId, body?.path)
    if (!staged.ok) return NextResponse.json({ error: staged.error }, { status: staged.status })

    // 組織スコープのパス + ランダムUUIDで推測困難に
    const path = `${ctx.organizationId}/${randomUUID()}.${staged.ext}`
    const url = await uploadHrPhoto(staged.buffer, path, MIME_BY_EXT[staged.ext])
    await removeStaged(staged.path)

    return NextResponse.json({ url })
  } catch (e: any) {
    console.error('[hr/upload]')
    return NextResponse.json(
      { error: 'アップロードに失敗しました' },
      { status: 500 }
    )
  }
}
