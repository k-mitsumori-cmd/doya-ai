// ============================================
// POST /api/voice/record/upload-url — 録音の署名付きアップロードURLを発行
// ============================================
// 流れ: (1) ここで署名付きURLを受け取る
//       (2) ブラウザが signedUrl へ直接 PUT する（Vercel を通らない）
//       (3) /api/voice/record/confirm で完了を知らせ、DB に記録する

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { isVoicePro, getVoicePlan } from '@/lib/voice/plans'
import { allowIssue } from '@/lib/direct-upload/rate-limit'
import { issueSignedUpload } from '@/lib/direct-upload/server'
import { SERVICE_RETIRED, retiredServiceResponse } from '@/lib/retired-service'
import {
  VOICE_BUCKET,
  VOICE_MAX_FILE_SIZE,
  VOICE_MAX_FILE_SIZE_LABEL,
  normalizeVoiceMime,
  voiceExtFromMime,
} from '@/lib/voice/record-upload'

export async function POST(req: NextRequest) {
  if (SERVICE_RETIRED) return retiredServiceResponse('ドヤボイスAI')

  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any
    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'ログインが必要です' }, { status: 401 })
    }
    if (!isVoicePro(getVoicePlan(user))) {
      return NextResponse.json({ success: false, error: 'クラウド録音は上位プランが必要です' }, { status: 403 })
    }

    if (!allowIssue(`voice:${user.id}`)) {
      return NextResponse.json({ success: false, error: '短時間に多くのアップロードが行われました。しばらくしてからお試しください' }, { status: 429 })
    }

    const body = await req.json().catch(() => null)
    const mimeType = normalizeVoiceMime(body?.mimeType)
    const fileSize = body?.fileSize
    const projectId = body?.projectId

    if (!mimeType) {
      return NextResponse.json({ success: false, error: '対応していない音声形式です' }, { status: 400 })
    }
    if (!Number.isSafeInteger(fileSize) || fileSize <= 0) {
      return NextResponse.json({ success: false, error: 'ファイルサイズが不正です' }, { status: 400 })
    }
    if (fileSize > VOICE_MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `ファイルサイズが大きすぎます（上限${VOICE_MAX_FILE_SIZE_LABEL}）` },
        { status: 400 }
      )
    }
    if (projectId !== undefined && projectId !== null && projectId !== '') {
      if (typeof projectId !== 'string') {
        return NextResponse.json({ success: false, error: 'プロジェクトIDが不正です' }, { status: 400 })
      }
      const proj = await prisma.voiceProject.findFirst({ where: { id: projectId, userId: user.id }, select: { id: true } })
      if (!proj) {
        return NextResponse.json({ success: false, error: 'プロジェクトが見つかりません' }, { status: 404 })
      }
    }

    const storagePath = `${user.id}/${Date.now()}_${randomUUID()}_recording.${voiceExtFromMime(mimeType)}`
    const data = await issueSignedUpload(VOICE_BUCKET, storagePath)

    return NextResponse.json({
      success: true,
      signedUrl: data.signedUrl,
      path: data.path,
      maxFileSize: VOICE_MAX_FILE_SIZE,
    })
  } catch (error: any) {
    console.error('Voice record upload-url error:', error?.message)
    if (error?.message?.includes('Supabase未設定')) {
      return NextResponse.json(
        { success: false, error: 'ストレージサービスが設定されていません。管理者にお問い合わせください。' },
        { status: 503 }
      )
    }
    return NextResponse.json(
      { success: false, error: 'アップロードの準備ができませんでした。しばらくしてから再度お試しください。' },
      { status: 503 }
    )
  }
}
