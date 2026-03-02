// ============================================
// ドヤボイスAI Google Cloud TTS クライアント
// ============================================
// GOOGLE_CLOUD_TTS_API_KEY が未設定の場合はモック実装を使用

export type AudioFormat = 'mp3' | 'wav' | 'ogg' | 'm4a'
export type EmotionTone = 'neutral' | 'bright' | 'calm' | 'serious' | 'gentle'
export type PauseLength = 'short' | 'standard' | 'long' | 'custom'

export interface TtsOptions {
  text: string
  ssml?: string
  speakerId: string
  voiceId: string
  speed: number         // 0.5 ~ 2.0
  pitch: number         // -10 ~ +10
  volume: number        // 0 ~ 100
  outputFormat: AudioFormat
  sampleRateHz?: 22050 | 44100 | 48000
  emotionTone?: EmotionTone
}

export interface TtsResult {
  audioBase64: string
  audioUrl?: string
  durationMs: number
  fileSize: number
  format: AudioFormat
}

// GCP TTS エンコーディングマップ
const ENCODING_MAP: Record<AudioFormat, string> = {
  mp3: 'MP3',
  wav: 'LINEAR16',
  ogg: 'OGG_OPUS',
  m4a: 'MP3', // M4A は MP3 として生成し変換
}

// モック: 約1文字あたり50msとして計算
function estimateDurationMs(text: string, speed: number): number {
  return Math.round((text.length * 50) / speed)
}

// モック用サンプル音声（Base64 の最小MP3ヘッダー相当）
const MOCK_MP3_BASE64 =
  'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA' +
  '//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADhgCenp6e' +
  'np6enp6enp6enp6enp6enp6enp6enp6enp6enp6e////////////////////AAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

/**
 * Google Cloud TTS で音声を生成する
 * GOOGLE_CLOUD_TTS_API_KEY が未設定の場合はモックレスポンスを返す
 */
export async function generateSpeech(options: TtsOptions): Promise<TtsResult> {
  const apiKey = process.env.GOOGLE_CLOUD_TTS_API_KEY

  if (!apiKey) {
    // モック実装
    return generateMockSpeech(options)
  }

  const encoding = ENCODING_MAP[options.outputFormat]
  const sampleRateHz = options.sampleRateHz ?? 44100

  // SSMLが指定されていればSSML入力、なければテキスト入力
  const input = options.ssml
    ? { ssml: options.ssml }
    : { text: options.text }

  const body = {
    input,
    voice: {
      languageCode: 'ja-JP',
      name: options.voiceId,
    },
    audioConfig: {
      audioEncoding: encoding,
      speakingRate: options.speed,
      pitch: options.pitch,
      volumeGainDb: volumeToGainDb(options.volume),
      sampleRateHertz: sampleRateHz,
    },
  }

  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Google TTS API error: ${response.status} ${err}`)
  }

  const data = await response.json()
  const audioBase64: string = data.audioContent

  const audioBuffer = Buffer.from(audioBase64, 'base64')
  const durationMs = estimateDurationMs(options.text, options.speed)

  return {
    audioBase64,
    durationMs,
    fileSize: audioBuffer.length,
    format: options.outputFormat,
  }
}

/**
 * モック音声生成（API Key 未設定時）
 */
async function generateMockSpeech(options: TtsOptions): Promise<TtsResult> {
  // 約50ms/文字 で再生時間を計算
  const durationMs = estimateDurationMs(options.text, options.speed)
  const mockBuffer = Buffer.from(MOCK_MP3_BASE64, 'base64')

  return {
    audioBase64: MOCK_MP3_BASE64,
    durationMs,
    fileSize: mockBuffer.length,
    format: options.outputFormat,
  }
}

/**
 * volume (0-100) を volumeGainDb (-96 ~ 16) に変換
 */
function volumeToGainDb(volume: number): number {
  if (volume <= 0) return -96
  if (volume >= 100) return 0
  // 100% = 0dB, 50% ≈ -6dB, 0% = -96dB (対数スケール)
  return Math.round(20 * Math.log10(volume / 100) * 10) / 10
}

/**
 * テキストの文字数チェック
 */
export function validateTextLength(text: string, maxChars: number): { valid: boolean; charCount: number } {
  const charCount = text.length
  return { valid: charCount <= maxChars, charCount }
}
