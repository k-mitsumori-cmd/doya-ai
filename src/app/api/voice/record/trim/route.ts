// ============================================
// POST /api/voice/record/trim — 録音トリミング（メタデータ更新）
// ============================================
// 注: ブラウザ側でAudioBufferによるトリミングを行い、
//     このAPIではトリミング済み音声のアップロードとメタデータ更新を担当する

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { createClient } from '@supabase/supabase-js'

function isProPlan(plan: string | null | undefined): boolean {
  const p = String(plan || 'FREE').toUpperCase()
  return ['PRO', 'ENTERPRISE', 'BUSINESS', 'STARTER', 'BUNDLE'].includes(p)
}
function isLightOrAbove(plan: string | null | undefined): boolean {
  const p = String(plan || 'FREE').toUpperCase()
  return ['LIGHT', 'PRO', 'ENTERPRISE', 'BUSINESS', 'STARTER', 'BUNDLE'].includes(p)
}

const BUCKET = process.env.VOICE_STORAGE_BUCKET || 'voice-recordings'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase未設定')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'ログインが必要です' }, { status: 401 })
    }

    // プラン制限: Freeプランはトリミング不可
    const plan = String(user?.voicePlan || user?.plan || 'FREE').toUpperCase()
    if (!isLightOrAbove(plan)) {
      return NextResponse.json(
        { success: false, error: 'トリミング機能はプロプラン以上で利用可能です', upgradePath: '/voice/pricing' },
        { status: 403 }
      )
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const recordingId = formData.get('recordingId') as string | null
    const durationMs = Number(formData.get('durationMs') || 0)

    if (!recordingId) {
      return NextResponse.json({ success: false, error: 'recordingIdは必須です' }, { status: 400 })
    }
    if (!file) {
      return NextResponse.json({ success: false, error: 'トリミング済み音声ファイルを指定してください' }, { status: 400 })
    }

    // 録音データの所有者確認
    const recording = await prisma.voiceRecording.findFirst({
      where: { id: recordingId },
      include: { project: { select: { userId: true } } },
    })

    if (!recording || recording.project.userId !== user.id) {
      return NextResponse.json({ success: false, error: '録音データが見つかりません' }, { status: 404 })
    }

    const ext = file.type.includes('webm') ? 'webm' : file.type.includes('ogg') ? 'ogg' : 'wav'
    const storagePath = `${user.id}/${recording.projectId}/${Date.now()}_trimmed.${ext}`

    // Supabaseにトリミング済み音声をアップロード
    const supabase = getSupabaseAdmin()
    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, new Uint8Array(arrayBuffer), {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) throw new Error(uploadError.message)

    // 署名付きURL取得
    const { data: urlData } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 3600)

    const trimmedUrl = urlData?.signedUrl || storagePath

    // DBのtrimmedUrlとdurationMsを更新
    const updated = await prisma.voiceRecording.update({
      where: { id: recordingId },
      data: {
        trimmedUrl,
        durationMs: durationMs || recording.durationMs,
        fileSize: file.size,
        format: ext,
      },
    })

    return NextResponse.json({
      success: true,
      recordingId: updated.id,
      trimmedUrl,
      durationMs: updated.durationMs,
    })
  } catch (error: any) {
    console.error('Voice record trim error:', error)

    let errorMessage = 'トリミングに失敗しました'
    let statusCode = 500

    if (error?.message?.includes('Supabase未設定')) {
      errorMessage = 'ストレージサービスが設定されていません。管理者にお問い合わせください。'
      statusCode = 503
    } else if (error?.message?.includes('storage') || error?.message?.includes('bucket')) {
      errorMessage = 'トリミング済みファイルの保存に失敗しました。しばらくしてから再度お試しください。'
      statusCode = 503
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: statusCode }
    )
  }
}
