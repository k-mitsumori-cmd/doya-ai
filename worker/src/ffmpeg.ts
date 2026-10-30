import { spawn } from 'node:child_process'
import { config } from './config.js'
import { PermanentError } from './storage.js'

// 利用者のファイルは信用しない。HLS・concat などの「別のURLやファイルを読みに行く形式」を使うと、
// ワーカーから内部や任意の宛先へ読みに行かせられる（SSRF）。次の2つで防ぐ。
//  1. 入力に使えるプロトコルを https/tls/tcp だけにする（ローカル試験のみ MEDIA_ALLOW_HTTP=1 で http も許す）
//  2. ffprobe が返す形式名を許可リストと突き合わせ、動画・音声の通常の容器だけを通す
const ALLOWED_FORMATS = new Set(['mov', 'mp4', 'm4a', '3gp', '3g2', 'mj2', 'matroska', 'webm', 'avi', 'flv', 'mpeg', 'mpegts', 'mp3', 'ogg', 'wav', 'flac', 'aac', 'asf', 'ac3', 'amr', 'caf', 'aiff', 'wtv', 'rm', 'm4v', 'mxf', 'gxf', 'nut', 'opus'])
const DENIED_FORMATS = new Set(['hls', 'applehttp', 'concat', 'dash', 'lavfi', 'sdp', 'rtp', 'rtsp', 'image2', 'tee', 'ffmetadata', 'data', 'libgme', 'virtual', 'avs'])

export function remoteProtocolArgs(): string[] {
  return ['-protocol_whitelist', process.env.MEDIA_ALLOW_HTTP === '1' ? 'http,https,tls,tcp' : 'https,tls,tcp']
}
/** 署名つきURLの入力 */
export function remoteInput(url: string): string[] {
  return [...remoteProtocolArgs(), '-i', url]
}
export function assertSafeFormat(formatName: string | undefined): void {
  const names = (formatName || '').split(',').map((n) => n.trim()).filter(Boolean)
  if (names.some((n) => DENIED_FORMATS.has(n)) || !names.some((n) => ALLOWED_FORMATS.has(n))) {
    throw new PermanentError('対応していないファイル形式です')
  }
}

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
      else if (/Invalid data found when processing input|Unsafe file name|Protocol not on whitelist/.test(err)) reject(new PermanentError('動画・音声として読み取れないファイルです'))
      else reject(new Error(`${cmd} が異常終了しました (code ${code}): ${redact(err).slice(-600)}`))
    })
  })
}

/** 署名URLのトークンをエラー文に残さない */
function redact(s: string): string {
  return s.replace(/token=[^&\s"']+/g, 'token=***')
}

export async function probe(input: string, remote = true): Promise<Probe> {
  const out = await run('ffprobe', ['-v', 'error', ...(remote ? remoteProtocolArgs() : []), '-print_format', 'json', '-show_format', '-show_streams', input])
  const j = JSON.parse(out) as { format?: { duration?: string; size?: string; format_name?: string }; streams?: { codec_type: string; codec_name?: string; width?: number; height?: number }[] }
  if (remote) assertSafeFormat(j.format?.format_name)
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
