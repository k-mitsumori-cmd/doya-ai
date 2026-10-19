// ============================================
// ドヤリスト: 読み込みに失敗したときの文（新しい見た目だけで使う）
// ============================================
// ⚠️ サーバーの error の文字列や status の数字は、そのまま画面に出さない（UI 品質 S-20）。
//    status から「何が起きたか」と「どうすればよいか」を選んで、ErrorNotice に渡す。
// status: 0 は通信の失敗・応答の形が正しくないとき
export type DoyalistErrorCopy = {
  what: string
  how: string
  /** やり直す以外の次の操作（ログイン・料金プラン）。無ければ「やり直す」 */
  next?: { label: string; href: string }
}

/** subject は「リスト履歴」「利用状況」など、読み込もうとしたもの */
export function doyalistErrorCopy(status: number, subject: string, loginReturn = '/doyalist'): DoyalistErrorCopy {
  if (status === 401) {
    return {
      what: 'ログインの有効期限が切れました',
      how: 'ログインし直すと、続きから使えます。',
      next: { label: 'ログインし直す', href: `/auth/signin?callbackUrl=${encodeURIComponent(loginReturn)}` },
    }
  }
  if (status === 403) {
    return { what: `${subject}を見る権限がありません`, how: '必要なときは、管理者に権限の付与を依頼してください。' }
  }
  if (status === 429) {
    return {
      what: '今月の上限に達しました',
      how: '来月まで待つか、料金プランを見直すと続けて使えます。',
      next: { label: '料金プランを見る', href: '/doyalist/pricing' },
    }
  }
  return { what: `${subject}を読み込めませんでした`, how: '時間をおいて、もう一度お試しください。' }
}
