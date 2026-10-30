import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { checkpoint } from '../db.js'
import { PermanentError } from '../storage.js'
import type { Handler } from './types.js'

// 文字起こし(AssemblyAI)。入力は音声ファイル(出力バケットの audio.mp3 など)。
// ⚠️ 有料の API。呼び出しは「利用者の枠・月の上限」を確かめた呼び出し側が transcribe: true / kind: 'transcribe' で依頼したときだけ。
// 二重課金を避けるため、AssemblyAI の ID を送信直後に DB へ保存し、再試行ではその ID を待つだけにする。
const BASE = () => (process.env.ASSEMBLYAI_BASE_URL || 'https://api.assemblyai.com/v2').replace(/\/$/, '')
const MAX_WAIT_MS = 3 * 3600_000

type Utterance = { start: number; end: number; text?: string; speaker?: string }

const handler: Handler = async ({ job, inputUrl, workDir, progress }) => {
  const key = process.env.ASSEMBLYAI_API_KEY
  if (!key) throw new PermanentError('ASSEMBLYAI_API_KEY が設定されていません')
  const headers = { authorization: key, 'content-type': 'application/json' }

  let id = typeof job.result?.assemblyId === 'string' ? (job.result.assemblyId as string) : ''
  if (!id) {
    progress(0, '文字起こしを依頼中')
    const res = await fetch(`${BASE()}/transcript`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ audio_url: inputUrl, language_code: typeof job.params?.language === 'string' ? job.params.language : 'ja', speech_models: ['universal-2'], speaker_labels: true }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) {
      // 送信できなかった=課金されていない。4xx は入力や設定の問題なので再試行しない
      throw res.status >= 400 && res.status < 500 && res.status !== 429 ? new PermanentError(`文字起こしの依頼が受け付けられませんでした (${res.status})`) : new Error(`文字起こしの依頼に失敗しました (${res.status})`)
    }
    const data = (await res.json()) as { id?: string }
    if (typeof data.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(data.id)) throw new Error('文字起こしのIDが返りませんでした')
    id = data.id
    await checkpoint(job.id, { assemblyId: id })
  }

  const start = Date.now()
  let wait = 3000
  for (;;) {
    const res = await fetch(`${BASE()}/transcript/${id}`, { headers, signal: AbortSignal.timeout(20_000) })
    if (res.ok) {
      const t = (await res.json()) as { status: string; error?: string; text?: string; confidence?: number; audio_duration?: number; utterances?: Utterance[] }
      if (t.status === 'completed') {
        if (!t.text) throw new PermanentError('文字起こしの結果が空でした')
        const segments = (t.utterances ?? []).map((u) => ({ start: u.start / 1000, end: u.end / 1000, text: u.text || '', speaker: u.speaker }))
        const out = join(workDir, 'transcript.json')
        await writeFile(out, JSON.stringify({ text: t.text, segments, confidence: t.confidence ?? null, durationSec: t.audio_duration ?? null, provider: 'assemblyai' }))
        return { outputs: [{ name: 'transcript.json', localPath: out, contentType: 'application/json' }], result: { assemblyId: id, chars: t.text.length, durationSec: t.audio_duration ?? null } }
      }
      if (t.status === 'error') throw new PermanentError('文字起こしサービスが処理に失敗しました')
    } else if (res.status >= 400 && res.status < 500 && res.status !== 429) {
      throw new PermanentError(`文字起こしの状態を取得できません (${res.status})`)
    }
    if (Date.now() - start > MAX_WAIT_MS) throw new Error('文字起こしが時間内に終わりませんでした')
    progress(Math.min(0.9, (Date.now() - start) / MAX_WAIT_MS * 8), '文字起こし中')
    await new Promise((r) => setTimeout(r, wait))
    wait = Math.min(wait * 1.5, 30_000)
  }
}
export default handler
