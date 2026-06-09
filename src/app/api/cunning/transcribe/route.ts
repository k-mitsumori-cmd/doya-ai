export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/cunning/access'
import { transcribeChunk } from '@/lib/cunning/transcribe'

// POST /api/cunning/transcribe — 音声チャンク(multipart) → 文字起こしテキスト
// body: FormData { audio: Blob, sessionId?: string }
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

    const form = await req.formData()
    const audio = form.get('audio')
    const sessionId = (form.get('sessionId') as string) || null
    const speaker = (form.get('speaker') as string) === 'self' ? 'self' : 'remote'
    // 言語: ja(既定) / en / auto。auto は自動判定（ヒントなし）。
    const langRaw = (form.get('language') as string) || 'ja'
    const language = langRaw === 'en' ? 'en' : langRaw === 'auto' ? 'auto' : 'ja'
    if (!(audio instanceof Blob) || audio.size === 0) {
      return NextResponse.json({ error: '音声データがありません' }, { status: 400 })
    }
    // 過大チャンクは弾く（数秒分のはず）
    if (audio.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: '音声チャンクが大きすぎます' }, { status: 413 })
    }

    const { text } = await transcribeChunk(audio, { filename: 'chunk.webm', language })

    // セッションがあれば確定セグメントとして保存（空文字は無音なので保存しない）
    if (sessionId && text) {
      const session = await prisma.cunningSession.findUnique({
        where: { id: sessionId },
        select: { userId: true },
      })
      if (session && session.userId === userId) {
        await prisma.cunningTranscript.create({
          data: { sessionId, speaker, text, isFinal: true },
        })
      }
    }

    return NextResponse.json({ text }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    console.error('[cunning/transcribe]', e?.message)
    return NextResponse.json({ error: '文字起こしに失敗しました' }, { status: 500 })
  }
}
