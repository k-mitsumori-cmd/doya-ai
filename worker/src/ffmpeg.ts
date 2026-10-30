import { spawn } from 'node:child_process'
import { config } from './config.js'

export type Probe = { durationSec: number; hasVideo: boolean; hasAudio: boolean; width?: number; height?: number; videoCodec?: string; audioCodec?: string; sizeBytes?: number }

function run(cmd: string, args: string[], onLine?: (line: string) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    let buf = ''
    p.stdout.on('data', (d: Buffer) => {
      const s = d.toString()
      if (onLine) {
        buf += s
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        lines.forEach(onLine)
      } else out += s
    })
    p.stderr.on('data', (d: Buffer) => {
      err = (err + d.toString()).slice(-4000)
    })
    p.on('error', reject)
    p.on('close', (code) => {
      if (code === 0) resolve(out)
      else reject(new Error(`${cmd} が異常終了しました (code ${code}): ${redact(err).slice(-600)}`))
    })
  })
}

/** 署名URLのトークンをエラー文に残さない */
function redact(s: string): string {
  return s.replace(/token=[^&\s"']+/g, 'token=***')
}

export async function probe(input: string): Promise<Probe> {
  const out = await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', input])
  const j = JSON.parse(out) as { format?: { duration?: string; size?: string }; streams?: { codec_type: string; codec_name?: string; width?: number; height?: number }[] }
  const v = j.streams?.find((s) => s.codec_type === 'video')
  const a = j.streams?.find((s) => s.codec_type === 'audio')
  return {
    durationSec: Number(j.format?.duration) || 0,
    hasVideo: !!v,
    hasAudio: !!a,
    width: v?.width,
    height: v?.height,
    videoCodec: v?.codec_name,
    audioCodec: a?.codec_name,
    sizeBytes: j.format?.size ? Number(j.format.size) : undefined,
  }
}

/** ffmpeg を実行し、-progress の出力から 0-1 の進み具合を onProgress に渡す */
export async function ffmpeg(args: string[], durationSec: number, onProgress: (ratio: number) => void): Promise<void> {
  const threads = config.ffmpegThreads()
  const full = ['-hide_banner', '-nostdin', '-y', '-progress', 'pipe:1', '-nostats', ...(threads ? ['-threads', String(threads)] : []), ...args]
  await run('ffmpeg', full, (line) => {
    const m = line.match(/^out_time_(?:us|ms)=(\d+)/)
    if (m && durationSec > 0) {
      // out_time_us(μs) を使う。out_time_ms も実際は μs で出る
      onProgress(Math.min(1, Number(m[1]) / 1e6 / durationSec))
    }
  })
}
