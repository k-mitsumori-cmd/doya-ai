/** Existing Quote mounted suites use this verified-proof adapter after the URL-scope change.
 * It preserves their original synthetic API/actor assertions; the actual boundary has its own mounted suite. */
module.exports = function quoteWorkspaceFixture(React, { actor, status, role = () => 'owner', empty = () => false, defaultOrg = () => 'alpha' }) {
  let currentKey = '', revision = 0, proof = null
  const selected = () => window.localStorage.getItem('doya.quote.org') || defaultOrg()
  const href = (path, slug) => { const url = new URL(path, 'https://quote-fixture.invalid'); url.searchParams.set('org', slug); return url.pathname + url.search + url.hash }
  function currentProof() {
    if (empty()) return null
    const slug = selected(), key = JSON.stringify([actor(), slug, role()])
    if (key !== currentKey) {
      currentKey = key; revision++
      const bound = revision, boundActor = actor()
      proof = { actorId: boundActor, organization: { id: 'id-' + slug, slug, name: slug, role: role() }, revision: bound,
        current: () => status() === 'authenticated' && actor() === boundActor && selected() === slug && revision === bound,
        href: path => href(path, slug), api: path => href(path, slug) }
    }
    return proof
  }
  function useQuoteWorkspace() {
    const [, rerender] = React.useState(0)
    React.useEffect(() => {
      const changed = () => rerender(n => n + 1)
      window.addEventListener('quote:organization-changed', changed)
      window.addEventListener('storage', changed)
      return () => { window.removeEventListener('quote:organization-changed', changed); window.removeEventListener('storage', changed) }
    }, [])
    const value = currentProof()
    return { scope: value ? { kind: 'ready', proof: value, memberships: ['alpha', 'beta'].map(slug => ({ id: 'id-' + slug, slug, name: slug, role: role() })) } : { kind: 'empty' },
      switchTo: slug => { window.localStorage.setItem('doya.quote.org', slug); window.dispatchEvent(new window.StorageEvent('storage', { key: 'doya.quote.org' })) }, retry: () => {} }
  }
  return { useQuoteWorkspace, useOptionalQuoteWorkspace: useQuoteWorkspace }
}
