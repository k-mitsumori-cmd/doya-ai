// ========================================
// タイムアウト付き処理ヘルパー
// ========================================
// fetch のヘッダ受信だけでなく「本文読み取り(json/text)まで」を AbortController で覆うため、
// fetch + パースをまとめて fn に渡して実行する。接続/本文ストールでの無限ブロックを防ぐ。

export async function withTimeout<T>(
  label: string,
  timeoutMs: number,
  fn: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController()
  const to = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fn(controller.signal)
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error(`${label} timeout (${timeoutMs}ms)`)
    throw e
  } finally {
    clearTimeout(to)
  }
}

// AbortSignal 非対応の処理（Supabase SDK のアップロード等）に外側からタイムアウトを掛ける。
// タイムアウト時は reject（元の処理は放棄）。これが無いと接続滞留でワーカーが無限ブロックする。
export function raceTimeout<T>(label: string, timeoutMs: number, p: Promise<T>): Promise<T> {
  let to: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    to = setTimeout(() => reject(new Error(`${label} timeout (${timeoutMs}ms)`)), timeoutMs)
  })
  return Promise.race([p, timeout]).finally(() => {
    if (to) clearTimeout(to)
  }) as Promise<T>
}
