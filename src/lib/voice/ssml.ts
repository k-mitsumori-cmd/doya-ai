// ============================================
// ドヤボイスAI SSML 自動生成・変換ロジック
// ============================================

import type { EmotionTone, PauseLength } from './tts'

export interface SsmlOptions {
  text: string
  speed: number
  pitch: number
  pauseLength: PauseLength
  emotionTone: EmotionTone
  customPauseMs?: number
}

// 感情トーン → SSML prosody パラメータ
const EMOTION_PROSODY: Record<EmotionTone, { rate?: string; pitch?: string }> = {
  neutral: {},
  bright:  { rate: 'fast', pitch: '+2st' },
  calm:    { rate: 'slow', pitch: '-1st' },
  serious: { rate: 'medium', pitch: '-2st' },
  gentle:  { rate: 'medium', pitch: '+1st' },
}

// 句読点 → SSML break タグの休止時間
const PAUSE_MS: Record<PauseLength, { comma: number; period: number }> = {
  short:    { comma: 100, period: 300 },
  standard: { comma: 200, period: 500 },
  long:     { comma: 400, period: 800 },
  custom:   { comma: 200, period: 500 }, // customPauseMsで上書き
}

/**
 * プレーンテキストを SSML に変換する
 * - 句読点 (、。) → <break> タグ
 * - **太字** → <emphasis> タグ
 * - ... (三点リーダー) → <break time="500ms"/>
 * - 数字の読み → <sub> タグ（簡易実装）
 */
export function textToSsml(options: SsmlOptions): string {
  const { text, speed, pitch, pauseLength, emotionTone, customPauseMs } = options

  const pauseMs =
    pauseLength === 'custom' && customPauseMs
      ? { comma: Math.round(customPauseMs * 0.5), period: customPauseMs }
      : PAUSE_MS[pauseLength]

  // 1. 太字マークダウンを emphasis に変換
  let processed = text.replace(/\*\*(.+?)\*\*/g, '<emphasis level="strong">$1</emphasis>')

  // 2. 三点リーダーを break に変換
  processed = processed.replace(/\.\.\./g, `<break time="500ms"/>`)
  processed = processed.replace(/…/g, `<break time="500ms"/>`)

  // 3. 句読点に break を挿入
  processed = processed.replace(/、/g, `、<break time="${pauseMs.comma}ms"/>`)
  processed = processed.replace(/。/g, `。<break time="${pauseMs.period}ms"/>`)
  processed = processed.replace(/！/g, `！<break time="${pauseMs.period}ms"/>`)
  processed = processed.replace(/？/g, `？<break time="${pauseMs.period}ms"/>`)

  // 4. 改行を break に変換
  processed = processed.replace(/\n\n+/g, `<break time="800ms"/>`)
  processed = processed.replace(/\n/g, `<break time="${pauseMs.period}ms"/>`)

  // 5. prosody タグでラップ（話速・ピッチ）
  const emotionParams = EMOTION_PROSODY[emotionTone]
  const prosodyAttrs: string[] = []

  const rateStr = emotionParams.rate || speedToSsmlRate(speed)
  prosodyAttrs.push(`rate="${rateStr}"`)

  const pitchStr = emotionParams.pitch || pitchToSsmlPitch(pitch)
  prosodyAttrs.push(`pitch="${pitchStr}"`)

  const ssmlBody = `<prosody ${prosodyAttrs.join(' ')}>${processed}</prosody>`

  return `<speak>${ssmlBody}</speak>`
}

/**
 * 数値の話速 (0.5-2.0) を SSML rate 文字列に変換
 */
function speedToSsmlRate(speed: number): string {
  if (speed <= 0.6) return 'x-slow'
  if (speed <= 0.8) return 'slow'
  if (speed <= 1.1) return 'medium'
  if (speed <= 1.4) return 'fast'
  return 'x-fast'
}

/**
 * 数値のピッチ (-10 ~ +10) を SSML pitch 文字列に変換
 */
function pitchToSsmlPitch(pitch: number): string {
  if (pitch === 0) return '+0st'
  return `${pitch > 0 ? '+' : ''}${pitch}st`
}

/**
 * SSML を検証する（簡易タグチェック）
 */
export function validateSsml(ssml: string): { valid: boolean; error?: string } {
  if (!ssml.trim().startsWith('<speak>')) {
    return { valid: false, error: '<speak> タグで開始してください' }
  }
  if (!ssml.trim().endsWith('</speak>')) {
    return { valid: false, error: '</speak> タグで終了してください' }
  }
  // タグの対応チェック（簡易）
  const openTags = (ssml.match(/<[a-z]/g) || []).length
  const closeTags = (ssml.match(/<\/[a-z]|\/>/g) || []).length
  if (Math.abs(openTags - closeTags) > 2) {
    return { valid: false, error: 'タグが正しく閉じられていない可能性があります' }
  }
  return { valid: true }
}
