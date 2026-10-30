import { join } from 'node:path'
import { ffmpeg, probe, remoteInput } from '../ffmpeg.js'
import { PermanentError } from '../storage.js'
import type { Handler, OutputFile } from './types.js'

/**
 * サムネイル(JPEG, 幅 1280px まで)を作る。atSeconds を指定しなければ長さの 10% の位置。
 * count を指定すると、その位置から等間隔に最大8枚。
 * src.remote が true なら署名つきURL(必要な所だけ HTTP Range で読む)、false ならローカルのファイル。
 */
export async function makeThumbnails(opts: {
  src: { remote: boolean; value: string }
  durationSec: number
  count: number
  atSeconds?: number
  workDir: string
  progress: (ratio: number, stage: string) => void
}): Promise<OutputFile[]> {
  const { src, durationSec: dur, workDir } = opts
  const count = Math.min(8, Math.max(1, opts.count))
  const first = typeof opts.atSeconds === 'number' ? opts.atSeconds : Math.min(Math.max(dur * 0.1, 0), Math.max(dur - 0.5, 0))
  const step = count > 1 ? Math.max((dur - first) / count, 1) : 0
  const outputs: OutputFile[] = []
  for (let i = 0; i < count; i++) {
    const at = Math.min(first + step * i, Math.max(dur - 0.1, 0))
    const name = `thumb-${i + 1}.jpg`
    const out = join(workDir, name)
    // -ss を入力の前に置くと、全体を読まずに近くまで飛べる
    const input = src.remote ? remoteInput(src.value) : ['-i', src.value]
    await ffmpeg(['-ss', at.toFixed(2), ...input, '-frames:v', '1', '-vf', "scale='min(1280,iw)':-2", '-q:v', '3', out], 0, () => {})
    outputs.push({ name, localPath: out, contentType: 'image/jpeg' })
    opts.progress((i + 1) / count, 'サムネイルを作成中')
  }
  return outputs
}

const handler: Handler = async ({ job, inputUrl, workDir, progress }) => {
  progress(0, '入力を確認中')
  const info = await probe(inputUrl)
  if (!info.hasVideo) throw new PermanentError('映像が入っていないファイルです')
  const outputs = await makeThumbnails({
    src: { remote: true, value: inputUrl },
    durationSec: info.durationSec,
    count: Number(job.params?.count) || 1,
    atSeconds: typeof job.params?.atSeconds === 'number' ? (job.params.atSeconds as number) : undefined,
    workDir,
    progress,
  })
  return { outputs, result: { durationSec: info.durationSec, width: info.width, height: info.height } }
}
export default handler
