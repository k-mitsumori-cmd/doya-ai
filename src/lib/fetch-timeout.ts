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
