// ========================================
// ドヤスライド エラー詳細の安全な整形
// ========================================
// 本番では内部エラー（Prisma/外部API等）の生メッセージをクライアントに露出しない。
// 開発時、または DOYA_DEBUG=1 のときだけ詳細を付与して原因特定を容易にする。

export function isDoyaDebug(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.DOYA_DEBUG === '1'
}

/** デバッグ時のみ実エラーメッセージを ": ..." として返す。本番は空文字。 */
export function errorSuffix(e: unknown): string {
  if (!isDoyaDebug()) return ''
  const msg = (e as any)?.message
  let detail: string
  if (typeof msg === 'string' && msg) {
    detail = msg
  } else {
    try {
      detail = JSON.stringify(e)
    } catch {
      detail = String(e)
    }
  }
  return `: ${(detail || 'unknown').slice(0, 400)}`
}
