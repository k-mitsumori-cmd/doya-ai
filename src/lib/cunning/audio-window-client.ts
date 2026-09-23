type Speaker = 'remote' | 'self'
type Language = 'ja' | 'en' | 'auto'
type Result = { text: string; transcriptId: string }
type Finalized = { state: 'complete'; finalTranscripts: { speaker: Speaker; transcriptId: string; sequence: number }[] }
export type AudioWindowHandle = { readonly key: string; readonly speaker: Speaker }
type Entry = {
  handle: AudioWindowHandle; windowId?: string; sequence?: number; capturing: boolean
  payload?: { audio: Blob | null; language: Language }; result?: Result
  reservation?: Promise<void>; upload?: Promise<void>; discarded: boolean; delivered: boolean; failed: boolean
}
export class AudioWindowError extends Error {
  constructor(message: string, readonly code?: string, readonly status?: number) { super(message); this.name = 'AudioWindowError' }
}

/** Page-local retry ownership. Reserve ahead of capture, then retain the exact
 * Blob/language until saved. Call stop immediately when media stops; finish only
 * after every MediaRecorder.onstop has submitted its captured data.
 */
export function createAudioWindowClient(sessionId: string, recordingToken: string, options: {
  onResult: (result: Result & { speaker: Speaker; sequence: number }) => void
  onChange?: () => void
  fetch?: typeof fetch
  requestKey?: () => string
  schedule?: typeof setTimeout
  cancel?: typeof clearTimeout
}) {
  const request = options.fetch ?? fetch
  const schedule = options.schedule ?? setTimeout, cancel = options.cancel ?? clearTimeout
  const entries: Entry[] = []
  const tails: Record<Speaker, Promise<void>> = { remote: Promise.resolve(), self: Promise.resolve() }
  const base = `/api/cunning/sessions/${encodeURIComponent(sessionId)}/audio-windows`
  let stopped = false, finalizing: Promise<Finalized> | undefined
  let deliveryFailed = false, finalizeFailed = false
  const changed = () => options.onChange?.()
  const entryFor = (handle: AudioWindowHandle) => {
    const entry = entries.find(e => e.handle === handle)
    if (!entry) throw new Error('Unknown audio window')
    return entry
  }
  async function send(url: string, init: RequestInit, timeoutMs: number): Promise<any> {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = schedule(() => { controller.abort(); reject(new AudioWindowError('音声の保存確認がタイムアウトしました')) }, timeoutMs)
    })
    try {
      return await Promise.race([(async () => {
        const response = await request(url, { ...init, signal: controller.signal })
        const data = await response.json()
        if (!response.ok) throw new AudioWindowError(typeof data?.error === 'string' ? data.error : '音声の保存を確認できませんでした', data?.code, response.status)
        return data
      })(), timeout])
    } finally { if (timer !== undefined) cancel(timer) }
  }
  function deliver() {
    for (const speaker of ['remote', 'self'] as const) {
      for (const entry of entries.filter(e => e.handle.speaker === speaker)) {
        if (entry.discarded || entry.delivered) continue
        if (!entry.result) break
        // Consumer must apply each transcript id idempotently. A consumer bug is
        // retained as a failure and must never cause another paid upload.
        entry.delivered = true
        try { options.onResult({ ...entry.result, speaker, sequence: entry.sequence! }) }
        catch { deliveryFailed = true }
      }
    }
  }
  function ready(handle: AudioWindowHandle): Promise<void> {
    const entry = entryFor(handle)
    if (entry.windowId || entry.discarded) return Promise.resolve()
    if (entry.reservation) return entry.reservation
    entry.failed = false
    const previous = tails[handle.speaker]
    entry.reservation = previous.catch(() => {}).then(async () => {
      // A failed earlier reservation must be recovered before assigning later
      // sequence numbers; otherwise replay can reorder the captured conversation.
      const index = entries.indexOf(entry)
      if (entries.slice(0, index).some(e => e.handle.speaker === handle.speaker && !e.windowId && !e.discarded)) throw new AudioWindowError('先の音声受付を確認してから再試行してください')
      try {
        const data = await send(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reserve', recordingToken, speaker: handle.speaker, requestKey: handle.key }) }, 10000)
        if (data?.state !== 'reserved' || typeof data.windowId !== 'string' || !data.windowId || !Number.isSafeInteger(data.sequence) || data.sequence < 0 || data.speaker !== handle.speaker) throw new AudioWindowError('音声の受付情報が不正です')
        const earlier = entries.slice(0, index).filter(e => e.handle.speaker === handle.speaker && !e.discarded)
        if (earlier.length && data.sequence <= earlier[earlier.length - 1].sequence!) throw new AudioWindowError('音声の受付順が不正です')
        entry.windowId = data.windowId; entry.sequence = data.sequence
      } catch (error) {
        // Lost reservation responses are retried with the same key. An explicit
        // expired response after stop proves this unused key has no server slot.
        if (stopped && !entry.capturing && error instanceof AudioWindowError && error.code === 'expired') entry.discarded = true
        else throw error
      }
    }).catch(error => { entry.failed = true; throw error }).finally(() => { entry.reservation = undefined; deliver(); changed() })
    tails[handle.speaker] = entry.reservation
    return entry.reservation
  }
  function reserve(speaker: Speaker): AudioWindowHandle {
    if (stopped) throw new AudioWindowError('録音は終了しています')
    const handle = Object.freeze({ speaker, key: (options.requestKey ?? (() => crypto.randomUUID()))() })
    entries.push({ handle, capturing: false, discarded: false, delivered: false, failed: false })
    return handle
  }
  function begin(handle: AudioWindowHandle) {
    const entry = entryFor(handle)
    if (stopped || !entry.windowId || entry.capturing || entry.payload || entry.discarded) throw new AudioWindowError('この音声枠では録音を開始できません')
    entry.capturing = true
  }
  function upload(entry: Entry): Promise<void> {
    if (entry.result || entry.discarded) return Promise.resolve()
    if (entry.upload) return entry.upload
    if (!entry.payload) return Promise.reject(new AudioWindowError('録音データがまだ届いていません'))
    entry.failed = false
    entry.upload = (async () => {
      await ready(entry.handle)
      if (entry.discarded) return
      const form = new FormData()
      form.set('recordingToken', recordingToken); form.set('language', entry.payload!.language)
      if (entry.payload!.audio === null) form.set('silent', '1')
      else form.set('audio', entry.payload!.audio, 'chunk.webm')
      const data = await send(`${base}/${encodeURIComponent(entry.windowId!)}`, { method: 'POST', body: form }, 75000)
      if (typeof data?.text !== 'string' || typeof data.transcriptId !== 'string' || !data.transcriptId) throw new AudioWindowError('音声の保存結果が不正です')
      entry.result = { text: data.text, transcriptId: data.transcriptId }
      entry.payload = undefined // Release saved audio bytes from memory.
      deliver()
    })().catch(error => { entry.failed = true; throw error }).finally(() => { entry.upload = undefined; changed() })
    return entry.upload
  }
  function submit(handle: AudioWindowHandle, audio: Blob | null, language: Language): Promise<void> {
    const entry = entryFor(handle)
    if (entry.result) return Promise.resolve()
    if (audio !== null && !entry.capturing) throw new AudioWindowError('録音開始を確認できない音声です')
    if (entry.payload && (entry.payload.audio !== audio || entry.payload.language !== language)) throw new AudioWindowError('再送する音声は変更できません')
    if (!entry.payload) entry.payload = { audio, language }
    return upload(entry)
  }
  async function retry() {
    // Reservation order is sequential per channel. Paid uploads still run concurrently.
    for (const entry of entries) {
      if (!entry.windowId && !entry.discarded) { try { await ready(entry.handle) } catch { /* Retain for another explicit retry. */ } }
    }
    await Promise.allSettled(entries.filter(e => e.payload && !e.result).map(upload))
    deliver(); changed()
  }
  function finish(): Promise<Finalized> {
    stopped = true
    if (finalizing) return finalizing
    finalizeFailed = false
    finalizing = (async () => {
      await Promise.allSettled(entries.map(e => e.reservation).filter(Boolean))
      // Do not call a recorded-but-missing payload silent. That is a capture failure.
      await Promise.allSettled(entries.filter(e => !e.capturing && !e.result && !e.discarded).map(e => submit(e.handle, null, 'ja')))
      await Promise.allSettled(entries.map(e => e.upload).filter(Boolean))
      if (deliveryFailed || entries.some(e => !e.result && !e.discarded)) throw new AudioWindowError('保存できていない音声があります。同じ画面で再試行してください。')
      const data = await send(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'finalize', recordingToken }) }, 10000)
      if (data?.state !== 'complete' || !Array.isArray(data.finalTranscripts)) throw new AudioWindowError('音声の終了を確認できませんでした')
      const last = new Map<Speaker, Entry>()
      entries.filter(e => e.result && !e.discarded).forEach(e => last.set(e.handle.speaker, e))
      if (data.finalTranscripts.length !== last.size || [...last].some(([speaker, entry]) =>
        data.finalTranscripts.filter((item: any) => item?.speaker === speaker && item.transcriptId === entry.result!.transcriptId && item.sequence === entry.sequence).length !== 1)) throw new AudioWindowError('最後の音声の保存結果が一致しません')
      return data as Finalized
    })().catch(error => { finalizeFailed = true; throw error }).finally(() => { finalizing = undefined; changed() })
    return finalizing
  }
  return { reserve, ready, begin, submit, stop: () => { stopped = true }, retry, finish,
    hasPending: () => deliveryFailed || entries.some(e => !e.result && !e.discarded),
    failedCount: () => entries.filter(e => e.failed).length + Number(deliveryFailed) + Number(finalizeFailed),
  }
}
