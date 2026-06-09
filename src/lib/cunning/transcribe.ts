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

/** 音声チャンク（webm/mp4等）を文字起こし。language=ja(既定)/en/auto。空文字＝無音/雑音。 */
export async function transcribeChunk(
  audio: Blob,
  opts: { filename?: string; language?: string } = {}
): Promise<TranscribeResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY が設定されていません')

  const timeoutMs = Number(process.env.CUNNING_TRANSCRIBE_TIMEOUT_MS) || 30000
  // ja(既定) / en / auto。auto は言語ヒントなしで自動判定。
  const language = opts.language === 'en' ? 'en' : opts.language === 'auto' ? 'auto' : 'ja'
  const filename = opts.filename || 'chunk.webm'
  // gpt-4o-transcribe は language ヒントが弱く、短い無音/雑音チャンクで英語へドリフトしやすい。
  // 言語に合わせた prompt を与えて出力スクリプトをバイアスし、誤って英語に固定されるのを防ぐ。
  const biasPrompt =
    language === 'en'
      ? 'The following is a business conversation in English.'
      : language === 'auto'
        ? ''
        : '以下は日本語のビジネス会話の文字起こしです。日本語で出力してください。'

  const callModel = (model: string) =>
    withTimeout(`${model} transcribe`, timeoutMs, async (signal) => {
      const form = new FormData()
      form.append('file', audio, filename)
      form.append('model', model)
      // auto は言語ヒントを付けない（自動判定に委ねる）
      if (language !== 'auto') form.append('language', language)
      if (biasPrompt) form.append('prompt', biasPrompt)
      form.append('response_format', 'json') // 文章単位のテキストのみで十分
      const res = await fetch(OPENAI_TRANSCRIBE_ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal,
      })
      if (!res.ok) {
        const body = (await res.text()).slice(0, 300)
        const err: any = new Error(`transcribe failed (${res.status}): ${body}`)
        err.status = res.status
        err.body = body
        throw err
      }
      const json = await res.json()
      return { text: (json?.text || '').trim(), model }
    })

  try {
    return await callModel(TRANSCRIBE_MODEL)
  } catch (e: any) {
    // gpt-4o-transcribe が当該キーで未対応(モデル不明/権限)だと全チャンクが失敗し機能停止する。
    // モデル起因のエラーに限り whisper-1 へ自動フォールバック。
    const modelIssue =
      e?.status === 404 ||
      e?.status === 400 ||
      /model|does not exist|not found|unsupported/i.test(e?.body || e?.message || '')
    if (TRANSCRIBE_MODEL !== 'whisper-1' && modelIssue) {
      console.warn('[cunning/transcribe] %s 失敗、whisper-1にフォールバック', TRANSCRIBE_MODEL)
      return await callModel('whisper-1')
    }
    throw e
  }
}
