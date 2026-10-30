import { join } from 'node:path'
import { config } from '../config.js'
import { ffmpeg, probe, remoteInput } from '../ffmpeg.js'
import { PermanentError } from '../storage.js'
import { makeThumbnails } from './thumbnail.js'
import type { Handler, OutputFile } from './types.js'

// 音声の抜き出し・720p の軽い動画・サムネイルを、入力を1回だけ読んでまとめて作る。
// 入力(数GB)を Supabase から読む量を、3種類を別々に流す場合の約1/2〜1/3にするための処理。
//  - 1回の ffmpeg で「音声」と「720p」の2つの出力を同時に書く(入力の読み込みは1回)
//  - サムネイルは、できた 720p のファイル(手元)から作る。ネットワークは使わない
//  - params: { format: 'mp3'|'m4a', preview: boolean(既定 true), thumbnails: number(既定 1, 0〜8),
//              atSeconds?: number, transcribe: boolean(既定 false) }
// 音声が無い動画は音声を作らず、映像が無いファイルは音声だけを作る(失敗にはしない)。
const handler: Handler = async ({ job, inputUrl, workDir, progress }) => {
  progress(0, '入力を確認中')
  const p = job.params ?? {}
  const format = p.format === 'm4a' ? 'm4a' : 'mp3'
  const wantPreview = p.preview !== false
  const thumbCount = p.thumbnails === undefined ? 1 : Math.min(8, Math.max(0, Number(p.thumbnails) || 0))
  const info = await probe(inputUrl)
  if (!info.hasAudio && !info.hasVideo) throw new PermanentError('音声も映像も入っていないファイルです')

  const outputs: OutputFile[] = []
  const args: string[] = [...remoteInput(inputUrl)]

  let audioPath: string | undefined
  if (info.hasAudio) {
    audioPath = join(workDir, `audio.${format}`)
    const codec = format === 'm4a' ? ['-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart'] : ['-c:a', 'libmp3lame', '-b:a', '48k']
    args.push('-map', '0:a:0', '-vn', '-ac', '1', '-ar', '16000', ...codec, audioPath)
    outputs.push({ name: `audio.${format}`, localPath: audioPath, contentType: format === 'm4a' ? 'audio/mp4' : 'audio/mpeg' })
  }

  let previewPath: string | undefined
  if (info.hasVideo && wantPreview) {
    previewPath = join(workDir, 'preview-720p.mp4')
    args.push(
      '-map', '0:v:0', ...(info.hasAudio ? ['-map', '0:a:0'] : []),
      '-vf', "scale=-2:'min(720,ih)',format=yuv420p",
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-maxrate', '3M', '-bufsize', '6M',
      ...(info.hasAudio ? ['-c:a', 'aac', '-b:a', '96k', '-ac', '2'] : []),
      '-movflags', '+faststart', previewPath
    )
    outputs.push({ name: 'preview-720p.mp4', localPath: previewPath, contentType: 'video/mp4' })
  }

  const thumbsWillRun = info.hasVideo && thumbCount > 0
  const encodeShare = thumbsWillRun ? 0.92 : 1
  if (outputs.length > 0) {
    await ffmpeg(args, info.durationSec, (r) => progress(r * encodeShare, previewPath ? '音声と軽い動画を作成中' : '音声を抜き出し中'))
  }

  if (thumbsWillRun) {
    // 720p があればそこから(手元のファイル)、無ければ元の動画から必要な所だけ読む
    const src = previewPath ? { remote: false, value: previewPath } : { remote: true, value: inputUrl }
    const dur = previewPath ? (await probe(previewPath, false)).durationSec || info.durationSec : info.durationSec
    outputs.push(
      ...(await makeThumbnails({
        src, durationSec: dur, count: thumbCount, atSeconds: typeof p.atSeconds === 'number' ? p.atSeconds : undefined, workDir,
        progress: (r, s) => progress(encodeShare + r * (1 - encodeShare), s),
      }))
    )
  }

  const followUps =
    p.transcribe === true && audioPath
      ? [{ kind: 'transcribe', inputBucket: config.outputBucket(), inputPath: `${job.userId}/${job.id}/audio.${format}`, params: { language: typeof p.language === 'string' ? p.language : 'ja' }, dedupeKey: `transcribe:${job.id}` }]
      : []

  return {
    outputs,
    result: { durationSec: info.durationSec, width: info.width, height: info.height, hasAudio: info.hasAudio, hasVideo: info.hasVideo, preview: !!previewPath, thumbnails: thumbsWillRun ? thumbCount : 0 },
    followUps,
  }
}
export default handler
