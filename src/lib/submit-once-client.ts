// ============================================
// 新規の登録を、同じ送信につき1件だけにする（画面の側）
// ============================================
// 送る前に番号をブラウザに控え、結果がはっきりしたら消す。入力の中身は控えない（比較用の短い値だけ）。
// - 通信に失敗したあと同じ内容で送り直す: 同じ番号で送る。サーバーは前にできた物を返す。
// - 内容を変えて送る: 先に前回の送信の状態を確かめる。保存ずみなら、今回は送らずに知らせる。
// - 控えが1日より古い: 別の登録かもしれないので、内容が同じでも先に状態を確かめる。
// - ブラウザに控えられない: 今までどおり番号なしで送る（画面を止めない）。

export type OnceResolutionState = 'found' | 'gone' | 'cancelled'

/** 前回の送信が保存ずみだったため、今回は送らなかったときの例外（理由の文をそのまま画面に出す） */
export class SubmitOnceSavedError extends Error {}

export const ONCE_SAVED_MESSAGE = '前回の送信が保存されていました。二重に登録しないよう、今回の内容は保存していません。一覧で確かめてから、必要なら、もう一度お試しください。'

const MAX_AGE_MS = 24 * 60 * 60 * 1000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** 同じ内容かを比べるための短い値。暗号の強さは要らない */
export function onceFingerprint(input: unknown): string {
  const text = JSON.stringify(input) ?? ''
  let a = 0xdeadbeef
  let b = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    a = Math.imul(a ^ c, 2654435761)
    b = Math.imul(b ^ c, 1597334677)
  }
  return `${(a >>> 0).toString(16)}${(b >>> 0).toString(16)}:${text.length}`
}

type Pending = { operationId: string; fingerprint: string; at: number }

function readPending(key: string): Pending | null {
  const text = window.localStorage.getItem(key)
  if (text === null) return null
  try {
    const row = JSON.parse(text) as Partial<Pending>
    if (typeof row.operationId === 'string' && UUID.test(row.operationId) && typeof row.fingerprint === 'string' && typeof row.at === 'number') {
      return { operationId: row.operationId, fingerprint: row.fingerprint, at: row.at }
    }
  } catch {
    // 読めない控えは、無かったものとして扱う
  }
  window.localStorage.removeItem(key)
  return null
}

function storageWorks(): boolean {
  try {
    const key = 'submit-once:probe'
    window.localStorage.setItem(key, '1')
    window.localStorage.removeItem(key)
    return typeof crypto?.randomUUID === 'function'
  } catch {
    return false
  }
}

async function withBrowserLock<T>(key: string, work: () => Promise<T>): Promise<T> {
  // 別のタブの同じ画面と、控えの読み書きが重ならないようにする
  if (typeof navigator !== 'undefined' && navigator.locks?.request) return navigator.locks.request(key, work) as Promise<T>
  return work()
}

/** サーバーが答えを返した失敗（4xx）は、登録されていない。通信の失敗と 5xx は、結果が分からない */
function isDefiniteFailure(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status
  return typeof status === 'number' && status >= 400 && status < 500
}

export async function submitOnce<T>(options: {
  /** 控えの名前（例: income-contract:acme） */
  scope: string
  /** 送る中身（番号を除く） */
  input: unknown
  send: (operationId: string | undefined) => Promise<T>
  resolve: (operationId: string) => Promise<OnceResolutionState>
}): Promise<T> {
  const { scope, input, send, resolve } = options
  if (typeof window === 'undefined' || !storageWorks()) return send(undefined)
  const key = `submit-once:pending:v1:${scope}`
  return withBrowserLock(key, async () => {
    const fingerprint = onceFingerprint(input)
    const pending = readPending(key)
    let operationId: string
    if (pending && pending.fingerprint === fingerprint && Date.now() - pending.at < MAX_AGE_MS) {
      operationId = pending.operationId
    } else {
      if (pending) {
        const state = await resolve(pending.operationId)
        window.localStorage.removeItem(key)
        if (state !== 'cancelled') throw new SubmitOnceSavedError(ONCE_SAVED_MESSAGE)
      }
      operationId = crypto.randomUUID()
      window.localStorage.setItem(key, JSON.stringify({ operationId, fingerprint, at: Date.now() }))
    }
    try {
      const result = await send(operationId)
      window.localStorage.removeItem(key)
      return result
    } catch (error) {
      if (isDefiniteFailure(error)) window.localStorage.removeItem(key)
      throw error
    }
  })
}
