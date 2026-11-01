'use client'
// ============================================
// 人事: 読み込みに失敗したときの表示
// ============================================
// ⚠️ サーバーの error 文字列・ステータスコード・err.message はそのまま見せない。
//    ステータスから「何が起きたか」と「どうすればよいか」を日本語で出す（UI 品質 §エラー）。
//    401 → ログインし直す / 403 → 権限が無い・管理者に依頼 / 429・上限 → 料金プラン / それ以外 → 時間をおいてやり直す
import { usePathname } from 'next/navigation'
import { Button, ErrorNotice } from '@/components/ds'

export type HrErrorKind = 'login' | 'forbidden' | 'limit' | 'other'

/** 応答のステータス（と上限の印）から、表示の種類を決める */
export function hrErrorKind(status?: number | null, limitFlag = false): HrErrorKind {
  if (status === 401) return 'login'
  if (status === 403) return 'forbidden'
  if (status === 429 || limitFlag) return 'limit'
  return 'other'
}

/** fetch の応答を読む前に投げる、ステータスだけを持つエラー（文言は画面で決める） */
export class HrStatusError extends Error {
  constructor(readonly status: number, readonly limit = false) { super('HR request failed') }
}

/** 投げられたものからステータスを取り出す（分からなければ undefined） */
export function hrErrorStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'status' in error && typeof (error as { status: unknown }).status === 'number') return (error as { status: number }).status
  return undefined
}

export default function HrLoadError({ subject, status, limit = false, onRetry, className }: {
  /** 何を読み込もうとしたか（例: 従業員の一覧） */
  subject: string
  status?: number | null
  limit?: boolean
  onRetry?: () => void
  className?: string
}) {
  const pathname = usePathname() || '/hr/dashboard'
  const kind = hrErrorKind(status, limit)
  const body = kind === 'login' ? (
    <>
      <ErrorNotice what={`${subject}を表示するには、ログインし直す必要があります。`} how="ログインの有効期限が切れた可能性があります。もう一度ログインしてください。" />
      <div className="mt-3"><Button href={`/auth/signin?callbackUrl=${encodeURIComponent(pathname)}`} icon="DoorOpen">ログインし直す</Button></div>
    </>
  ) : kind === 'forbidden' ? (
    <ErrorNotice what={`${subject}を見る権限がありません。`} how="必要な場合は、組織の管理者に権限の追加を依頼してください。" />
  ) : kind === 'limit' ? (
    <>
      <ErrorNotice what="ご利用中のプランの上限に達しました。" how="料金プランを見直すと、引き続きご利用いただけます。登録済みの内容は変わっていません。" />
      <div className="mt-3"><Button href="/hr/pricing" icon="Tag">料金プランを見る</Button></div>
    </>
  ) : (
    <ErrorNotice what={`${subject}を読み込めませんでした。登録済みの内容は変わっていません。`} how="時間をおいて、もう一度お試しください。" onRetry={onRetry} retryLabel="再読み込み" />
  )
  return <div className={className}>{body}</div>
}
