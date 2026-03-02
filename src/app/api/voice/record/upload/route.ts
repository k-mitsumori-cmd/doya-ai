// ============================================
// POST /api/voice/record/upload — 録音データアップロード
// ============================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { createClient } from '@supabase/supabase-js'

const BUCKET = process.env.VOICE_STORAGE_BUCKET || 'voice-recordings'
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase未設定: NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'ログインが必要です' }, { status: 401 })
    }

    const plan = String(user?.voicePlan || user?.plan || 'FREE').toUpperCase()
    const isPro = ['PRO', 'ENTERPRISE', 'BUSINESS', 'STARTER', 'BUNDLE'].includes(plan)

    if (!isPro) {
      return NextResponse.json(
        { success: false, error: 'クラウド録音はPROプランが必要です' },
        { status: 403 }
      )
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const projectId = formData.get('projectId') as string | null
    const durationMs = Number(formData.get('durationMs') || 0)
    const label = formData.get('label') as string | null

    if (!file) {
      return NextResponse.json({ success: false, error: '音声ファイルを指定してください' }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: `ファイルサイズが大きすぎます（上限50MB）` }, { status: 400 })
    }

    const allowedTypes = ['audio/webm', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/mpeg']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ success: false, error: '対応していない音声形式です' }, { status: 400 })
    }

    // プロジェクト存在確認（指定があれば）
    let voiceProjectId = projectId
    if (voiceProjectId) {
      const proj = await prisma.voiceProject.findFirst({
        where: { id: voiceProjectId, userId: user.id },
      })
      if (!proj) {
        return NextResponse.json({ success: false, error: 'プロジェクトが見つかりません' }, { status: 404 })
      }
    } else {
      // プロジェクト未指定の場合は新規作成
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

    // ファイル拡張子
    const ext = file.type.includes('webm') ? 'webm' : file.type.includes('ogg') ? 'ogg' : file.type.includes('wav') ? 'wav' : 'mp4'
    const storagePath = `${user.id}/${voiceProjectId}/${Date.now()}_recording.${ext}`

    // Supabaseにアップロード
    const supabase = getSupabaseAdmin()
    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, new Uint8Array(arrayBuffer), {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      // バケット未存在の場合は作成を試みる
      if (uploadError.message?.includes('not found') || uploadError.message?.includes('Bucket not found')) {
        await supabase.storage.createBucket(BUCKET, { public: false })
        const { error: retryError } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, new Uint8Array(arrayBuffer), { contentType: file.type })
        if (retryError) throw new Error(retryError.message)
      } else {
        throw new Error(uploadError.message)
      }
    }

    // 署名付きURL取得（1時間有効）
    const { data: urlData } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 3600)

    const originalUrl = urlData?.signedUrl || storagePath

    // DBに録音データ保存
    const recording = await prisma.voiceRecording.create({
      data: {
        projectId: voiceProjectId,
        originalUrl,
        durationMs: durationMs || 0,
        fileSize: file.size,
        format: ext,
        label: label ? String(label).slice(0, 100) : null,
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
  } catch (error) {
    console.error('Voice record upload error:', error)
    return NextResponse.json(
      { success: false, error: '録音のアップロードに失敗しました' },
      { status: 500 }
    )
  }
}
