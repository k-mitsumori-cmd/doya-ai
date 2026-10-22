// 見積の新しい見た目（useUiNext() が真）で出す、読み込み失敗の文言。
// ⚠️ 生のエラー文（err.message・サーバーの error・状態コード）は画面に出さない（UI 品質 S-20）。
//    状態コードが分かるときは status から、分からないとき（共通の hook が文言だけを返す画面）は文言から種類を決める。
export type QuoteErrorKind = 'login' | 'forbidden' | 'limit' | 'missing' | 'failed'

export function quoteErrorKind(status: number, message = ''): QuoteErrorKind {
  if (status === 401 || /ログイン/.test(message)) return 'login'
  if (status === 403 || /権限|アクセス権/.test(message)) return 'forbidden'
  if (status === 402 || status === 429 || /上限|利用枠/.test(message)) return 'limit'
  if (status === 404 || /見つかりません|URLを確認/.test(message)) return 'missing'
  return 'failed'
}

/** what（何が起きたか）と how（どうすればよいか）。thing は「見積書」「発行者情報」など */
export function quoteErrorCopy(kind: QuoteErrorKind, thing: string): { what: string; how: string } {
  switch (kind) {
    case 'login':
      return { what: 'ログインの期限が切れました。', how: 'ログインし直してから、もう一度開いてください。' }
    case 'forbidden':
      return { what: `この組織の${thing}を見る権限がありません。`, how: '組織のオーナーか管理者に、権限の追加を依頼してください。' }
    case 'limit':
      return { what: '今月の利用上限に達しました。', how: '料金プランを確認すると、続けて使えます。' }
    case 'missing':
      return { what: `${thing}が見つかりませんでした。`, how: '削除されたか、別の組織のものかもしれません。一覧から開き直してください。' }
    default:
      return { what: `${thing}を読み込めませんでした。`, how: '時間をおいて、もう一度お試しください。' }
  }
}
