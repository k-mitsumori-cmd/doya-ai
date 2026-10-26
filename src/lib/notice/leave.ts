// ============================================
// 画面を離れる前の下書きの確認（提案リスト (27)）と、裏で終わった作業の知らせ（(15)）の判定
// ============================================
// 画面に依らない純粋な関数。NoticeProvider が使う。

/** 押したリンクで、今の画面から別の画面へ移るか（同じ画面の中の移動・新しいタブ・別のサイトは数えない） */
export function isLeavingLink(input: {
  href: string | null
  origin: string
  currentPath: string
  target?: string | null
  download?: boolean
  modifier?: boolean
}): boolean {
  if (!input.href || input.download || input.modifier) return false
  if (input.target && input.target !== '_self') return false
  let u: URL
  // 「#top」や「?x=1」は今の画面からの相対なので、今の画面を基準にする
  try { u = new URL(input.href, input.origin + input.currentPath) } catch { return false }
  if (u.origin !== input.origin) return false
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
  return u.pathname !== input.currentPath
}

/** 書きかけと数える入力欄か（検索欄・確認の窓の中・data-notice-ignore の中は数えない） */
export function countsAsDraft(el: { tagName: string; type?: string; readOnly?: boolean; inDialog: boolean; ignored: boolean; contentEditable?: boolean }): boolean {
  if (el.inDialog || el.ignored || el.readOnly) return false
  if (el.tagName === 'TEXTAREA') return true
  if (el.tagName === 'INPUT') return !['search', 'checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'hidden', 'range', 'color'].includes(el.type ?? 'text')
  return Boolean(el.contentEditable)
}

/** これより長くかかった作業だけ、別の画面にいるときに「終わりました」と知らせる */
export const FINISHED_NOTICE_MS = 5000

/** 裏で終わった作業を知らせるか（始めた画面から移っていて、時間がかかり、うまくいったときだけ） */
export function shouldNotifyFinished(input: { startPath: string; nowPath: string; ms: number; ok: boolean }): boolean {
  return input.ok && input.ms >= FINISHED_NOTICE_MS && input.startPath !== input.nowPath
}
