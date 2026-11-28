import type { IdTokenProvider, Jwks } from './id-token'

/** Apple・Google の公開鍵の取得先（取得は呼び出し側。fetch は注入する） */
export const JWKS_URLS: Record<IdTokenProvider, string> = {
  apple: 'https://appleid.apple.com/auth/keys',
  google: 'https://www.googleapis.com/oauth2/v3/certs',
}

export const JWKS_CACHE_TTL_MS = 10 * 60 * 1000
/** 強制の取り直し（kid が見つからないとき）の最小の間隔。これより短い間隔の強制は、キャッシュをそのまま返す（偽の kid で、外部への取得を繰り返させない） */
export const JWKS_MIN_FORCE_INTERVAL_MS = 60 * 1000
const FETCH_TIMEOUT_MS = 5000

export class JwksUnavailableError extends Error {
  constructor() {
    super('jwks unavailable')
    this.name = 'JwksUnavailableError'
  }
}

export type JwksCache = Map<IdTokenProvider, { jwks: Jwks; fetchedAt: number }>
const defaultCache: JwksCache = new Map()

/**
 * 公開鍵の一覧を取る。10分はメモリに置く（同じサーバーの中だけ）。forceRefresh は、鍵が入れ替わった疑い（kid が見つからない）のとき。
 * fetch は引数で受け取る（試験は偽の fetch）。取得できない・形が違うときは JwksUnavailableError。
 */
export async function getJwks(
  provider: IdTokenProvider,
  opts: { fetchImpl: typeof fetch; now: Date; forceRefresh?: boolean; cache?: JwksCache },
): Promise<Jwks> {
  const cache = opts.cache ?? defaultCache
  const hit = cache.get(provider)
  const forceRefresh = Boolean(opts.forceRefresh) && !(hit && opts.now.getTime() - hit.fetchedAt < JWKS_MIN_FORCE_INTERVAL_MS)
  if (!forceRefresh && hit && opts.now.getTime() - hit.fetchedAt < JWKS_CACHE_TTL_MS) return hit.jwks
  try {
    const res = await opts.fetchImpl(JWKS_URLS[provider], { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { accept: 'application/json' } })
    if (!res.ok) throw new Error('status')
    const json = (await res.json()) as Jwks
    if (!json || !Array.isArray(json.keys) || json.keys.length === 0) throw new Error('shape')
    cache.set(provider, { jwks: json, fetchedAt: opts.now.getTime() })
    return json
  } catch {
    // 取得に失敗したとき、古い鍵が残っていれば、強制の更新でなければそれを使い続ける
    if (hit && !forceRefresh) return hit.jwks
    throw new JwksUnavailableError()
  }
}
