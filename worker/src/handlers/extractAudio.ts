import { join } from 'node:path'
import { ffmpeg, probe } from '../ffmpeg.js'
import { PermanentError } from '../storage.js'
import type { Handler } from './types.js'

// 動画から音声だけを抜き出す(文字起こし用)。モノラル 16kHz で小さくする。
const handler: Handler = async ({ job, inputUrl, workDir, progress }) => {
  progress(0, '入力を確認中')
  const info = await probe(inputUrl)
  if (!info.hasAudio) throw new PermanentError('音声が入っていないファイルです')
  const format = (job.params?.format as string) === 'm4a' ? 'm4a' : 'mp3'
  const out = join(workDir, `audio.${format}`)
  const codec = format === 'm4a' ? ['-c:a', 'aac', '-b:a', '64k'] : ['-c:a', 'libmp3lame', '-b:a', '48k']
  await ffmpeg(['-i', inputUrl, '-vn', '-map', '0:a:0', '-ac', '1', '-ar', '16000', ...codec, ...(format === 'm4a' ? ['-movflags', '+faststart'] : []), out], info.durationSec, (r) =>
    progress(r, '音声を抜き出し中')
  )
  return {
    outputs: [{ name: `audio.${format}`, localPath: out, contentType: format === 'm4a' ? 'audio/mp4' : 'audio/mpeg' }],
    result: { durationSec: info.durationSec, audioCodec: info.audioCodec },
  }
}
export default handler
