// ドヤAI質問リンク 失敗したときの案内（使う）
// ⚠️ サーバーの error 文字列や例外の文言はそのまま出さない。HTTP の状態から「何が起きたか」「どうすればよいか」を決める
// status: 0 は通信そのものの失敗（オフライン等）

export interface AskLinkErrorCopy {
  what: string
  how: string
  /** 上限に達した（料金プランへの案内を出す） */
  limit?: boolean
  /** ログインし直す必要がある */
  signin?: boolean
}

/** 失敗した fetch の状態を Error に載せて投げるための型 */
export type StatusError = Error & { status?: number }

export function statusError(message: string, status: number): StatusError {
  return Object.assign(new Error(message), { status })
}

export function statusOf(e: unknown): number {
  const s = (e as StatusError | null)?.status
  return typeof s === 'number' ? s : 0
}

type Action = 'load' | 'create' | 'banner' | 'switch' | 'save'

const FAILED: Record<Action, string> = {
  load: '結果を読み込めませんでした。',
  create: '質問リンクを作成できませんでした。',
  banner: 'バナー画像を作成できませんでした。',
  switch: 'ToB / ToC の切り替えができませんでした。',
  save: '質問文を保存できませんでした。',
}

export function asklinkErrorCopy(status: number, action: Action): AskLinkErrorCopy {
  if (status === 401) return { what: 'ログインの有効期限が切れました。', how: 'ログインし直してから、もう一度お試しください。', signin: true }
  if (status === 403) return { what: 'この操作をする権限がありません。', how: '必要なときは、管理者に権限の付与を依頼してください。' }
  if (status === 404) return { what: 'この結果は見つかりませんでした。', how: '削除されたか、別のアカウントで作成された結果です。「これまでの結果」から選び直してください。' }
  if (status === 409) return { what: 'このバナーはいま作成中です。', how: '1〜2分ほど待ってから、ページを開き直してください。' }
  if (status === 429) {
    if (action === 'banner') return { what: 'このバナーを作り直せる回数の上限に達しました。', how: '別の結果で作るか、新しく作成してください。' }
    if (action === 'switch') return { what: 'この結果で作り直せる回数の上限に達しました。', how: 'URLを入れて、新しく作成してください。' }
    return { what: '今月の作成回数の上限に達しました。', how: '料金プランを見直すと、続けて作成できます。', limit: true }
  }
  if (status === 0) return { what: FAILED[action], how: '通信の状態を確かめて、もう一度お試しください。' }
  return { what: FAILED[action], how: '時間をおいて、もう一度お試しください。' }
}
