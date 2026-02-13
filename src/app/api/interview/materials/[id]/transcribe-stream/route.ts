// ============================================
// GET /api/interview/materials/[id]/transcribe-stream
// ============================================
// SSE でリアルタイムに文字起こし進捗をストリーミング
// イベント:
//   status  — 処理ステータス (step, message, elapsed)
//   segment — 文字起こしセグメント (index, text, speaker, start, end)
//   complete — 完了通知 (transcriptionId, totalSegments, durationSeconds)
//   error   — エラー通知 (message, hint)

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterviewUser, getGuestIdFromRequest, checkOwnership, requireDatabase } from '@/lib/interview/access'
import { getSignedFileUrl } from '@/lib/interview/storage'
import { getInterviewGuestLimits } from '@/lib/pricing'
import type { TranscriptionSegment } from '@/lib/interview/types'

const ASSEMBLYAI_BASE_URL = 'https://api.assemblyai.com/v2'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

async function resolveId(ctx: Ctx): Promise<string> {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  return p.id
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const dbErr = requireDatabase()
  if (dbErr) return dbErr

  const materialId = await resolveId(ctx)

  // SSE用のReadableStream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      function sendEvent(event: string, data: any) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // 認証
        const { userId } = await getInterviewUser()
        const guestId = !userId ? getGuestIdFromRequest(req) : null

        // 素材取得
        const material = await prisma.interviewMaterial.findUnique({
          where: { id: materialId },
          include: { project: { select: { id: true, userId: true, guestId: true } } },
        })

        if (!material) {
          sendEvent('error', { message: '素材が見つかりません' })
          controller.close()
          return
        }

        const ownerErr = checkOwnership(material.project, userId, guestId)
        if (ownerErr) {
          sendEvent('error', { message: 'アクセス権限がありません' })
          controller.close()
          return
        }

        if (material.type !== 'audio' && material.type !== 'video') {
          sendEvent('error', { message: '文字起こしは音声・動画ファイルのみ対応しています' })
          controller.close()
          return
        }

        if (!material.filePath) {
          sendEvent('error', { message: 'ファイルがアップロードされていません' })
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
            sendEvent('error', { message: `ゲストユーザーは合計${guestLimits.transcriptionMinutes}分までの文字起こしが可能です。`, limitExceeded: true })
            controller.close()
            return
          }
        }

        // 既に処理中のチェック
        const existingProcessing = await prisma.interviewTranscription.findFirst({
          where: { materialId, status: 'PROCESSING' },
        })
        if (existingProcessing) {
          sendEvent('error', { message: '文字起こしは既に処理中です' })
          controller.close()
          return
        }

        // 過去ERRORを削除
        await prisma.interviewTranscription.deleteMany({
          where: { materialId, status: 'ERROR' },
        })

        // ステップ1: 初期化
        sendEvent('status', { step: 'init', message: '文字起こしを準備中...', elapsed: 0 })

        // DB レコード作成
        const transcription = await prisma.interviewTranscription.create({
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

        // ステップ2: 署名付きURL取得
        sendEvent('status', { step: 'fetching', message: 'ファイルを取得中...', elapsed: 0 })

        const apiKey = process.env.ASSEMBLYAI_API_KEY
        if (!apiKey) {
          throw new Error('ASSEMBLYAI_API_KEY が設定されていません')
        }

        const fileUrl = await getSignedFileUrl(material.filePath, 3600)

        // ステップ3: AssemblyAI にジョブ送信
        sendEvent('status', { step: 'submitting', message: 'AI音声認識エンジンに送信中...', elapsed: 0 })

        const submitRes = await fetch(`${ASSEMBLYAI_BASE_URL}/transcript`, {
          method: 'POST',
          headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audio_url: fileUrl,
            language_code: 'ja',
            speech_models: ['universal-2'],
            speaker_labels: true,
          }),
        })
        if (!submitRes.ok) {
          const errText = await submitRes.text()
          throw new Error(`音声認識エンジンへの送信に失敗しました (${submitRes.status})`)
        }
        const submitData = await submitRes.json()
        if (!submitData.id) throw new Error('トランスクリプトIDが返されませんでした')
        const transcriptId = submitData.id

        // ステップ4: ポーリング (進捗をSSEで通知)
        const startTime = Date.now()
        let interval = 3000
        const maxWaitMs = 10 * 60 * 1000

        sendEvent('status', { step: 'analyzing', message: '音声を解析中...', elapsed: 0 })

        let pollResult: any = null
        while (Date.now() - startTime < maxWaitMs) {
          await new Promise((r) => setTimeout(r, interval))

          const pollRes = await fetch(`${ASSEMBLYAI_BASE_URL}/transcript/${transcriptId}`, {
            headers: { Authorization: apiKey },
          })
          if (!pollRes.ok) throw new Error(`ポーリングエラー (${pollRes.status})`)
          const data = await pollRes.json()
          const elapsed = Math.round((Date.now() - startTime) / 1000)

          if (data.status === 'completed') {
            pollResult = data
            sendEvent('status', { step: 'converting', message: 'テキストに変換中...', elapsed })
            break
          }

          if (data.status === 'error') {
            throw new Error(data.error || '音声認識に失敗しました')
          }

          // 進捗を通知
          let progressMessage = '音声を解析中...'
          if (elapsed > 45) progressMessage = 'テキストに変換中...'
          else if (elapsed > 15) progressMessage = '音声パターンを認識中...'
          else if (elapsed > 5) progressMessage = '音声データを分析中...'

          sendEvent('status', { step: 'analyzing', message: progressMessage, elapsed })
          interval = Math.min(interval * 1.5, 30000)
        }

        if (!pollResult) throw new Error('文字起こしがタイムアウトしました (10分超過)')

        // ステップ5: セグメント解析 & ストリーム送信
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
            // セグメントを1つずつストリーム（120ms間隔でリアルタイム感）
            sendEvent('segment', { index: i, ...seg })
            await new Promise(r => setTimeout(r, 120))
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
              await new Promise(r => setTimeout(r, 120))
              segText = ''
              if (!isLast) segStart = pollResult.words[i + 1].start / 1000
            }
          }
        }

        const text = pollResult.text || ''
        if (!text) throw new Error('文字起こし結果が空です')

        // ステップ6: DB保存
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

        // DB のステータスをエラーに更新（可能であれば）
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

        sendEvent('error', { message: err?.message || '文字起こしに失敗しました' })
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
