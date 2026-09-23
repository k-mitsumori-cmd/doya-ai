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
import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { getInterviewUser, getGuestIdFromRequest, checkOwnership } from '@/lib/interview/access'
import { getSignedFileUrl } from '@/lib/interview/storage'
import { getInterviewGuestLimits } from '@/lib/pricing'
import { inspectInterviewMediaDuration } from '@/lib/interview/media-duration'
import { reserveInterviewTranscription, settleInterviewTranscription, releaseInterviewTranscription } from '@/lib/interview/transcription-budget'
import type { TranscriptionSegment } from '@/lib/interview/types'

const ASSEMBLYAI_BASE_URL = 'https://api.assemblyai.com/v2'

// ポーリング設定 — Vercelの5分制限内に保存処理の時間を残す
// ※ 1回の文字起こし上限: 約3時間（180分）
//   POLL_INTERVAL=5s × MAX_POLL_DURATION=3m30s/回 × 自動再接続最大10回 ≒ 35分のポーリング
//   AssemblyAI処理速度（実時間の1/4〜1/5）→ 約3時間が実質上限
const POLL_INTERVAL_MS = 5000        // 固定5秒間隔 (バックオフしない)
const MAX_POLL_DURATION_MS = 210_000 // 3分30秒。大量のセグメントとDB保存に時間を残す

type Ctx = { params: Promise<{ id: string }> }

async function resolveId(ctx: Ctx): Promise<string> {
  const p = await ctx.params
  return p.id
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const materialId = await resolveId(ctx)

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const quotaEnabled = process.env.INTERVIEW_TRANSCRIPTION_QUOTA_ENABLED === '1'
      let budgetTranscriptionId: string | null = null
      let terminalFailure = false
      let ambiguousSubmission = false

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
        const { userId, plan } = await getInterviewUser()
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

        if (!material.filePath || !material.fileUrl) {
          sendEvent('fail', { message: 'アップロードの完了を確認できません。素材一覧から再確認してください。' })
          controller.close()
          return
        }

        // ゲスト上限チェック
        if (!quotaEnabled && !userId && guestId) {
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

        if (quotaEnabled) {
          let mediaSeconds: number
          try {
            mediaSeconds = await inspectInterviewMediaDuration(material.filePath, material.fileSize)
          } catch {
            sendEvent('fail', { message: '音声の長さを確認できません。対応形式のファイルで再試行してください。', code: 'MEDIA_DURATION_UNAVAILABLE' })
            controller.close()
            return
          }
          const admission = await reserveInterviewTranscription({ userId, guestId, plan }, { id: materialId, projectId: material.project.id }, mediaSeconds)
          if (admission.state === 'limit') {
            sendEvent('fail', { message: '今月の文字起こし残り時間を超えるファイルです。', code: 'TRANSCRIPTION_LIMIT', limitExceeded: true, upgradePath: '/interview/pricing' })
            controller.close()
            return
          }
          if (admission.state === 'too-long') {
            sendEvent('fail', { message: `1回の文字起こしは${Math.ceil(admission.maxSeconds / 60)}分までです。`, code: 'TRANSCRIPTION_TOO_LONG' })
            controller.close()
            return
          }
          if (admission.state === 'unavailable') {
            sendEvent('fail', { message: '文字起こしの利用状況を確認できません。しばらくしてから再試行してください。' })
            controller.close()
            return
          }
          if (admission.state === 'completed') {
            const completed = await prisma.interviewTranscription.findUnique({ where: { id: admission.transcriptionId }, select: { text: true } })
            sendEvent('complete', { transcriptionId: admission.transcriptionId, projectId: material.project.id,
              totalSegments: 0, durationSeconds: material.duration || 0, durationMinutes: Math.ceil((material.duration || 0) / 60), fullText: completed?.text || '' })
            controller.close()
            return
          }
          budgetTranscriptionId = admission.transcriptionId
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

        if (quotaEnabled && existingTranscription?.externalJobId?.startsWith('submitting:')) {
          // A provider request may have succeeded before the worker could save its ID.
          // Never submit a duplicate job or silently release its reserved allowance.
          sendEvent('fail', { message: '送信状態を確認できません。サポートにお問い合わせください。', code: 'TRANSCRIPTION_SUBMISSION_UNKNOWN' })
          controller.close()
          return
        }

        if (existingTranscription?.externalJobId) {
          // ===== 再接続: 既存ジョブのポーリングを再開 =====
          transcription = existingTranscription
          assemblyAiId = existingTranscription.externalJobId
          sendEvent('status', { step: 'analyzing', message: '再接続中... 文字起こしを継続します', elapsed: 0, reconnected: true })
        } else {
          // ===== 新規: ジョブを送信 =====
          let submissionMarker: string | null = null

          // 過去ERRORを削除
          if (!quotaEnabled) await prisma.interviewTranscription.deleteMany({ where: { materialId, status: 'ERROR' } })

          sendEvent('status', { step: 'init', message: '文字起こしを準備中...', elapsed: 0 })

          // DB レコード作成
          if (quotaEnabled) {
            if (!existingTranscription || existingTranscription.id !== budgetTranscriptionId) throw new Error('Transcription reservation mismatch')
            transcription = existingTranscription
            submissionMarker = `submitting:${randomUUID()}`
            const claimed = await prisma.interviewTranscription.updateMany({
              where: { id: transcription.id, status: 'PROCESSING', externalJobId: null },
              data: { externalJobId: submissionMarker },
            })
            if (claimed.count !== 1) {
              sendEvent('fail', { message: '別の接続で文字起こしを開始しています。', retryable: true })
              controller.close()
              return
            }
            assemblyAiId = submissionMarker
          } else {
            transcription = await prisma.interviewTranscription.create({
              data: { projectId: material.project.id, materialId: material.id, text: '', status: 'PROCESSING', provider: null },
            })
            await prisma.interviewMaterial.update({ where: { id: materialId }, data: { status: 'PROCESSING' } })
          }

          // 署名付きURL取得
          sendEvent('status', { step: 'fetching', message: 'ファイルを取得中...', elapsed: 0 })
          let fileUrl: string
          try {
            fileUrl = await getSignedFileUrl(material.filePath, 3600)
          } catch (error) {
            terminalFailure = true
            throw error
          }

          // AssemblyAI にジョブ送信
          sendEvent('status', { step: 'submitting', message: 'AI音声認識エンジンに送信中...', elapsed: 0 })
          ambiguousSubmission = quotaEnabled
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
            ambiguousSubmission = false
            terminalFailure = true
            throw new Error(`音声認識エンジンへの送信に失敗しました (${submitRes.status})`)
          }
          const submitData = await submitRes.json()
          if (!submitData.id) throw new Error('トランスクリプトIDが返されませんでした')
          assemblyAiId = submitData.id

          // AssemblyAIジョブIDをDBに保存 (再接続用)
          const saved = quotaEnabled
            ? await prisma.interviewTranscription.updateMany({
                where: { id: transcription.id, status: 'PROCESSING', externalJobId: submissionMarker },
                data: { externalJobId: assemblyAiId },
              })
            : await prisma.interviewTranscription.update({
                where: { id: transcription.id }, data: { externalJobId: assemblyAiId },
              })
          if (quotaEnabled && 'count' in saved && saved.count !== 1) {
            throw new Error('Transcription job ID persistence failed')
          }
          ambiguousSubmission = false
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
            terminalFailure = true
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
              segText = ''
              if (!isLast) segStart = pollResult.words[i + 1].start / 1000
            }
          }
        }

        const text = pollResult.text || ''
        if (!text) { terminalFailure = true; throw new Error('文字起こし結果が空です') }

        // ===== DB保存 =====
        let durationSeconds = 0
        if (segments.length > 0) {
          durationSeconds = Math.ceil(segments[segments.length - 1].end)
        }

        await prisma.$transaction(async tx => {
          if (quotaEnabled) await settleInterviewTranscription(tx, materialId, transcription.id)
          await tx.interviewTranscription.update({
            where: { id: transcription.id },
            data: { text, segments: segments as any, summary: null, provider: 'assemblyai',
              confidence: pollResult.confidence ?? null, status: 'COMPLETED' },
          })
          await tx.interviewMaterial.update({ where: { id: materialId }, data: { status: 'COMPLETED', duration: durationSeconds > 0 ? durationSeconds : null } })
          await tx.interviewProject.update({ where: { id: material.project.id }, data: { status: 'EDITING' } })
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
        console.error('[interview] transcribe-stream error')

        if (quotaEnabled && budgetTranscriptionId) {
          const completed = await prisma.interviewTranscription.findUnique({
            where: { id: budgetTranscriptionId }, select: { status: true, text: true },
          }).catch(() => null)
          if (completed?.status === 'COMPLETED') {
            sendEvent('complete', { transcriptionId: budgetTranscriptionId, projectId: null,
              totalSegments: 0, durationSeconds: 0, durationMinutes: null, fullText: completed.text })
            controller.close()
            return
          }
        }

        if (ambiguousSubmission) {
          sendEvent('fail', { message: '送信状態を確認できません。サポートにお問い合わせください。', code: 'TRANSCRIPTION_SUBMISSION_UNKNOWN' })
          controller.close()
          return
        }

        if (quotaEnabled && !terminalFailure) {
          sendEvent('fail', { message: '処理の確認中に接続が途切れました。再接続して状態を確認します。', retryable: true })
          controller.close()
          return
        }

        // DB のステータスをエラーに更新
        try {
          await prisma.$transaction(async tx => {
            if (quotaEnabled && budgetTranscriptionId) await releaseInterviewTranscription(tx, materialId, budgetTranscriptionId)
            await tx.interviewMaterial.updateMany({ where: { id: materialId, status: 'PROCESSING' }, data: { status: 'ERROR', error: '文字起こしに失敗しました。時間をおいて再試行してください。' } })
            await tx.interviewTranscription.updateMany({ where: { materialId, status: 'PROCESSING' }, data: { status: 'ERROR' } })
          })
        } catch {}

        sendEvent('fail', { message: '文字起こしに失敗しました。時間をおいて再試行してください。' })
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
