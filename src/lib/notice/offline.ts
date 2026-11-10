// 「通信が切れました」を出すかどうかの判定（F16。2026-11-11）
// 前は navigator.onLine === false や offline イベントだけで出していたため、実際はつながっているのに出ていた
// （VPN・スリープ復帰・ブラウザの誤判定で false になる）。
// いまは、その合図を「疑い」とみなし、サーバーに実際に届くかを何度か確かめて、ぜんぶ届かなかったときだけ出す。
// - probe: 届けば true、届かなければ false（どんな HTTP の返事でも「届いた」とみなす）
// - 1回でも届いたらすぐ false（出さない）を返す
// - 画面が裏にあるときは確かめない（タイマーが止まる・遅れるため。表に戻ってから確かめる）

export type OfflineProbe = () => Promise<boolean>

export async function confirmOffline(
  probe: OfflineProbe,
  opts: { attempts?: number; waitMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<boolean> {
  const attempts = opts.attempts ?? 3
  const waitMs = opts.waitMs ?? 1500
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  for (let i = 0; i < attempts; i++) {
    let reached = false
    try { reached = await probe() } catch { reached = false }
    if (reached) return false
    if (i < attempts - 1) await sleep(waitMs)
  }
  return true
}

/** サーバーへ小さな HEAD を送る。返事が来れば（404 でも）届いたとみなす。4秒で諦める */
export function serverProbe(url = '/robots.txt', timeoutMs = 4000): OfflineProbe {
  return async () => {
    const c = typeof AbortController !== 'undefined' ? new AbortController() : null
    const t = c ? setTimeout(() => c.abort(), timeoutMs) : null
    try {
      await fetch(`${url}?_=${Date.now()}`, { method: 'HEAD', cache: 'no-store', signal: c?.signal })
      return true
    } catch { return false } finally { if (t) clearTimeout(t) }
  }
}
