import { privateApiJson } from '@/lib/private-api-response'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import sharp from 'sharp'
import { getHrContext, hasMinRole } from '@/lib/hr/access'
import { HrMemberRole } from '@/lib/hr/types'
import { uploadHrPhoto } from '@/lib/hr/storage'
import { IMAGE_UPLOAD_MAX, readStagedImage, removeStaged } from '@/lib/direct-upload/stage'

const MIME_BY_EXT: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

/**
 * POST /api/hr/upload
 * 従業員の顔写真のアップロード完了通知。ブラウザは /api/hr/upload-url で受け取った
 * 署名付きURLへ直接送り済み。ここで一時ファイルを確かめ、非公開の保存先に置いて、
 * 組織権限を確認する表示URLを返す。
 * JSON: { path }  →  { url: string }
 * 権限: ADMIN 以上（従業員情報の編集権限と同等）
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getHrContext()
    if (!ctx) {
      return privateApiJson({ error: '認証が必要です' }, { status: 401 })
    }
    if (!hasMinRole(ctx.role, HrMemberRole.ADMIN)) {
      return privateApiJson({ error: '権限がありません' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    const staged = await readStagedImage(ctx.organizationId, body?.path)
    if (!staged.ok) return privateApiJson({ error: staged.error }, { status: staged.status })

    let buffer: Buffer
    try {
      const image = sharp(staged.buffer, { limitInputPixels: 40_000_000, failOn: 'warning' })
      const metadata = await image.metadata()
      const expectedFormat = staged.ext === 'jpg' ? 'jpeg' : staged.ext
      if (metadata.format !== expectedFormat) throw new Error('Image format mismatch')
      // Decode and re-encode before storage; MIME labels alone do not establish image validity.
      buffer = await image.rotate().toBuffer()
      if (!buffer.length || buffer.length > IMAGE_UPLOAD_MAX) throw new Error('Decoded image exceeds limit')
    } catch {
      await removeStaged(staged.path)
      return privateApiJson({ error: '画像を読み込めませんでした。正しいJPG・PNG・WebPを指定してください。' }, { status: 400 })
    }

    // 組織スコープのパス + ランダムUUIDで推測困難に
    const path = `${ctx.organizationId}/${randomUUID()}.${staged.ext}`
    const url = await uploadHrPhoto(buffer, path, MIME_BY_EXT[staged.ext])
    await removeStaged(staged.path)

    return privateApiJson({ url })
  } catch (e: any) {
    console.error('[hr/upload]')
    return privateApiJson(
      { error: 'アップロードに失敗しました' },
      { status: 500 }
    )
  }
}
