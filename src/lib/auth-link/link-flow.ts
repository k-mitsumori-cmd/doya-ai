/**
 * 結び付けの確認の画面（/auth/link）の、状態の移り方と文言（純粋関数。React に依存しない）。
 * 流れ: 案内（intro）→ 確認コードを送る → コードの入力（code）→ 完了（done）。
 * 失敗: 待ちの期限切れ（expired）、試せる回数の上限（locked）、メールが確認済みでない人（unverified）、画面に渡された値が不正（invalid）。
 * メール・コード・待ちの ID は、この画面の URL・ログに出さない（待ちの ID は、最初の URL のあと画面の中だけで持つ）。
 * 契約: docs/architecture/2026-11-18-app/api-contract.md の「結び付けの確認（Web）」。
 */

export type LinkStep = 'intro' | 'code' | 'done' | 'expired' | 'locked' | 'unverified' | 'invalid'

export type LinkView = {
  step: LinkStep
  /** 宛先の手がかり（例: t***@example.com）。送ったときだけ */
  emailHint: string | null
  /** 入力欄の下などに出す、操作の案内（赤字にしない） */
  notice: string | null
  /** 失敗の文（赤字） */
  error: string | null
  /** コードを間違えたあとの、残りの回数 */
  remainingAttempts: number | null
}

const base = (step: LinkStep, over: Partial<LinkView> = {}): LinkView => ({ step, emailHint: null, notice: null, error: null, remainingAttempts: null, ...over })

/** 待ちの ID の形（サーバーの isSafeTokenValue と同じ範囲） */
export function isPlausibleRequestId(v: unknown): v is string {
  return typeof v === 'string' && /^[A-Za-z0-9_-]{16,256}$/.test(v)
}

/** URL の値から、最初の状態を決める */
export function initialView(params: { request: string | null; error: string | null }): LinkView {
  if (params.error === 'LINK_TARGET_UNVERIFIED') return base('unverified')
  if (!isPlausibleRequestId(params.request)) return base('invalid')
  return base('intro')
}

type ApiResult = { status: number; body: Record<string, unknown> | null }
const codeOf = (r: ApiResult) => (typeof r.body?.code === 'string' ? (r.body.code as string) : null)

/** 「確認コードを送る」の結果 */
export function afterSend(r: ApiResult): LinkView {
  if (r.status === 200) {
    const hint = typeof r.body?.emailHint === 'string' ? (r.body.emailHint as string) : null
    return base('code', { emailHint: hint, notice: '確認コードを送りました。メールをご確認ください。コードの有効期限は15分です。' })
  }
  const code = codeOf(r)
  if (code === 'CODE_ALREADY_SENT') {
    return base('code', { notice: 'すでに確認コードをお送りしています。メールをご確認のうえ、コードを入力してください。' })
  }
  if (code === 'LINK_REQUEST_EXPIRED') return base('expired')
  if (code === 'NO_EMAIL') return base('unverified')
  if (code === 'EMAIL_SEND_FAILED') return base('intro', { error: '確認コードを送れませんでした。しばらくしてから、もう一度お試しください。' })
  return base('intro', { error: '確認コードを送れませんでした。しばらくしてから、もう一度お試しください。' })
}

/** コードを送信した結果。prev は、送信前の画面（宛先の手がかりを引き継ぐ） */
export function afterConfirm(prev: LinkView, r: ApiResult): LinkView {
  if (r.status === 200 && r.body?.linked === true) return base('done')
  const code = codeOf(r)
  const keep = { emailHint: prev.emailHint }
  if (code === 'LINK_CODE_INVALID') {
    const remaining = typeof r.body?.remainingAttempts === 'number' ? (r.body.remainingAttempts as number) : null
    return base('code', {
      ...keep,
      remainingAttempts: remaining,
      error: remaining !== null && remaining > 0
        ? `確認コードが違います。あと${remaining}回、入力をやり直せます。`
        : '確認コードが違います。',
    })
  }
  if (code === 'LINK_TOO_MANY_ATTEMPTS') return base('locked')
  if (code === 'LINK_REQUEST_EXPIRED' || code === 'LINK_REQUEST_USED') return base('expired')
  if (code === 'CODE_NOT_SENT') return base('intro', { error: '先に、確認コードを送ってください。' })
  if (code === 'IDENTITY_TAKEN') {
    return base('invalid', { error: 'この Apple のアカウントは、すでに別のドヤバディのアカウントに結び付いています。お問い合わせください。' })
  }
  if (code === 'INVALID_REQUEST') return base('code', { ...keep, error: '確認コードは、6桁の数字で入力してください。' })
  return base('code', { ...keep, error: '確認できませんでした。しばらくしてから、もう一度お試しください。' })
}

/** コード欄の入力。数字だけを残し、6桁までにする（全角の数字は半角に直す） */
export function sanitizeCodeInput(raw: string): string {
  return raw.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/\D/g, '').slice(0, 6)
}

export function canSubmitCode(code: string): boolean {
  return /^\d{6}$/.test(code)
}

/** 各状態の見出しと本文（画面はこれを並べるだけ） */
export function stepText(step: LinkStep): { title: string; body: string } {
  switch (step) {
    case 'intro':
      return { title: '同じメールアドレスのアカウントがあります', body: 'お使いのメールアドレスで、ドヤバディのアカウントがすでに作られています。ご本人かどうかを確かめるため、そのアカウントのメールアドレスへ、確認コードをお送りします。' }
    case 'code':
      return { title: '確認コードを入力してください', body: 'メールに記載された、6桁の確認コードを入力してください。' }
    case 'done':
      return { title: 'ログイン手段を追加しました', body: 'いまのアカウントで、Apple でもログインできるようになりました。もう一度、Apple でログインしてください。' }
    case 'expired':
      return { title: '確認の有効期限が切れました', body: '確認の手続きの有効期限（15分）が過ぎたか、すでに使われています。もう一度、ログインの画面から Apple でのログインをお試しください。' }
    case 'locked':
      return { title: '確認コードの入力回数が上限に達しました', body: '安全のため、この手続きは使えなくなりました。もう一度、ログインの画面から Apple でのログインをお試しください。' }
    case 'unverified':
      return { title: 'このメールアドレスは、画面からは確認できません', body: 'このメールアドレスのアカウントは、メールアドレスの確認が済んでいないため、画面からはログイン手段を追加できません。お手数ですが、ドヤバディのお問い合わせ窓口までご連絡ください。' }
    case 'invalid':
    default:
      return { title: 'この画面は、ログインの途中からだけ開けます', body: 'ログインの画面から、もう一度 Apple でのログインをお試しください。' }
  }
}
