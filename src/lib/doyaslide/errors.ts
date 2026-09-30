// ========================================
// ドヤスライド エラー詳細の安全な整形
// ========================================
// 本番では内部エラー（Prisma/外部API等）の生メッセージをクライアントに露出しない。
// 開発時だけ詳細を付与する。本番ではデバッグ用環境変数があっても露出しない。

export function isDoyaDebug(): boolean {
  return process.env.NODE_ENV !== 'production'
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
