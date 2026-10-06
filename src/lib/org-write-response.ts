import { parseAioBrandProfileInput } from './aio/brand-profile-input'
import { scanCoverageCounts } from './aio/coverage'
import { parseOrgProfileVersion } from './org-profile-version'

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const id = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(value)
const equal = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right)
const PROFILE_FIELDS = ['companyName', 'url', 'description', 'valueProp', 'products', 'targetCustomer', 'pricingNote', 'caseStudies'] as const
const webUrl = (value: unknown) => {
  if (typeof value !== 'string' || value.length > 8_192) return false
  try { const u = new URL(value); return !u.username && !u.password && (u.protocol === 'https:' || u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)) } catch { return false }
}

function versionConfirmed(input: Record<string, unknown>, profile: Record<string, unknown>) {
  if (!Object.prototype.hasOwnProperty.call(input, 'expectedUpdatedAt')) return true
  try {
    const before = parseOrgProfileVersion(input)
    const after = parseOrgProfileVersion({ expectedUpdatedAt: profile.updatedAt })
    return after instanceof Date && (before === null || before instanceof Date && after.getTime() > before.getTime())
  } catch { return false }
}

export function knownOrgWrite(service: 'aio' | 'shodan', path: string, method: string): boolean {
  let pathname: string
  try { pathname = new URL(path, 'https://org-client.invalid').pathname } catch { return false }
  const prefix = `/api/${service}`
  if (pathname === prefix + '/members') return method === 'POST'
  if (new RegExp(`^${prefix}/members/[a-zA-Z0-9_-]{1,200}$`).test(pathname)) return method === 'DELETE'
  if (service === 'aio') {
    if (pathname === prefix + '/brand-profile') return method === 'PUT'
    if (pathname === prefix + '/prompts' || pathname === prefix + '/scans') return method === 'POST'
    return /^\/api\/aio\/prompts\/[a-zA-Z0-9_-]{1,200}$/.test(pathname) && ['PATCH', 'DELETE'].includes(method)
  }
  if (pathname === prefix + '/company-profile') return method === 'PUT'
  if (pathname === prefix + '/company-profile/extract' || pathname === prefix + '/preparations') return method === 'POST'
  if (/^\/api\/shodan\/preparations\/[a-zA-Z0-9_-]{1,200}$/.test(pathname)) return method === 'DELETE'
  return /^\/api\/shodan\/preparations\/[a-zA-Z0-9_-]{1,200}\/(generate|slides\/generate|slides\/regenerate)$/.test(pathname) && method === 'POST'
}

/** These contracts mirror the currently used server routes, rather than trusting a generic 2xx. */
export function confirmedOrgWrite(service: 'aio' | 'shodan', path: string, method: string, body: unknown, data: Record<string, unknown>): boolean {
  if (data.error !== undefined || data.code !== undefined) return false
  const pathname = new URL(path, 'https://org-client.invalid').pathname
  const prefix = `/api/${service}`
  const input = record(body) ? body : {}
  const member = pathname.match(new RegExp(`^${prefix}/members/([a-zA-Z0-9_-]{1,200})$`))
  if (member && method === 'DELETE') return data.ok === true
  if (pathname === prefix + '/members' && method === 'POST') {
    const role = input.role === undefined ? 'member' : input.role
    return data.ok === true && typeof data.emailSent === 'boolean' && record(data.member) && id(data.member.id)
      && typeof input.email === 'string' && data.member.inviteEmail === input.email.trim().toLowerCase()
      && data.member.role === role && ['admin', 'manager', 'member'].includes(String(role))
      && (data.emailSent || webUrl(data.inviteUrl))
  }
  if (service === 'aio') {
    if (pathname === prefix + '/brand-profile' && method === 'PUT') {
      if (data.ok !== true || !record(data.profile) || !id(data.profile.id) || !versionConfirmed(input, data.profile)) return false
      const profile = data.profile
      try {
        const submitted = parseAioBrandProfileInput(input)
        return Object.entries(submitted).every(([key, value]) => equal(profile[key], value))
      } catch { return false }
    }
    if (pathname === prefix + '/prompts' && method === 'POST') {
      return data.ok === true && record(data.prompt) && id(data.prompt.id) && typeof input.text === 'string' && data.prompt.text === input.text.trim()
    }
    const prompt = pathname.match(/^\/api\/aio\/prompts\/([a-zA-Z0-9_-]{1,200})$/)
    if (prompt && method === 'PATCH') return data.ok === true && record(data.prompt) && data.prompt.id === prompt[1]
      && typeof input.isActive === 'boolean' && data.prompt.isActive === input.isActive
    if (prompt && method === 'DELETE') return data.ok === true && data.archived === true
    if (pathname === prefix + '/scans' && method === 'POST') return id(data.id) && data.status === 'done' && scanCoverageCounts(data.summary) !== null
    return false
  }
  if (pathname === prefix + '/company-profile' && method === 'PUT') {
    if (data.ok !== true || !record(data.profile) || !id(data.profile.id) || !versionConfirmed(input, data.profile)) return false
    const profile = data.profile
    const fieldsMatch = PROFILE_FIELDS.every(key => profile[key] === (typeof input[key] === 'string' ? input[key].trim().slice(0, 4_000) || null : null))
    const colors = Array.isArray(input.brandColors) ? input.brandColors.filter(value => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)).slice(0, 4) : null
    const rawLogo = typeof input.logoPath === 'string' ? input.logoPath.trim() : ''
    const logo = /^shodan\/logos\/[a-z0-9-]+\/[0-9a-fA-F-]{36}\.(png|jpg|webp)$/.test(rawLogo) ? rawLogo : null
    return fieldsMatch && equal(profile.brandColors, colors) && profile.logoPath === logo
  }
  if (pathname === prefix + '/company-profile/extract' && method === 'POST') {
    const suggested = data.suggested
    return record(suggested) && PROFILE_FIELDS.every(key => typeof suggested[key] === 'string')
      && Array.isArray(data.gaps) && data.gaps.every(key => typeof key === 'string' && PROFILE_FIELDS.includes(key as typeof PROFILE_FIELDS[number]))
  }
  if (pathname === prefix + '/preparations' && method === 'POST') return id(data.id) && data.status === 'researched' && record(data.research) && Object.keys(data.research).length > 0
  const prep = pathname.match(/^\/api\/shodan\/preparations\/([a-zA-Z0-9_-]{1,200})(\/generate|\/slides\/generate|\/slides\/regenerate)?$/)
  if (!prep) return false
  if (!prep[2] && method === 'DELETE') return data.ok === true
  if (method !== 'POST') return false
  if (prep[2] === '/generate') return data.id === prep[1] && data.status === 'done'
  if (prep[2] === '/slides/generate') return data.success === true && [data.count, data.total, data.remaining].every(value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
    && Number(data.total) > 0 && Number(data.count) <= Number(data.total) && Number(data.count) + Number(data.remaining) === Number(data.total)
  if (prep[2] === '/slides/regenerate') return data.success === true && record(data.data) && data.data.index === input.index
    && typeof input.index === 'number' && Number.isSafeInteger(input.index) && input.index >= 0
    && record(data.data.image) && typeof data.data.image.title === 'string' && typeof data.data.image.role === 'string' && webUrl(data.data.image.imageUrl)
  return false
}
