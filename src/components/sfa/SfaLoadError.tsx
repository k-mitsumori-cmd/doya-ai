'use client'

// ============================================
// ドヤ営業管理: 一覧を読み込めなかったときの表示
// ============================================
// 新しい見た目（UI 品質 S-20）のときだけ使う。何が起きたか・どうすればよいかを日本語で出し、やり直しの操作を1つ付ける。
// ⚠️ サーバーの error 文字列・ステータス番号・err.message は画面に出さない（状態の種類だけで文を決める）。
// ⚠️ 新しい見た目でないときは、各ページの今までの表示をそのまま使う（ここは呼ばない）。
import { signIn } from 'next-auth/react'
import { ErrorNotice } from '@/components/ds'
import { SfaClientRejection } from '@/lib/sfa/client-response'
import { OrgResponseError } from '@/lib/org-client-response'

export type SfaErrorKind = 'login' | 'forbidden' | 'limit' | 'load'

/** 失敗の種類。数字（HTTP の状態）か、sfaJson が投げたエラーを受け取る */
export function sfaErrorKind(error: unknown): SfaErrorKind {
  const status = typeof error === 'number' ? error
    : error instanceof SfaClientRejection ? error.status
    : error instanceof OrgResponseError ? error.status
    : 0
  const code = error instanceof SfaClientRejection ? error.code : null
  if (status === 401) return 'login'
  if (status === 403) return 'forbidden'
  if (status === 429 || status === 402 || code === 'SFA_LIMIT_REACHED') return 'limit'
  return 'load'
}

export default function SfaLoadError({ error, what, onRetry, orgSlug }: {
  /** 失敗の理由（HTTP の状態の数字か、投げられたエラー）。文には使わず、種類を決めるだけ */
  error: unknown
  /** 何を読み込もうとしたか（例: 「商談」） */
  what: string
  onRetry?: () => void
  orgSlug?: string
}) {
  const kind = sfaErrorKind(error)
  if (kind === 'login') {
    return <ErrorNotice what={`${what}を読み込めませんでした。ログインの有効期限が切れています。`} how="もう一度ログインしてください。" onRetry={() => void signIn()} retryLabel="ログインし直す" />
  }
  if (kind === 'forbidden') {
    return <ErrorNotice what={`この組織の${what}を見る権限がありません。`} how="組織の管理者に、権限の追加を依頼してください。" />
  }
  if (kind === 'limit') {
    // slug は useParams() から URL エンコードされたまま届くことがある。二重にエンコードしない（2026-10-18 の修正と同じ）
    let slug = orgSlug || ''
    if (/%[0-9A-Fa-f]{2}/.test(slug)) { try { slug = decodeURIComponent(slug) } catch { /* そのまま使う */ } }
    const pricing = '/sfa/pricing' + (slug ? '?org=' + encodeURIComponent(slug) : '')
    return <ErrorNotice what="今のプランで使える上限に達しました。" how="料金プランを見直すと、続けて登録できます。" onRetry={() => window.location.assign(pricing)} retryLabel="料金プランを見る" />
  }
  return <ErrorNotice what={`${what}を読み込めませんでした。`} how="通信状況を確かめて、時間をおいてもう一度お試しください。" onRetry={onRetry} retryLabel="再試行" />
}
