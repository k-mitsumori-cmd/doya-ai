// ============================================
// 5分以内の作り直しは半分（サーバーとクライアントで共有する決まり）
// ============================================
// ここは DB・セッション・next/server に触れない（クライアントの部品からも読むため）。
// 決まり:
// - 半分にするかを決めるのはサーバーだけ（charge-core.ts が台帳で、同じ会社・同じ操作の名前・5分以内・戻していない前の操作を探す）
// - クライアントは、前の操作のキーを retryOf として送るだけ。札（ShellCostBadge）に半分の量を出すのは目安で、減る量はサーバーが決める
// - サーバーは、減らした操作のキーを応答のヘッダー（DOYA_POWER_OP_HEADER）で返す。クライアントはそれを覚えて、作り直しの retryOf に使う
//   ⚠️ ヘッダーに入れるのはキーだけ（会社の ID は入れない）

/** 作り直しを半分にする時間（前の消費から5分以内） */
export const RETRY_HALF_WINDOW_MS = 5 * 60_000

/**
 * 作り直しのとき、クライアントが前の操作のキーを送るリクエストのヘッダー（retryOf）。
 * 本文ではなくヘッダーにするのは、包み（withDoyaPowerCharge）が大きな本文（画像の base64 など）を読まずに済むようにするため
 */
export const DOYA_POWER_RETRY_HEADER = 'x-doya-power-retry-of'

/** 減らした操作のキーを返す応答のヘッダー。旗が off のとき・減らさなかったとき・失敗して戻したときは付けない */
export const DOYA_POWER_OP_HEADER = 'x-doya-power-op'

/** 作り直しの量: 半分（切り上げ）。1 は 1 のまま */
export function halfAmount(amount: number): number {
  return Math.max(1, Math.ceil(amount / 2))
}

/** クライアントから来た、または応答のヘッダーにあったキーを確かめる（台帳のキーと同じ文字だけ） */
export function cleanRetryKey(k: unknown): string | null {
  if (typeof k !== 'string') return null
  const v = k.trim()
  return /^[A-Za-z0-9_.:-]{1,120}$/.test(v) ? v : null
}

type Store = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

/**
 * 画面ごとの「前の操作のキー」の控え。slot は画面と対象を表す名前（例: 'shanai-article:<インタビューの ID>'）。
 * 5分を過ぎた控えは返さない（送ってもサーバーは全額にするが、札の表示を合わせるため）。
 * storage（sessionStorage）があれば、ページを移っても・読み込み直しても残す。無ければメモリだけ
 */
export function createRetryMemory(opts: { now?: () => number; storage?: () => Store | null } = {}) {
  const now = opts.now ?? (() => Date.now())
  const mem = new Map<string, { key: string; at: number }>()
  const PREFIX = 'doya-power-retry:'
  const store = () => {
    try { return opts.storage?.() ?? null } catch { return null }
  }

  function read(slot: string): { key: string; at: number } | null {
    const hit = mem.get(slot)
    if (hit) return hit
    try {
      const raw = store()?.getItem(PREFIX + slot)
      if (!raw) return null
      const v = JSON.parse(raw) as { key?: unknown; at?: unknown }
      const key = cleanRetryKey(v?.key)
      if (!key || typeof v.at !== 'number' || !Number.isFinite(v.at)) return null
      return { key, at: v.at }
    } catch {
      return null
    }
  }

  /** 成功した操作のキーを控える。キーが正しくなければ何もしない */
  function remember(slot: string, key: unknown): void {
    const k = cleanRetryKey(key)
    if (!k) return
    const v = { key: k, at: now() }
    mem.set(slot, v)
    try { store()?.setItem(PREFIX + slot, JSON.stringify(v)) } catch { /* 保存できなくてもメモリには残る */ }
  }

  /** 作り直しに送る retryOf。5分を過ぎていれば null */
  function retryOf(slot: string): string | null {
    const v = read(slot)
    if (!v) return null
    if (now() - v.at > RETRY_HALF_WINDOW_MS || now() < v.at) return null
    return v.key
  }

  /** 半分の札を出してよい残りの時間（ミリ秒）。出さないなら 0 */
  function remainingMs(slot: string): number {
    const v = read(slot)
    if (!v || !retryOf(slot)) return 0
    return Math.max(0, v.at + RETRY_HALF_WINDOW_MS - now())
  }

  function forget(slot: string): void {
    mem.delete(slot)
    try { store()?.removeItem(PREFIX + slot) } catch { /* 無視 */ }
  }

  return { remember, retryOf, remainingMs, forget }
}

export type RetryMemory = ReturnType<typeof createRetryMemory>
