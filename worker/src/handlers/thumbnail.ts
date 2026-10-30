import { join } from 'node:path'
import { ffmpeg, probe } from '../ffmpeg.js'
import { PermanentError } from '../storage.js'
import type { Handler } from './types.js'

// サムネイル(JPEG, 幅 1280px まで)。atSeconds を指定しなければ長さの 10% の位置。
// count を指定すると、その位置から等間隔に最大8枚。
const handler: Handler = async ({ job, inputUrl, workDir, progress }) => {
  progress(0, '入力を確認中')
  const info = await probe(inputUrl)
  if (!info.hasVideo) throw new PermanentError('映像が入っていないファイルです')
  const count = Math.min(8, Math.max(1, Number(job.params?.count) || 1))
  const dur = info.durationSec
  const first = typeof job.params?.atSeconds === 'number' ? (job.params.atSeconds as number) : Math.min(Math.max(dur * 0.1, 0), Math.max(dur - 0.5, 0))
  const step = count > 1 ? Math.max((dur - first) / count, 1) : 0
  const outputs = []
  for (let i = 0; i < count; i++) {
    const at = Math.min(first + step * i, Math.max(dur - 0.1, 0))
    const name = `thumb-${i + 1}.jpg`
    const out = join(workDir, name)
    // -ss を入力の前に置くと、全体を読まずに近くまで飛べる
    await ffmpeg(['-ss', at.toFixed(2), '-i', inputUrl, '-frames:v', '1', '-vf', "scale='min(1280,iw)':-2", '-q:v', '3', out], 0, () => {})
    outputs.push({ name, localPath: out, contentType: 'image/jpeg' })
    progress((i + 1) / count, 'サムネイルを作成中')
  }
  return { outputs, result: { durationSec: dur, width: info.width, height: info.height } }
}
export default handler
