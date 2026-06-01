export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getHrContext, hasMinRole } from '@/lib/hr/access'
import { HrMemberRole } from '@/lib/hr/types'
import { uploadHrPhoto } from '@/lib/hr/storage'

// 対応画像形式 → 拡張子
const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

/**
 * POST /api/hr/upload
 * 従業員の顔写真をアップロードし、公開URLを返す。
 * FormData: { file: File }  →  { url: string }
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

    const formData = await req.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 })
    }

    const ext = ALLOWED[file.type]
    if (!ext) {
      return NextResponse.json(
        { error: 'JPG / PNG / WebP のみアップロードできます' },
        { status: 400 }
      )
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: '画像サイズは5MB以下にしてください' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    // 組織スコープのパス + ランダムUUIDで推測困難に
    const path = `${ctx.organizationId}/${randomUUID()}.${ext}`
    const url = await uploadHrPhoto(buffer, path, file.type)

    return NextResponse.json({ url })
  } catch (e: any) {
    console.error('[hr/upload]', e?.message)
    return NextResponse.json(
      { error: e?.message || 'アップロードに失敗しました' },
      { status: 500 }
    )
  }
}
