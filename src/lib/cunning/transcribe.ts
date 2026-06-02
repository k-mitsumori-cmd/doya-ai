// ============================================
// ドヤカンニング 文字起こし（near-realtime）
// ============================================
// MVPは「短い音声チャンク（数秒）をOpenAI音声書き起こしAPIにPOST」する near-realtime 方式。
// Google Cloud STT streaming はVercel ServerlessでWSを保持できないため、Phase 2で
// クライアント↔STTプロバイダ直結（短期トークン）に置き換える前提（reference/services/cunning.md）。
import { withTimeout } from '@/lib/fetch-timeout'

const OPENAI_TRANSCRIBE_ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions'
// gpt-4o-transcribe は低レイテンシ・高精度。未対応環境向けに whisper-1 へ切替可能。
const TRANSCRIBE_MODEL = process.env.CUNNING_TRANSCRIBE_MODEL || 'gpt-4o-transcribe'

export interface TranscribeResult {
  text: string
  model: string
}

/** 音声チャンク（webm/mp4等）を日本語で文字起こし。空文字＝無音/雑音。 */
export async function transcribeChunk(
  audio: Blob,
  opts: { filename?: string; language?: string } = {}
): Promise<TranscribeResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY が設定されていません')

  const timeoutMs = Number(process.env.CUNNING_TRANSCRIBE_TIMEOUT_MS) || 30000

  return withTimeout(`${TRANSCRIBE_MODEL} transcribe`, timeoutMs, async (signal) => {
    const form = new FormData()
    form.append('file', audio, opts.filename || 'chunk.webm')
    form.append('model', TRANSCRIBE_MODEL)
    form.append('language', opts.language || 'ja')
    // 文章単位のテキストのみで十分（タイムスタンプ不要）
    form.append('response_format', 'json')

    const res = await fetch(OPENAI_TRANSCRIBE_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal,
    })
    if (!res.ok) {
      throw new Error(`transcribe failed (${res.status}): ${(await res.text()).slice(0, 200)}`)
    }
    const json = await res.json()
    return { text: (json?.text || '').trim(), model: TRANSCRIBE_MODEL }
  })
}
