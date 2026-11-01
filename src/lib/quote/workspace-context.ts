/** Scope a quote draft and its requests to one verified actor and organization. */
export interface QuoteWorkspaceIdentity {
  actor: string
  selection: string | null
  status: 'loading' | 'authenticated' | 'unauthenticated'
}
export class QuoteWorkspaceContext {
  private epoch = 0
  private identity: QuoteWorkspaceIdentity = { actor: '', selection: null, status: 'loading' }
  private organization: string | null = null
  private deniedIdentity: string | null = null
  private operations = new Map<string, AbortController>()
  constructor(private readonly selectedOrganization: () => string | null, private readonly service: 'quote' | 'aishodan' = 'quote') {}

  update(identity: QuoteWorkspaceIdentity) {
    if (identity.actor !== this.identity.actor || identity.selection !== this.identity.selection || identity.status !== this.identity.status) {
      if (identity.actor !== this.identity.actor || identity.selection !== this.identity.selection || identity.status === 'unauthenticated') this.deniedIdentity = null
      this.invalidate()
      this.organization = null
      this.identity = { ...identity }
    }
    return this.epoch
  }
  /** Also invalidate same-identity reloads and A -> B -> A switches. */
  invalidate() {
    this.epoch++
    for (const controller of this.operations.values()) controller.abort()
    this.operations.clear()
    this.organization = null
  }
  rejectAuthentication(epoch: number) {
    if (!this.isCurrent(epoch)) return
    this.deniedIdentity = JSON.stringify([this.identity.actor, this.identity.selection])
    this.invalidate()
  }
  isCurrent(epoch: number) {
    return this.deniedIdentity !== JSON.stringify([this.identity.actor, this.identity.selection])
      && epoch === this.epoch && this.identity.status === 'authenticated' && !!this.identity.actor
      && this.selectedOrganization() === this.identity.selection
  }
  verifyOrganization(epoch: number, slug: unknown) {
    if (!this.isCurrent(epoch) || typeof slug !== 'string' || !slug || slug.length > 512
      || this.identity.selection !== null && slug !== this.identity.selection) return false
    this.organization = slug
    return true
  }
  begin(name: string, bootstrap = false, expectedEpoch = this.epoch) {
    const epoch = expectedEpoch
    if (!name || !this.isCurrent(epoch) || this.operations.has(name) || !bootstrap && !this.organization) return null
    const controller = new AbortController()
    this.operations.set(name, controller)
    const organization = this.organization
    const actor = this.identity.actor
    const current = () => this.isCurrent(epoch) && !controller.signal.aborted && this.operations.get(name) === controller
    return {
      actor, organization, epoch, signal: controller.signal, current,
      url: (path: string) => {
        if (!current()) return null
        let url: URL
        try { url = new URL(path, 'https://quote-context.invalid') } catch { return null }
        if (url.origin !== 'https://quote-context.invalid' || !url.pathname.startsWith(`/api/${this.service}/`) || url.hash) return null
        // The only unverified read is organization discovery. No draft may use an implicit scope.
        if (!organization && (!bootstrap || url.pathname !== `/api/${this.service}/organizations`)) return null
        const scope = organization || this.identity.selection
        if (scope) url.searchParams.set('org', scope)
        else url.searchParams.delete('org')
        return url.pathname + url.search
      },
      end: () => {
        if (this.operations.get(name) === controller) this.operations.delete(name)
        controller.abort()
      },
    }
  }
}
