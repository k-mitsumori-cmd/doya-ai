// ============================================
// 「ドヤパワーが足りない」（402 DOYA_POWER_INSUFFICIENT）を、画面に知らせる共通の取り扱い
// ============================================
// 生成の API は、足りないとき 402 と { code: 'DOYA_POWER_INSUFFICIENT', balance, required, limit, recoveryAmount, nextRecoveryAt } を返す
// （src/lib/doya-power/charge-core.ts）。ここでは、その応答を見て、枠の知らせ（ShellLowPowerNotice）に伝える。
// - notifyIfDoyaPowerInsufficient(res): fetch の応答を見て、当てはまれば知らせる（本文は複製から読むので、呼ぶ側の読み取りを邪魔しない）
// - 共通の枠は、同じサイトの /api/ の応答を1か所で見て、これを呼ぶ（DoyaPowerFetchWatcher）。各ツールの fetch を書き換えない
// ⚠️ 知らせは、ツールごとのエラーの表示とは別に出す（ツールの表示はそのまま）。

export const DOYA_POWER_INSUFFICIENT_EVENT = 'doya-power:insufficient'

export type DoyaPowerInsufficient = {
  balance: number
  required: number
  limit: number
  recoveryAmount?: number
  nextRecoveryAt?: string
}

/** 応答の本文が「足りない」のものなら、知らせに使う値を返す */
export function parseDoyaPowerInsufficient(body: unknown): DoyaPowerInsufficient | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  if (b.code !== 'DOYA_POWER_INSUFFICIENT') return null
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null)
  const balance = num(b.balance)
  const required = num(b.required)
  if (balance === null || required === null) return null
  const limit = num(b.limit) ?? Math.max(balance, required)
  const recoveryAmount = num(b.recoveryAmount) ?? undefined
  const next = typeof b.nextRecoveryAt === 'string' && !Number.isNaN(Date.parse(b.nextRecoveryAt)) ? b.nextRecoveryAt : undefined
  return { balance, required, limit, recoveryAmount, nextRecoveryAt: next }
}

/** fetch の応答を見て、「足りない」なら枠に知らせる。知らせたら true */
export async function notifyIfDoyaPowerInsufficient(res: Response): Promise<boolean> {
  if (res.status !== 402) return false
  let body: unknown
  try {
    body = await res.clone().json()
  } catch {
    return false
  }
  const detail = parseDoyaPowerInsufficient(body)
  if (!detail || typeof window === 'undefined') return false
  window.dispatchEvent(new CustomEvent<DoyaPowerInsufficient>(DOYA_POWER_INSUFFICIENT_EVENT, { detail }))
  return true
}

/** 同じサイトの API への呼び出しか（よそのサイトの応答は見ない） */
export function isOwnApiRequest(input: RequestInfo | URL, origin: string): boolean {
  try {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const u = new URL(raw, origin)
    return u.origin === origin && u.pathname.startsWith('/api/')
  } catch {
    return false
  }
}
