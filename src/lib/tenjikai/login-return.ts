/** ログイン後に元の展示会URLへ戻す。外部URLや他サービスは戻り先にしない。 */
export function tenjikaiLoginHref(pathname: string | null, query: { toString(): string } | null): string {
  const safePath = pathname && /^\/tenjikai(?:\/(?:overview|booth|creatives|novelty|budget|vendors|docs))?\/?$/.test(pathname)
    ? pathname : '/tenjikai'
  const search = query?.toString() ?? ''
  const callbackUrl = `${safePath}${search ? `?${search}` : ''}`
  return `/auth/signin?${new URLSearchParams({ callbackUrl }).toString()}`
}
