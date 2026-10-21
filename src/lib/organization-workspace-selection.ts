/** The host workspace is explicit in the URL; storage is only an entry hint. */
export type OrganizationSelection = { kind: 'absent' } | { kind: 'invalid' } | { kind: 'selected'; slug: string }
export type WorkspaceRole = 'owner' | 'admin' | 'manager' | 'member'
export interface WorkspaceOrganization { id: string; slug: string; name: string; role: WorkspaceRole }
export interface WorkspaceRead {
  service: 'aishodan'
  actorId: string
  memberships: WorkspaceOrganization[]
  current: WorkspaceOrganization | null
}
export interface WorkspaceProof {
  actorId: string
  organization: WorkspaceOrganization
  revision: number
  current: () => boolean
  href: (path: string) => string
  api: (path: string) => string
}

export function validWorkspaceSlug(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 512
    && value !== '.' && value !== '..' && !/[\s/\\?#\u0000-\u001f\u007f]/.test(value)
}

/** Decode exactly once and retain the difference between absent and invalid. */
export function organizationSelection(search: string): OrganizationSelection {
  const values: string[] = []
  try {
    for (const pair of search.replace(/^\?/, '').split('&')) {
      const split = pair.indexOf('=')
      const key = decodeURIComponent((split < 0 ? pair : pair.slice(0, split)).replace(/\+/g, ' '))
      if (key === 'org') values.push(decodeURIComponent((split < 0 ? '' : pair.slice(split + 1)).replace(/\+/g, ' ')))
    }
  } catch { return { kind: 'invalid' } }
  if (!values.length) return { kind: 'absent' }
  return values.length === 1 && validWorkspaceSlug(values[0])
    ? { kind: 'selected', slug: values[0] } : { kind: 'invalid' }
}

/** Only host work links use this helper. Public rooms and invite URLs stay unchanged. */
export function workspaceHref(path: string, slug: string): string {
  if (!validWorkspaceSlug(slug) || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) throw new Error('Invalid workspace link')
  const url = new URL(path, 'https://workspace.invalid')
  if (url.origin !== 'https://workspace.invalid' || !/^\/aishodan(?:\/|$)/.test(url.pathname) || /^\/aishodan\/invite(?:\/|$)/.test(url.pathname)) throw new Error('Invalid workspace link')
  url.searchParams.set('org', slug)
  return url.pathname + url.search + url.hash
}

export function workspaceApi(path: string, slug: string): string {
  if (!validWorkspaceSlug(slug) || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) throw new Error('Invalid workspace request')
  const url = new URL(path, 'https://workspace.invalid')
  if (url.origin !== 'https://workspace.invalid' || !/^\/api\/aishodan(?:\/|$)/.test(url.pathname) || url.hash) throw new Error('Invalid workspace request')
  url.searchParams.set('org', slug)
  return url.pathname + url.search
}

export function parseWorkspaceRead(value: unknown, actorId: string, requested: OrganizationSelection): WorkspaceRead {
  const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
  const organization = (v: unknown): v is WorkspaceOrganization => record(v)
    && typeof v.id === 'string' && v.id.length > 0 && v.id.length <= 512
    && validWorkspaceSlug(v.slug) && typeof v.name === 'string' && v.name.trim().length > 0 && v.name.length <= 512
    && typeof v.role === 'string' && ['owner', 'admin', 'manager', 'member'].includes(v.role)
  if (!actorId || requested.kind === 'invalid' || !record(value) || value.service !== 'aishodan'
      || value.actorId !== actorId || value.error !== undefined || value.code !== undefined
      || !Array.isArray(value.memberships) || !value.memberships.every(organization)
      || new Set(value.memberships.map(row => row.id)).size !== value.memberships.length
      || new Set(value.memberships.map(row => row.slug)).size !== value.memberships.length
      || value.current !== null && !organization(value.current)) throw new Error('Workspace could not be confirmed')
  const current = value.current as WorkspaceOrganization | null
  if (current && !value.memberships.some(row => row.id === current.id && row.slug === current.slug && row.name === current.name && row.role === current.role)
      || requested.kind === 'selected' && (!current || current.slug !== requested.slug)
      || value.memberships.length > 0 && !current) throw new Error('Workspace could not be confirmed')
  return { service: 'aishodan', actorId, memberships: value.memberships, current }
}
