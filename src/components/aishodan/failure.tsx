'use client'

// ============================================
// ドヤAI商談: 失敗したときの表示（新しい見た目だけ。UI 品質 S-20）
// ============================================
// 「何が起きたか」と「どうすればよいか」を、応答の状態（401・403・404・上限）から決める。
// ⚠️ サーバーの error 文やステータス番号をそのまま画面に出さない（技術的な文が混ざる）。
//    例外: 400・409・422 で、日本語の短い文のときだけ（入力の誤りを伝える文として書かれている）。
// ⚠️ 新しい見た目でないときは使わない。今までの表示（サーバーの文をそのまま出す）を変えない約束。
import { Button, ErrorNotice } from '@/components/ds'

export type AishodanFailureKind = 'auth' | 'forbidden' | 'limit' | 'notfound' | 'other'

export type AishodanFailure = {
  kind: AishodanFailureKind
  /** 何が起きたか */
  what: string
  /** どうすればよいか */
  how: string
}

/** 応答の状態を持ったエラー。message は今までどおりの文（今までの見た目はこれを出す） */
export class AishodanHttpError extends Error {
  status: number
  code?: string
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

/** エラーから応答の状態を取り出す。通信の失敗・応答の形の誤りは 0 */
export function failureStatus(e: unknown): number {
  return e instanceof AishodanHttpError ? e.status : 0
}

/**
 * 組織の JSON を読む（src/lib/org-fetch.ts の fetchOrgJson と同じ動き）。
 * 違いは、失敗したときに応答の状態を AishodanHttpError に持たせることだけ。
 */
export async function fetchAishodanJson<T = Record<string, any>>(url: string): Promise<T> {
  const response = await fetch(url)
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new AishodanHttpError(
      typeof data?.error === 'string' ? data.error : '組織のデータを取得できませんでした',
      response.status,
      typeof data?.code === 'string' ? data.code : undefined,
    )
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('組織のデータを確認できませんでした')
  }
  return data as T
}

const JA = /[぀-ヿ一-龯]/

/**
 * 失敗を、利用者向けの文に直す。
 * @param subject 何が起きたか（例: 「商談ログを読み込めませんでした」）
 * @param serverMessage サーバーの error 文（400・409・422 の日本語の短い文のときだけ使う）
 */
export function describeAishodanFailure(status: number, subject: string, opts: { serverMessage?: string; limit?: boolean } = {}): AishodanFailure {
  if (opts.limit || status === 402 || status === 429) {
    return { kind: 'limit', what: '今月の利用の上限に達しました。', how: '料金プランを確かめると、上限を増やせます。来月になると、また使えるようになります。' }
  }
  if (status === 401) {
    return { kind: 'auth', what: subject, how: 'ログインの有効期限が切れています。ログインし直してから、もう一度お試しください。' }
  }
  if (status === 403) {
    return { kind: 'forbidden', what: subject, how: 'この組織でこの操作をする権限がありません。組織を選び直すか、組織の管理者に権限を依頼してください。' }
  }
  if (status === 404) {
    return { kind: 'notfound', what: subject, how: '削除されたか、別の組織のものの可能性があります。一覧から選び直してください。' }
  }
  const msg = opts.serverMessage?.trim()
  if ((status === 400 || status === 409 || status === 422) && msg && msg.length <= 120 && JA.test(msg)) {
    return { kind: 'other', what: subject, how: msg }
  }
  return { kind: 'other', what: subject, how: '通信が不安定か、一時的な不具合の可能性があります。時間をおいて、もう一度お試しください。' }
}

/** 失敗の表示（ErrorNotice）と、状態に合った次の一手のボタン */
export function AishodanFailureNotice({ failure, onRetry, retryLabel = 'もう一度読み込む', backHref, backLabel }: {
  failure: AishodanFailure
  onRetry?: () => void
  retryLabel?: string
  /** 権限なし・見つからないときに戻る先 */
  backHref?: string
  backLabel?: string
}) {
  const action =
    failure.kind === 'limit' ? <Button href="/aishodan/pricing" icon="CreditCard">料金プランを見る</Button>
      : failure.kind === 'auth' ? <Button href="/auth/signin?callbackUrl=%2Faishodan" icon="CircleUser">ログインし直す</Button>
      : (failure.kind === 'forbidden' || failure.kind === 'notfound') && backHref ? <Button href={backHref} variant="secondary">{backLabel ?? '一覧に戻る'}</Button>
      : null
  return (
    <div className="grid gap-3">
      <ErrorNotice what={failure.what} how={failure.how} onRetry={failure.kind === 'other' ? onRetry : undefined} retryLabel={retryLabel} />
      {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
    </div>
  )
}

/** 新しい見た目のボタン・リンクに足す: 押せる大きさ（44px）とキーボードの枠 */
export const AISHODAN_TAP = ' min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066ff] focus-visible:ring-offset-2'
