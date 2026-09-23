import mediaInfoFactory from 'mediainfo.js'
import { getSignedFileUrl } from './storage'

const MAX_RANGE_BYTES = 1024 * 1024
const MAX_INSPECTION_BYTES = 32 * 1024 * 1024
const MAX_INSPECTION_REQUESTS = 64

/** Inspect the stored object itself; browser-provided duration is never an admission authority. */
export async function inspectInterviewMediaDuration(filePath: string, fileSize: bigint | number | null): Promise<number> {
  const size = Number(fileSize)
  if (!Number.isSafeInteger(size) || size <= 0) throw new Error('ファイルの長さを確認できません')

  const signedUrl = await getSignedFileUrl(filePath, 300)
  const expectedOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').origin
  if (new URL(signedUrl).origin !== expectedOrigin) throw new Error('ファイルの参照先を確認できません')

  let totalBytes = 0
  let requests = 0
  const mediaInfo = await mediaInfoFactory({ format: 'object', chunkSize: 256 * 1024 })
  try {
    const result = await mediaInfo.analyzeData(size, async (requested, offset) => {
      if (!Number.isSafeInteger(requested) || !Number.isSafeInteger(offset) || requested < 0 || offset < 0 || offset > size) {
        throw new Error('ファイルの長さを確認できません')
      }
      if (requested === 0 || offset === size) return new Uint8Array()
      if (++requests > MAX_INSPECTION_REQUESTS) throw new Error('ファイルの解析が長すぎます')
      const length = Math.min(requested, MAX_RANGE_BYTES, size - offset)
      if (totalBytes + length > MAX_INSPECTION_BYTES) throw new Error('ファイルの解析が長すぎます')
      const end = offset + length - 1
      const response = await fetch(signedUrl, {
        headers: { Range: `bytes=${offset}-${end}` },
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      })
      const range = response.headers.get('content-range')
      const expectedRange = `bytes ${offset}-${end}/${size}`
      if (response.status !== 206 || range !== expectedRange) {
        await response.body?.cancel()
        throw new Error('ファイルの分割取得に対応していません')
      }
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (bytes.length !== length) throw new Error('ファイルの長さを確認できません')
      totalBytes += bytes.length
      return bytes
    })
    const tracks = result.media?.track || []
    const general = tracks.find(track => track['@type'] === 'General')
    const media = tracks.find(track => track['@type'] === 'Audio' || track['@type'] === 'Video')
    const seconds = Number(general?.Duration || media?.Duration)
    if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('ファイルの長さを確認できません')
    return Math.ceil(seconds)
  } finally {
    mediaInfo.close()
  }
}
