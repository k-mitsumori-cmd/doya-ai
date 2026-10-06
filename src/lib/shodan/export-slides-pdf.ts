import type { Preparation } from './preparation-response'
import { completeSlideImages } from './complete-slide-images'

const MAX_IMAGE_BYTES = 25 * 1024 * 1024
const MAX_TOTAL_BYTES = 64 * 1024 * 1024
const MAX_PIXELS = 16_777_216
const stopped = () => new Error('PDF処理を中止しました。')
const check = (signal: AbortSignal, current: () => boolean) => { if (signal.aborted || !current()) throw stopped() }
async function bounded<T>(work: (signal: AbortSignal) => Promise<T>, signal: AbortSignal, current: () => boolean, ms: number): Promise<T> {
  check(signal, current)
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let cancel = () => {}
  const stop = new Promise<never>((_, reject) => {
    cancel = () => { controller.abort(); reject(stopped()) }
    signal.addEventListener('abort', cancel, { once: true })
    timer = setTimeout(() => { controller.abort(); reject(new Error('PDF処理が時間内に完了しませんでした。画像を個別に保存するか、再度お試しください。')) }, ms)
  })
  try { return await Promise.race([work(controller.signal), stop]) }
  finally { clearTimeout(timer); signal.removeEventListener('abort', cancel); controller.abort() }
}
async function imageBytes(url: string, signal: AbortSignal, current: () => boolean, remaining: number) {
  return bounded(async activeSignal => {
    const response = await fetch(url, { signal: activeSignal, credentials: 'omit', redirect: 'error', cache: 'no-store' })
    check(activeSignal, current)
    const limit = Math.min(MAX_IMAGE_BYTES, remaining)
    if (!response.ok || !response.body || Number(response.headers.get('content-length')) > limit) {
      void response.body?.cancel().catch(() => {})
      throw new Error('画像を取得できないか、容量の上限を超えています。保存内容を再読み込みしてください。')
    }
    const reader = response.body.getReader(), chunks: Uint8Array[] = []
    let size = 0
    const cancelBody = () => { void reader.cancel().catch(() => {}) }
    activeSignal.addEventListener('abort', cancelBody, { once: true })
    try {
      for (;;) {
        const item = await reader.read(); check(activeSignal, current)
        if (item.done) break
        size += item.value.byteLength
        if (size > limit) throw new Error('PDF用画像の容量が大きすぎます。画像を個別に保存してください。')
        chunks.push(item.value)
      }
    } finally { activeSignal.removeEventListener('abort', cancelBody); void reader.cancel().catch(() => {}) }
    if (!size) throw new Error('画像の内容を確認できませんでした。')
    const bytes = new Uint8Array(size); let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    const format = bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v) ? 'PNG'
      : bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'JPEG'
      : bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0,4)) === 'RIFF' && String.fromCharCode(...bytes.subarray(8,12)) === 'WEBP' ? 'WEBP' : null
    if (!format) throw new Error('画像形式を確認できませんでした。保存内容を再読み込みしてください。')
    return { bytes, format }
  }, signal, current, 30_000)
}
function browserResult<T>(setup: (ok: (value: T) => void, fail: () => void) => () => void, signal: AbortSignal, current: () => boolean): Promise<T> {
  check(signal, current)
  return new Promise((resolve, reject) => {
    let done = false, dispose = () => {}
    const finish = (error?: Error, value?: T) => {
      if (done) return
      done = true; clearTimeout(timer); signal.removeEventListener('abort', abort); dispose()
      if (error) reject(error)
      else if (signal.aborted || !current()) reject(stopped())
      else resolve(value as T)
    }
    const abort = () => finish(stopped())
    const timer = setTimeout(() => finish(new Error('画像の読み込みが時間内に完了しませんでした。')), 10_000)
    signal.addEventListener('abort', abort, { once: true })
    try { dispose = setup(value => finish(undefined, value), () => finish(new Error('画像を読み込めませんでした。保存内容を再読み込みしてください。'))); if (done) dispose() }
    catch { finish(new Error('画像を読み込めませんでした。')) }
  })
}
/** Scoped, bounded assembly; invoking save starts a browser download, not proof of filesystem persistence. */
export async function exportSlidesPdf(prep: Preparation, signal: AbortSignal, current: () => boolean) {
  const images = completeSlideImages(prep.slidesJson, prep.slideImages)
  if (images.length > 50) throw new Error('PDFは一度に50枚までです。画像を個別に保存してください。')
  return bounded(async activeSignal => {
    const { jsPDF } = await import('jspdf'); check(activeSignal, current)
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
    const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight()
    let total = 0
    for (let i = 0; i < images.length; i++) {
      check(activeSignal, current)
      const { bytes, format } = await imageBytes(images[i].imageUrl!, activeSignal, current, MAX_TOTAL_BYTES - total)
      check(activeSignal, current); total += bytes.length
      const mime = format === 'JPEG' ? 'image/jpeg' : format === 'WEBP' ? 'image/webp' : 'image/png'
      const dataUrl = await browserResult<string>((ok, fail) => {
        const reader = new FileReader()
        reader.onload = () => typeof reader.result === 'string' ? ok(reader.result) : fail()
        reader.onerror = fail; reader.onabort = fail
        reader.readAsDataURL(new Blob([bytes], { type: mime }))
        return () => { reader.onload = null; reader.onerror = null; reader.onabort = null; if (reader.readyState === 1) reader.abort() }
      }, activeSignal, current)
      const { w, h } = await browserResult<{ w: number; h: number }>((ok, fail) => {
        const image = new window.Image()
        image.onload = () => ok({ w: image.naturalWidth, h: image.naturalHeight }); image.onerror = fail; image.src = dataUrl
        return () => { image.onload = null; image.onerror = null; image.src = '' }
      }, activeSignal, current)
      check(activeSignal, current)
      if (![w,h].every(n=>Number.isSafeInteger(n)&&n>0) || w*h > MAX_PIXELS) throw new Error('画像サイズが大きすぎるか、画像を確認できませんでした。')
      const ratio = Math.min(pw/w,ph/h), dw=w*ratio, dh=h*ratio
      if (i) doc.addPage()
      doc.addImage(dataUrl, format, (pw-dw)/2, (ph-dh)/2, dw, dh)
    }
    check(activeSignal, current)
    const name = (prep.targetName || 'slides').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'').slice(0,120) || 'slides'
    doc.save(`提案資料_${name}.pdf`)
  }, signal, current, 120_000)
}
