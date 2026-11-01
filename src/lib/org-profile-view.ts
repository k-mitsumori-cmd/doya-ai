import { parseOrgProfileVersion } from './org-profile-version'

const AIO_FIELDS = ['brandName', 'brandUrl', 'category', 'market']
export const SHODAN_PROFILE_FIELDS = ['companyName', 'url', 'description', 'valueProp', 'products', 'targetCustomer', 'pricingNote', 'caseStudies'] as const
export function readOrgProfile(service: 'aio' | 'shodan', value: unknown) {
  const fail = () => { throw new Error('保存済みの設定を確認できませんでした。再読み込みしてください。') }
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.prototype.hasOwnProperty.call(value, 'profile')) return fail()
  const data = value as Record<string, unknown>
  if (data.error !== undefined || data.code !== undefined) return fail()
  const raw = data.profile
  if (raw === null) return { profile: null, version: null }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail()
  const profile = raw as Record<string, unknown>
  if (typeof profile.id !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(profile.id)) return fail()
  const date = parseOrgProfileVersion({ expectedUpdatedAt: profile.updatedAt })
  if (!(date instanceof Date)) return fail()
  if ((service === 'aio' ? AIO_FIELDS : SHODAN_PROFILE_FIELDS).some(key => profile[key] !== null && typeof profile[key] !== 'string')) return fail()
  for (const key of service === 'aio' ? ['aliases', 'competitors'] : ['brandColors']) {
    const list = profile[key]
    if (list !== null && (!Array.isArray(list) || list.some(item => typeof item !== 'string'))) return fail()
  }
  if (service === 'shodan' && Array.isArray(profile.brandColors) && (profile.brandColors.length > 4 || profile.brandColors.some(v => typeof v !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(v)))) return fail()
  if (service === 'shodan' && ((profile.logoPath !== null && typeof profile.logoPath !== 'string') || (profile.logoUrl !== null && typeof profile.logoUrl !== 'string'))) return fail()
  return { profile, version: date.toISOString() }
}
