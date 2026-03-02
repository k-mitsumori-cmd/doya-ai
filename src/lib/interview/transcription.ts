// ============================================
// ドヤインタビュー — 文字起こしサービス
// ============================================
// 全ファイルを AssemblyAI REST API で処理
// URL を渡すだけ — サーバーでのダウンロード不要、サイズ無制限
// 話者分離 (speaker diarization) 対応

import { getSignedFileUrl } from './storage'
import type { TranscriptionSegment } from './types'

interface TranscriptionResult {
  text: string
  segments: TranscriptionSegment[]
  summary: string | null
  provider: string
  confidence: number | null
}

const ASSEMBLYAI_BASE_URL = 'https://api.assemblyai.com/v2'

/**
 * 文字起こしを実行
 * Supabase Storage の署名付きURLを AssemblyAI に渡して処理
 */
export async function transcribeFromUrl(opts: {
  storagePath: string
  mimeType: string
  fileSize: number
  language?: string
}): Promise<TranscriptionResult> {
  const { storagePath, fileSize } = opts
  const apiKey = process.env.ASSEMBLYAI_API_KEY
  if (!apiKey) throw new Error('ASSEMBLYAI_API_KEY が設定されていません')

  // Supabase Storage から署名付きURLを取得
  const fileUrl = await getSignedFileUrl(storagePath, 3600)
  const sizeMB = Math.round(fileSize / 1024 / 1024)
  console.log(`[interview] 文字起こし開始: ${sizeMB}MB, mime=${opts.mimeType}`)

  // 1. AssemblyAI にジョブ送信
  const transcriptId = await submitJob(fileUrl, opts.language, apiKey)
  console.log(`[interview] AssemblyAI ジョブ送信完了: id=${transcriptId}`)

  // 2. ポーリングで完了を待つ
  const result = await pollTranscript(transcriptId, apiKey)
  console.log(`[interview] AssemblyAI 完了: duration=${result.audio_duration}s, utterances=${result.utterances?.length || 0}`)

  // 3. 結果をパース
  const segments: TranscriptionSegment[] = []

  if (result.utterances && result.utterances.length > 0) {
    for (const utt of result.utterances) {
      segments.push({
        start: utt.start / 1000,
        end: utt.end / 1000,
        text: utt.text || '',
        speaker: utt.speaker || undefined,
      })
    }
  } else if (result.words && result.words.length > 0) {
    let segStart = result.words[0].start / 1000
    let segText = ''

    for (let i = 0; i < result.words.length; i++) {
      const word = result.words[i]
      segText += word.text

      const isLast = i === result.words.length - 1
      const hasLongPause =
        !isLast && (result.words[i + 1].start - word.end) > 1000

      if (isLast || hasLongPause) {
        segments.push({
          start: segStart,
          end: word.end / 1000,
          text: segText.trim(),
          speaker: word.speaker || undefined,
        })
        segText = ''
        if (!isLast) {
          segStart = result.words[i + 1].start / 1000
        }
      }
    }
  }

  const text = result.text || ''
  if (!text) {
    throw new Error('文字起こし結果が空です。音声ファイルを確認してください。')
  }

  return {
    text,
    segments,
    summary: null,
    provider: 'assemblyai',
    confidence: result.confidence ?? null,
  }
}

/**
 * AssemblyAI にジョブを送信
 */
async function submitJob(
  audioUrl: string,
  language: string | undefined,
  apiKey: string
): Promise<string> {
  const res = await fetch(`${ASSEMBLYAI_BASE_URL}/transcript`, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      language_code: language || 'ja',
      speech_models: ['universal-2'],
      speaker_labels: true,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`AssemblyAI ジョブ送信失敗 (${res.status}): ${errText}`)
  }

  const data = await res.json()
  if (!data.id) {
    throw new Error('AssemblyAI からトランスクリプトIDが返されませんでした')
  }

  return data.id
}

/**
 * ポーリングで完了を待つ
 * 指数バックオフ: 3秒→最大30秒、合計最大10分
 */
async function pollTranscript(
  transcriptId: string,
  apiKey: string,
  maxWaitMs = 10 * 60 * 1000
): Promise<any> {
  const startTime = Date.now()
  let interval = 3000

  while (Date.now() - startTime < maxWaitMs) {
    await new Promise((r) => setTimeout(r, interval))

    const res = await fetch(`${ASSEMBLYAI_BASE_URL}/transcript/${transcriptId}`, {
      headers: { Authorization: apiKey },
    })

    if (!res.ok) {
      throw new Error(`AssemblyAI ポーリング失敗 (${res.status}): ${await res.text()}`)
    }

    const data = await res.json()

    if (data.status === 'completed') return data

    if (data.status === 'error') {
      throw new Error(`AssemblyAI 文字起こし失敗: ${data.error || '不明なエラー'}`)
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000)
    console.log(`[interview] AssemblyAI: status=${data.status}, ${elapsed}s経過`)

    interval = Math.min(interval * 1.5, 30000)
  }

  throw new Error('文字起こしがタイムアウトしました (10分超過)')
}
