// ============================================
// 直接アップロード：小分け送信の列（ブラウザ側）
// ============================================
// ・ファイルを 8〜16MB ずつに切り、3 個同時に送る。ファイルは 2 本まで同時に送る。
// ・どこまで送れたかの正本は S3（status API）。ブラウザには「このファイルの送信ID」だけを
//   localStorage に残し、画面を開き直して同じファイルを選ぶと、残りだけを送る。
// ・ファイル本体はブラウザが保持できないため、再開には同じファイルの再選択が要る。

const API = '/api/direct-upload/multipart'
const STORE_KEY = 'doya-multipart-v1'
const FILE_CONCURRENCY = 2
const PART_CONCURRENCY = 3
const PART_RETRIES = 3

export type QueueStatus = 'queued' | 'uploading' | 'completing' | 'done' | 'error' | 'paused'

export type QueueItem = {
  key: string
  file: File
  status: QueueStatus
  /** 0〜100 */
  percent: number
  /** 残り秒（不明なら null） */
  etaSeconds: number | null
  bytesPerSecond: number
  error: string | null
  /** 完了後の保存先 */
  objectKey: string | null
  resumed: boolean
}

type Persisted = Record<string, { id: string; savedAt: number }>

function fingerprint(f: File) {
  return `${f.name}:${f.size}:${f.lastModified}`
}
function readStore(): Persisted {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') } catch { return {} }
}
function writeStore(s: Persisted) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)) } catch { /* 保存できなくても送信は続ける */ }
}

async function api(path: string, body?: unknown, signal?: AbortSignal) {
  const res = await fetch(`${API}/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.success) throw new Error(data.error || '通信に失敗しました')
  return data
}

function putPart(url: string, blob: Blob, onBytes: (loaded: number) => void, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.upload.onprogress = e => onBytes(e.loaded)
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`送信に失敗しました（${xhr.status}）`)))
    xhr.onerror = () => reject(new Error('通信が切れました'))
    xhr.onabort = () => reject(new Error('中止しました'))
    signal.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.send(blob)
  })
}

export class MultipartQueue {
  items: QueueItem[] = []
  private listeners = new Set<() => void>()
  private controllers = new Map<string, AbortController>()
  private running = 0
  private startedAt = new Map<string, { t: number; base: number }>()
  private sent = new Map<string, number>()

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }
  private emit() {
    this.items = [...this.items]
    this.listeners.forEach(fn => fn())
  }
  private patch(key: string, p: Partial<QueueItem>) {
    this.items = this.items.map(i => (i.key === key ? { ...i, ...p } : i))
    this.emit()
  }

  add(files: File[]) {
    for (const file of files) {
      const key = `${fingerprint(file)}:${Math.random().toString(36).slice(2, 7)}`
      this.items.push({ key, file, status: 'queued', percent: 0, etaSeconds: null, bytesPerSecond: 0, error: null, objectKey: null, resumed: false })
    }
    this.emit()
    this.pump()
  }

  retry(key: string) {
    this.patch(key, { status: 'queued', error: null })
    this.pump()
  }

  pause(key: string) {
    this.controllers.get(key)?.abort()
    this.patch(key, { status: 'paused' })
  }

  /** 中止して、サーバー側の途中のデータも捨てる */
  async cancel(key: string) {
    const id = readStore()[fingerprint(this.items.find(i => i.key === key)!.file)]?.id
    this.controllers.get(key)?.abort()
    this.items = this.items.filter(i => i.key !== key)
    this.emit()
    if (id) await api('abort', { id }).catch(() => {})
  }

  private pump() {
    while (this.running < FILE_CONCURRENCY) {
      const next = this.items.find(i => i.status === 'queued')
      if (!next) return
      this.running++
      this.patch(next.key, { status: 'uploading' })
      this.run(next).finally(() => { this.running--; this.pump() })
    }
  }

  private async run(item: QueueItem) {
    const ctl = new AbortController()
    this.controllers.set(item.key, ctl)
    const fp = fingerprint(item.file)
    try {
      // 1) 続きから送れるか確かめる。だめなら新しく始める
      let found: string | undefined = readStore()[fp]?.id
      let uploaded = new Map<number, number>()
      let partSize = 0
      let total = 0
      if (found) {
        try {
          const st = await api(`status?id=${encodeURIComponent(found)}`, undefined, ctl.signal)
          if (st.status === 'UPLOADING' && st.fileSize === item.file.size) {
            partSize = st.partSize; total = st.totalParts
            for (const p of st.uploadedParts) uploaded.set(p.partNumber, p.size)
            this.patch(item.key, { resumed: uploaded.size > 0 })
          } else found = undefined
        } catch { found = undefined }
      }
      let id: string
      if (found) {
        id = found
      } else {
        const s = await api('start', { fileName: item.file.name, mimeType: item.file.type, fileSize: item.file.size }, ctl.signal)
        id = s.id as string
        partSize = s.partSize; total = s.totalParts
        uploaded = new Map()
        const store = readStore(); store[fp] = { id: id!, savedAt: Date.now() }; writeStore(store)
      }

      // 2) 届いていないパートだけ送る
      const todo: number[] = []
      for (let n = 1; n <= total; n++) {
        const expect = n === total ? item.file.size - partSize * (total - 1) : partSize
        if (uploaded.get(n) !== expect) todo.push(n)
      }
      const doneBytes = (total - todo.length) * partSize // 概算（最終パートの差は無視）
      const inFlight = new Map<number, number>()
      let completedBytes = Math.min(doneBytes, item.file.size)
      this.sent.set(item.key, 0)
      this.startedAt.set(item.key, { t: Date.now(), base: completedBytes })
      const report = () => {
        let cur = completedBytes
        inFlight.forEach(v => { cur += v })
        const st = this.startedAt.get(item.key)!
        const sec = (Date.now() - st.t) / 1000
        const bps = sec > 0.5 ? (cur - st.base) / sec : 0
        this.patch(item.key, {
          percent: Math.min(99, Math.floor((cur / item.file.size) * 100)),
          bytesPerSecond: bps,
          etaSeconds: bps > 0 ? Math.round((item.file.size - cur) / bps) : null,
        })
      }

      let cursor = 0
      const worker = async () => {
        while (cursor < todo.length) {
          const batch = todo.slice(cursor, cursor + 1)
          cursor += 1
          const n = batch[0]
          const blob = item.file.slice((n - 1) * partSize, Math.min(n * partSize, item.file.size))
          for (let attempt = 1; ; attempt++) {
            try {
              // 署名の期限切れに備え、送る直前にパートごとで発行する
              const { urls } = await api('parts', { id, partNumbers: [n] }, ctl.signal)
              await putPart(urls[0].url, blob, loaded => { inFlight.set(n, loaded); report() }, ctl.signal)
              break
            } catch (e) {
              inFlight.delete(n)
              if (ctl.signal.aborted || attempt >= PART_RETRIES) throw e
              await new Promise(r => setTimeout(r, attempt * 2000))
            }
          }
          inFlight.delete(n)
          completedBytes += blob.size
          report()
        }
      }
      await Promise.all(Array.from({ length: Math.min(PART_CONCURRENCY, todo.length) }, worker))

      // 3) つなげて完了
      this.patch(item.key, { status: 'completing', percent: 99, etaSeconds: null })
      const done = await api('complete', { id }, ctl.signal)
      const store = readStore(); delete store[fp]; writeStore(store)
      this.patch(item.key, { status: 'done', percent: 100, objectKey: done.objectKey, etaSeconds: 0 })
    } catch (e: any) {
      if (ctl.signal.aborted) return // 一時停止・取り消しは呼び出し側が状態を決める
      this.patch(item.key, { status: 'error', error: e?.message || '送信に失敗しました' })
    } finally {
      this.controllers.delete(item.key)
    }
  }
}
