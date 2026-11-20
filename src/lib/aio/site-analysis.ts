// ドヤAIO：サイトを読み、サービスの内容を整理する（確認画面と開始処理の両方で使う）
import { readSiteForAio, type SiteRead, type PageFetcher } from '@/lib/aio/site-reader'
import { extractServiceProfile, profileUsable, type ServiceProfile } from '@/lib/aio/service-profile'

export interface SiteAnalysis {
  read: SiteRead
  /** 読み取れたとき。読み取れなかったときは null */
  profile: ServiceProfile | null
  /** 質問を作ってよいか。false のときは質問を作らず、利用者に説明を入れてもらう */
  usable: boolean
}

export async function analyzeSite(
  url: string,
  deps: { fetcher?: PageFetcher; extract?: (context: string) => Promise<ServiceProfile> } = {},
): Promise<SiteAnalysis> {
  const read = await readSiteForAio(url, deps.fetcher)
  if (!read.readability.sufficient) return { read, profile: null, usable: false }
  try {
    const profile = await (deps.extract || extractServiceProfile)(read.context)
    return { read, profile, usable: profileUsable(profile) }
  } catch {
    return { read, profile: null, usable: false }
  }
}

export interface SiteReadRecord {
  version: 1
  at: string
  url: string
  sources: string[]
  bodyChars: number
  totalChars: number
  pagesRead: string[]
  sufficient: boolean
  userProvided: boolean
  profile: Pick<ServiceProfile, 'summary' | 'audience' | 'industry' | 'competitorKind' | 'evidence'> | null
}

export const siteReadKey = (organizationId: string) => `aio-site-read:v1:${organizationId}`

export function buildSiteReadRecord(url: string, read: SiteRead | null, profile: ServiceProfile | null, now = new Date()): SiteReadRecord {
  return {
    version: 1, at: now.toISOString(), url,
    sources: [...(read?.readability.sources || []), ...(profile?.userProvided ? ['user'] : [])],
    bodyChars: read?.readability.bodyChars ?? 0, totalChars: read?.readability.totalChars ?? 0,
    pagesRead: (read?.pages || []).map(p => p.url).slice(0, 6),
    sufficient: !!read?.readability.sufficient, userProvided: !!profile?.userProvided,
    profile: profile ? { summary: profile.summary, audience: profile.audience, industry: profile.industry, competitorKind: profile.competitorKind, evidence: profile.evidence } : null,
  }
}
