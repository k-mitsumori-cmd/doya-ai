import extractAudio from './extractAudio.js'
import thumbnail from './thumbnail.js'
import preview720 from './preview720.js'
import type { Handler } from './types.js'

// 種類を足すときは、ここに登録し、Next.js 側の src/lib/media-jobs/kinds.ts にも同じ名前を足す
export const handlers: Record<string, Handler> = {
  extract_audio: extractAudio,
  thumbnail,
  preview_720p: preview720,
}
