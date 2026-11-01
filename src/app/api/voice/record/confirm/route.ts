// ============================================
// POST /api/voice/record/confirm — 録音アップロードの完了通知
// ============================================
// ブラウザが署名付きURLへ送り終えたあとに呼ぶ。保存先の実在とサイズを
// Storage 側で確かめてから、DB に録音を記録する。

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { directUploadRollout } from '@/lib/direct-upload/flag'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { isVoicePro, getVoicePlan } from '@/lib/voice/plans'
import { verifyUploadedObject } from '@/lib/direct-upload/server'
import { SERVICE_RETIRED, retiredServiceResponse } from '@/lib/retired-service'
import {
  VOICE_BUCKET,
  VOICE_MAX_FILE_SIZE,
  VOICE_MAX_FILE_SIZE_LABEL,
  getVoiceSupabaseAdmin,
  isOwnVoicePath,
  normalizeVoiceMime,
  voiceExtFromMime,
} from '@/lib/voice/record-upload'

export async function POST(req: NextRequest) {
  if (!directUploadRollout()) return NextResponse.json({ error: '直接アップロードは有効になっていません' }, { status: 404 })
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

    const body = await req.json().catch(() => null)
    const storagePath = body?.path
    const mimeType = normalizeVoiceMime(body?.mimeType)
    const durationMs = Math.max(0, Math.min(Number(body?.durationMs) || 0, 2147483647))
    const label = typeof body?.label === 'string' ? body.label.slice(0, 100) : null
    const projectId = typeof body?.projectId === 'string' && body.projectId ? body.projectId : null

    if (!isOwnVoicePath(user.id, storagePath)) {
      return NextResponse.json({ success: false, error: '保存先が不正です' }, { status: 400 })
    }
    if (!mimeType) {
      return NextResponse.json({ success: false, error: '対応していない音声形式です' }, { status: 400 })
    }

    // 実際に保存されたファイルを Storage で確かめる（申告のサイズは信用しない）
    const verified = await verifyUploadedObject(VOICE_BUCKET, storagePath, VOICE_MAX_FILE_SIZE)
    if (!verified.ok) {
      if (verified.reason === 'NOT_FOUND') {
        return NextResponse.json({ success: false, error: 'アップロードされたファイルが見つかりません' }, { status: 404 })
      }
      if (verified.reason === 'TOO_LARGE') {
        return NextResponse.json(
          { success: false, error: `ファイルサイズが大きすぎます（上限${VOICE_MAX_FILE_SIZE_LABEL}）` },
          { status: 400 }
        )
      }
      return NextResponse.json({ success: false, error: 'ファイルサイズを確認できませんでした' }, { status: 400 })
    }
    const actualSize = verified.size
    const supabase = getVoiceSupabaseAdmin()

    // 同じ保存先の二重登録を防ぐ（confirm の再送対策）
    const existing = await prisma.voiceRecording.findFirst({
      where: { originalUrl: { contains: storagePath }, project: { userId: user.id } },
      select: { id: true, projectId: true, originalUrl: true },
    })
    if (existing) {
      return NextResponse.json({
        success: true,
        recordingId: existing.id,
        projectId: existing.projectId,
        originalUrl: existing.originalUrl,
        storagePath,
      })
    }

    let voiceProjectId = projectId
    if (voiceProjectId) {
      const proj = await prisma.voiceProject.findFirst({ where: { id: voiceProjectId, userId: user.id }, select: { id: true } })
      if (!proj) {
        return NextResponse.json({ success: false, error: 'プロジェクトが見つかりません' }, { status: 404 })
      }
    } else {
      const proj = await prisma.voiceProject.create({
        data: {
          userId: user.id,
          name: `録音 ${new Date().toLocaleDateString('ja-JP')}`,
          status: 'draft',
          speakerId: 'akira',
          inputText: '',
        },
      })
      voiceProjectId = proj.id
    }

    // 署名付きURL取得（1時間有効。従来と同じ）
    const { data: urlData } = await supabase.storage.from(VOICE_BUCKET).createSignedUrl(storagePath, 3600)
    const originalUrl = urlData?.signedUrl || storagePath

    const recording = await prisma.voiceRecording.create({
      data: {
        projectId: voiceProjectId,
        originalUrl,
        durationMs,
        fileSize: actualSize,
        format: voiceExtFromMime(mimeType),
        label,
        order: 0,
      },
    })

    return NextResponse.json({
      success: true,
      recordingId: recording.id,
      projectId: voiceProjectId,
      originalUrl,
      storagePath,
    })
  } catch (error: any) {
    console.error('Voice record confirm error:', error?.message)
    return NextResponse.json(
      { success: false, error: '録音の記録に失敗しました。しばらくしてから再度お試しください。' },
      { status: 500 }
    )
  }
}
