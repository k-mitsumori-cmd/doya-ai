'use client'
// ============================================
// 面接: 新しい見た目だけで使う「読み込めなかった」表示と、小さな共通の部品
// ============================================
// ⚠️ ここは useToolUiNext() が真のときだけ使う。偽のとき（今までの見た目）は各ページの表示をそのまま残す。
// ⚠️ 状態コードや英語のエラー文（Failed to fetch など）を画面に出さない。何が起きたかと、次にやることだけを書く。
import { Button, ErrorNotice } from '@/components/ds'

/** 読み込みに失敗した理由（状態コードから分ける） */
export type LoadIssue = 'login' | 'forbidden' | 'limit' | 'other'

export function loadIssueOf(status: number): LoadIssue {
  if (status === 401) return 'login'
  if (status === 403) return 'forbidden'
  if (status === 429 || status === 402) return 'limit'
  return 'other'
}

/** 押せる部品に足す、キーボードで選んだときの青い輪 */
export const NX_FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)] focus-visible:ring-offset-2'
/** 指で押しやすい高さ（44px 以上）と、短い文字を1行に収める */
export const NX_TAP = 'inline-flex min-h-11 items-center justify-center whitespace-nowrap'

/**
 * 画面に出してよい文か。日本語を含まない文（英語の例外の文・状態コードだけの文）は出さず、代わりの文にする。
 * サーバーの文は日本語で書かれているのでそのまま出す。
 */
export function friendlyText(message: unknown, fallback: string): string {
  const text = typeof message === 'string' ? message : message instanceof Error ? message.message : ''
  return /[぀-ヿ一-鿿]/.test(text) ? text : fallback
}

/** 読み込みに失敗したときの表示。理由ごとに「何が起きたか」と「次にやること」を変える */
export function LoadIssueNotice({ issue, subject, onRetry }: {
  issue: LoadIssue
  /** 何を読み込もうとしたか（例: 面接の情報） */
  subject: string
  onRetry?: () => void
}) {
  if (issue === 'login') {
    return (
      <div className="grid gap-3">
        <ErrorNotice what="ログインの有効期限が切れました。" how="もう一度ログインすると、続きから使えます。" />
        <div><Button href="/auth/signin?callbackUrl=%2Fmensetsu" icon="DoorOpen">ログインし直す</Button></div>
      </div>
    )
  }
  if (issue === 'forbidden') {
    return (
      <ErrorNotice
        what={`${subject}を見る権限がありません。`}
        how="組織の管理者に、メンバーへの追加か権限の変更を依頼してください。"
        onRetry={onRetry}
        retryLabel="再読み込み"
      />
    )
  }
  if (issue === 'limit') {
    return (
      <div className="grid gap-3">
        <ErrorNotice
          what="今月の利用上限に達したか、短い時間に操作が集中しました。"
          how="少し時間をおいてからやり直すか、料金プランで上限をご確認ください。"
          onRetry={onRetry}
          retryLabel="やり直す"
        />
        <div><Button href="/mensetsu/pricing" variant="secondary" icon="CreditCard">料金プランを見る</Button></div>
      </div>
    )
  }
  return (
    <ErrorNotice
      what={`${subject}を読み込めませんでした。`}
      how="通信状況を確かめて、時間をおいてもう一度お試しください。"
      onRetry={onRetry}
      retryLabel="再読み込み"
    />
  )
}
