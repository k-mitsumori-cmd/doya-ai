// ============================================
// GET /api/interview/materials/[id]/transcribe-stream
// ============================================
// SSE でリアルタイムに文字起こし進捗をストリーミング
// 再接続対応: 既にAssemblyAIジョブが送信済みならポーリングから再開
//
// イベント:
//   status  — 処理ステータス (step, message, elapsed)
//   segment — 文字起こしセグメント (index, text, speaker, start, end)
//   complete — 完了通知 (transcriptionId, totalSegments, durationSeconds)
//   fail    — エラー通知 (message, hint)  ※ "error" はEventSourceネイティブと衝突するため "fail" を使用

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterviewUser, getGuestIdFromRequest, checkOwnership } from '@/lib/interview/access'
import { getSignedFileUrl } from '@/lib/interview/storage'
import { getInterviewGuestLimits } from '@/lib/pricing'
import type { TranscriptionSegment } from '@/lib/interview/types'

const ASSEMBLYAI_BASE_URL = 'https://api.assemblyai.com/v2'

// ポーリング設定 — Vercelの5分制限内で最大限ポーリングする
// ※ 1回の文字起こし上限: 約3時間（180分）
//   POLL_INTERVAL=5s × MAX_POLL_DURATION=4m30s/回 × 自動再接続最大10回 ≒ 45分のポーリング
//   AssemblyAI処理速度（実時間の1/4〜1/5）→ 約3時間が実質上限
const POLL_INTERVAL_MS = 5000        // 固定5秒間隔 (バックオフしない)
const MAX_POLL_DURATION_MS = 270_000 // 4分30秒 (maxDuration=5分に余裕を持たせる)
const SEGMENT_STREAM_DELAY_MS = 80   // セグメント送信間隔

type Ctx = { params: Promise<{ id: string }> | { id: string } }

async function resolveId(ctx: Ctx): Promise<string> {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  return p.id
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const materialId = await resolveId(ctx)

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      function sendEvent(event: string, data: any) {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch {
          // controller already closed
        }
      }

      try {
        // DB接続チェック (SSEエラーとして返す — JSON応答だとEventSourceが即エラーになる)
        if (!process.env.DATABASE_URL) {
          sendEvent('fail', { message: 'データベースに接続できません。管理者にお問い合わせください。' })
          controller.close()
          return
        }

        // 認証
        const { userId } = await getInterviewUser()
        const guestId = !userId ? getGuestIdFromRequest(req) : null

        // 素材取得
        const material = await prisma.interviewMaterial.findUnique({
          where: { id: materialId },
          include: { project: { select: { id: true, userId: true, guestId: true } } },
        })

        if (!material) {
          sendEvent('fail', { message: '素材が見つかりません' })
          controller.close()
          return
        }

        const ownerErr = checkOwnership(material.project, userId, guestId)
        if (ownerErr) {
          sendEvent('fail', { message: 'アクセス権限がありません' })
          controller.close()
          return
        }

        if (material.type !== 'audio' && material.type !== 'video') {
          sendEvent('fail', { message: '文字起こしは音声・動画ファイルのみ対応しています' })
          controller.close()
          return
        }

        if (!material.filePath) {
          sendEvent('fail', { message: 'ファイルがアップロードされていません' })
          controller.close()
          return
        }

        // ゲスト上限チェック
        if (!userId && guestId) {
          const guestLimits = getInterviewGuestLimits()
          const limitSeconds = guestLimits.transcriptionMinutes * 60
          const guestUsage = await prisma.interviewMaterial.aggregate({
            _sum: { duration: true },
            where: { project: { guestId }, status: 'COMPLETED' },
          })
          const usedSeconds = guestUsage._sum.duration || 0
          if (usedSeconds >= limitSeconds) {
            sendEvent('fail', { message: `ゲストユーザーは合計${guestLimits.transcriptionMinutes}分までの文字起こしが可能です。`, limitExceeded: true })
            controller.close()
            return
          }
        }

        const apiKey = process.env.ASSEMBLYAI_API_KEY
        if (!apiKey) {
          sendEvent('fail', { message: 'ASSEMBLYAI_API_KEY が設定されていません' })
          controller.close()
          return
        }

        // メディア情報をクライアントに送信 (再生用)
        try {
          const mediaUrl = await getSignedFileUrl(material.filePath, 3600)
          sendEvent('media', {
            url: mediaUrl,
            type: material.type,       // 'audio' | 'video'
            mimeType: material.mimeType,
            fileName: material.fileName,
          })
        } catch {
          // メディアURL取得失敗は致命的ではない
        }

        // ===== 再接続チェック: 既にPROCESSINGのジョブがあるか =====
        const existingTranscription = await prisma.interviewTranscription.findFirst({
          where: { materialId, status: 'PROCESSING' },
          orderBy: { createdAt: 'desc' },
        })

        let transcription: { id: string }
        let assemblyAiId: string

        if (existingTranscription?.externalJobId) {
          // ===== 再接続: 既存ジョブのポーリングを再開 =====
          transcription = existingTranscription
          assemblyAiId = existingTranscription.externalJobId
          sendEvent('status', { step: 'analyzing', message: '再接続中... 文字起こしを継続します', elapsed: 0, reconnected: true })
        } else {
          // ===== 新規: ジョブを送信 =====

          // 過去ERRORを削除
          await prisma.interviewTranscription.deleteMany({
            where: { materialId, status: 'ERROR' },
          })

          sendEvent('status', { step: 'init', message: '文字起こしを準備中...', elapsed: 0 })

          // DB レコード作成
          transcription = await prisma.interviewTranscription.create({
            data: {
              projectId: material.project.id,
              materialId: material.id,
              text: '',
              status: 'PROCESSING',
              provider: null,
            },
          })
          await prisma.interviewMaterial.update({
            where: { id: materialId },
            data: { status: 'PROCESSING' },
          })

          // 署名付きURL取得
          sendEvent('status', { step: 'fetching', message: 'ファイルを取得中...', elapsed: 0 })
          const fileUrl = await getSignedFileUrl(material.filePath, 3600)

          // AssemblyAI にジョブ送信
          sendEvent('status', { step: 'submitting', message: 'AI音声認識エンジンに送信中...', elapsed: 0 })
          const submitRes = await fetch(`${ASSEMBLYAI_BASE_URL}/transcript`, {
            method: 'POST',
            headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audio_url: fileUrl,
              language_code: 'ja',
              speech_models: ['universal-3-pro', 'universal-2'],
              speaker_labels: true,
            }),
          })

          if (!submitRes.ok) {
            throw new Error(`音声認識エンジンへの送信に失敗しました (${submitRes.status})`)
          }
          const submitData = await submitRes.json()
          if (!submitData.id) throw new Error('トランスクリプトIDが返されませんでした')
          assemblyAiId = submitData.id

          // AssemblyAIジョブIDをDBに保存 (再接続用)
          await prisma.interviewTranscription.update({
            where: { id: transcription.id },
            data: { externalJobId: assemblyAiId },
          })
        }

        // ===== ポーリング =====
        const pollStart = Date.now()
        sendEvent('status', { step: 'analyzing', message: '音声を解析中...', elapsed: 0 })

        let pollResult: any = null
        while (Date.now() - pollStart < MAX_POLL_DURATION_MS) {
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))

          const pollRes = await fetch(`${ASSEMBLYAI_BASE_URL}/transcript/${assemblyAiId}`, {
            headers: { Authorization: apiKey },
          })
          if (!pollRes.ok) throw new Error(`ポーリングエラー (${pollRes.status})`)
          const data = await pollRes.json()
          const elapsed = Math.round((Date.now() - pollStart) / 1000)

          if (data.status === 'completed') {
            pollResult = data
            sendEvent('status', { step: 'converting', message: 'テキストに変換中...', elapsed })
            break
          }

          if (data.status === 'error') {
            throw new Error(data.error || '音声認識に失敗しました')
          }

          // 進捗メッセージ
          let progressMessage = '音声を解析中...'
          if (elapsed > 120) progressMessage = 'もう少しで完了します...'
          else if (elapsed > 60) progressMessage = 'テキストに変換中...'
          else if (elapsed > 30) progressMessage = '音声パターンを認識中...'
          else if (elapsed > 10) progressMessage = '音声データを分析中...'

          sendEvent('status', { step: 'analyzing', message: progressMessage, elapsed })
        }

        if (!pollResult) {
          // タイムアウト — ジョブはAssemblyAI側で継続中
          // クライアントに再接続を促す
          sendEvent('fail', {
            message: '処理に時間がかかっています。自動で再接続します...',
            retryable: true,
          })
          controller.close()
          return
        }

        // ===== セグメント解析 & ストリーム送信 =====
        const segments: TranscriptionSegment[] = []

        if (pollResult.utterances && pollResult.utterances.length > 0) {
          for (let i = 0; i < pollResult.utterances.length; i++) {
            const utt = pollResult.utterances[i]
            const seg: TranscriptionSegment = {
              start: utt.start / 1000,
              end: utt.end / 1000,
              text: utt.text || '',
              speaker: utt.speaker || undefined,
            }
            segments.push(seg)
            sendEvent('segment', { index: i, ...seg })
            await new Promise(r => setTimeout(r, SEGMENT_STREAM_DELAY_MS))
          }
        } else if (pollResult.words && pollResult.words.length > 0) {
          let segStart = pollResult.words[0].start / 1000
          let segText = ''

          for (let i = 0; i < pollResult.words.length; i++) {
            const word = pollResult.words[i]
            segText += word.text
            const isLast = i === pollResult.words.length - 1
            const hasLongPause = !isLast && (pollResult.words[i + 1].start - word.end) > 1000

            if (isLast || hasLongPause) {
              const seg: TranscriptionSegment = {
                start: segStart,
                end: word.end / 1000,
                text: segText.trim(),
                speaker: word.speaker || undefined,
              }
              segments.push(seg)
              sendEvent('segment', { index: segments.length - 1, ...seg })
              await new Promise(r => setTimeout(r, SEGMENT_STREAM_DELAY_MS))
              segText = ''
              if (!isLast) segStart = pollResult.words[i + 1].start / 1000
            }
          }
        }

        const text = pollResult.text || ''
        if (!text) throw new Error('文字起こし結果が空です')

        // ===== DB保存 =====
        let durationSeconds = 0
        if (segments.length > 0) {
          durationSeconds = Math.ceil(segments[segments.length - 1].end)
        }

        await prisma.interviewTranscription.update({
          where: { id: transcription.id },
          data: {
            text,
            segments: segments as any,
            summary: null,
            provider: 'assemblyai',
            confidence: pollResult.confidence ?? null,
            status: 'COMPLETED',
          },
        })

        await prisma.interviewMaterial.update({
          where: { id: materialId },
          data: { status: 'COMPLETED', duration: durationSeconds > 0 ? durationSeconds : null },
        })

        await prisma.interviewProject.update({
          where: { id: material.project.id },
          data: { status: 'EDITING' },
        })

        // 完了イベント
        sendEvent('complete', {
          transcriptionId: transcription.id,
          projectId: material.project.id,
          totalSegments: segments.length,
          durationSeconds,
          durationMinutes: durationSeconds > 0 ? Math.ceil(durationSeconds / 60) : null,
          fullText: text,
        })

        controller.close()
      } catch (err: any) {
        console.error('[interview] transcribe-stream error:', err?.message)

        // DB のステータスをエラーに更新
        try {
          await prisma.interviewMaterial.updateMany({
            where: { id: materialId, status: 'PROCESSING' },
            data: { status: 'ERROR', error: err?.message || '文字起こしに失敗しました' },
          })
          await prisma.interviewTranscription.updateMany({
            where: { materialId, status: 'PROCESSING' },
            data: { status: 'ERROR' },
          })
        } catch {}

        sendEvent('fail', { message: err?.message || '文字起こしに失敗しました' })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
