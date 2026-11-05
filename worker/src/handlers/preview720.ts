import { join } from 'node:path'
import { ffmpeg, probe, remoteInput } from '../ffmpeg.js'
import { PermanentError } from '../storage.js'
import type { Handler } from './types.js'

// 閲覧用の軽い動画(高さ 720px まで・H.264/AAC・先頭から再生できる MP4)。元より大きくはしない。
const handler: Handler = async ({ inputUrl, workDir, progress }) => {
  progress(0, '入力を確認中')
  const info = await probe(inputUrl)
  if (!info.hasVideo) throw new PermanentError('映像が入っていないファイルです')
  const out = join(workDir, 'preview-720p.mp4')
  const args = [
    ...remoteInput(inputUrl),
    '-map', '0:v:0', ...(info.hasAudio ? ['-map', '0:a:0'] : []),
    '-vf', "scale=-2:'min(720,ih)',format=yuv420p",
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-maxrate', '3M', '-bufsize', '6M',
    ...(info.hasAudio ? ['-c:a', 'aac', '-b:a', '96k', '-ac', '2'] : []),
    '-movflags', '+faststart',
    out,
  ]
  await ffmpeg(args, info.durationSec, (r) => progress(r, '変換中'))
  return {
    outputs: [{ name: 'preview-720p.mp4', localPath: out, contentType: 'video/mp4' }],
    result: { durationSec: info.durationSec, sourceWidth: info.width, sourceHeight: info.height },
  }
}
export default handler
