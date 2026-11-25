/**
 * メールの正規化（純粋関数。DB・ネットワークに触らない）。
 *
 * 目的: User.emailNormalized 列と、結び付けの照合（link-decision.ts）で、同じメールを同じ文字列にそろえる。
 * User.email 自体は書き換えない（reference/11-billing-spec.md の INV-6。Stripe の顧客をメールで横断するため）。
 *
 * 2つの列を分けて持つ。
 *  - 既定の正規化（normalizeEmail）: Unicode NFKC、前後の空白を除く、小文字にする。この列だけを照合に使う。
 *  - Gmail の別名の除去（gmailCanonicalKey）: ドットと +タグを除く。別人の誤判定があり得るので、
 *    一意の制約にも自動の結び付けにも使わない。「同じ人らしい」候補を目で確かめる用途だけ。
 *    ※ 2026-11-25 三森さんの決定: 初月無料と「最初の100」の判定にだけ使う（trial-siblings.server.ts、starter.ts）。
 *      一意の制約・自動の結び付けには使わない。
 */

const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com'])
/** Apple の「メールを隠す」で使われる中継のドメイン。 */
export const APPLE_PRIVATE_RELAY_DOMAIN = 'privaterelay.appleid.com'

/**
 * 既定の正規化。メールとして使えない入力（文字列でない、空、@ が1つで前後に文字がある形でない）は null を返す。
 * 順序は NFKC、前後の空白の除去、小文字化。NFKC を先に行うのは、全角の空白（U+3000）や全角の英数字を
 * 半角にそろえてから trim と小文字化をするため。
 * 小文字化は toLowerCase（ロケール非依存）。トルコ語の I などの問題を避けるため toLocaleLowerCase は使わない。
 */
export function normalizeEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null
  const v = email.normalize('NFKC').trim().toLowerCase()
  if (!v) return null
  const at = v.indexOf('@')
  if (at <= 0 || at !== v.lastIndexOf('@') || at === v.length - 1) return null
  // 空白や制御文字を含むものは、メールとして扱わない
  if (/[\s\u0000-\u001f\u007f]/.test(v)) return null
  return v
}

/**
 * Gmail のドットと +タグを除いた比較用の鍵。決定待ち（使うかどうか未定）。
 * Gmail 系のドメイン（gmail.com / googlemail.com）は gmail.com にそろえ、ローカル部のドットと +以降を除く。
 * それ以外のドメインは +タグだけ除く（ドットは別の宛先の可能性があるため残す）。
 * 一意の制約・自動の結び付けには使わない。
 */
export function gmailCanonicalKey(email: unknown): string | null {
  const n = normalizeEmail(email)
  if (!n) return null
  const [local, domain] = n.split('@')
  const noTag = local.split('+')[0]
  if (GMAIL_DOMAINS.has(domain)) return `${noTag.replace(/\./g, '')}@gmail.com`
  return noTag ? `${noTag}@${domain}` : null
}

/** Gmail 系（gmail.com / googlemail.com）のアドレスか。 */
export function isGmailAddress(email: unknown): boolean {
  const n = normalizeEmail(email)
  if (!n) return false
  return GMAIL_DOMAINS.has(n.slice(n.indexOf('@') + 1))
}

/** Apple の「メールを隠す」のアドレスか。ユーザーの照合・招待の照合には使わない（連絡用に控えるだけ）。 */
export function isApplePrivateRelay(email: unknown): boolean {
  const n = normalizeEmail(email)
  if (!n) return false
  const domain = n.slice(n.indexOf('@') + 1)
  return domain === APPLE_PRIVATE_RELAY_DOMAIN
}
