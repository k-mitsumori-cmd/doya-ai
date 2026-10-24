'use client'

// ドヤAI質問リンク 失敗したときの表示
// 何が起きたか・どうすればよいか・次の一手（やり直す／料金プラン／ログイン）を出す。サーバーの文言はそのまま出さない
import { Button } from '@/components/ds'
import { ErrorNotice } from '@/components/ds/feedback'
import { asklinkErrorCopy } from './errors'

export default function AskLinkErrorNotice({ status, action, onRetry, retryLabel, callbackUrl = '/asklink', what, how }: {
  status: number
  action: Parameters<typeof asklinkErrorCopy>[1]
  onRetry?: () => void
  retryLabel?: string
  /** ログインし直したあとに戻る場所 */
  callbackUrl?: string
  /** 状態からの文言を上書きする（入力の誤りなど、画面側で分かっているとき） */
  what?: string
  how?: string
}) {
  const copy = asklinkErrorCopy(status, action)
  return (
    <div className="space-y-2">
      <ErrorNotice
        what={what ?? copy.what}
        how={how ?? copy.how}
        onRetry={copy.limit || copy.signin ? undefined : onRetry}
        retryLabel={retryLabel}
      />
      {copy.limit ? (
        <div className="flex flex-wrap gap-2">
          <Button href="/asklink/pricing" icon="CreditCard" variant="secondary">料金プランを見る</Button>
        </div>
      ) : copy.signin ? (
        <div className="flex flex-wrap gap-2">
          <Button href={`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`} icon="CircleUser" variant="secondary">ログインし直す</Button>
        </div>
      ) : null}
    </div>
  )
}
