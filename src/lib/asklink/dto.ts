// ドヤAI質問リンク 画面へ返す形への変換（署名URLは都度発行し、DBには保存しない）
import { signedUrl } from '@/lib/adimage/storage'
import type { AskLink, Audience, BannerCopy, BannerVerify, SiteProfile } from './types'
import { BANNER_SPECS } from './types'

export interface BannerDto {
  kind: string
  label: string
  use: string
  w: number
  h: number
  status: 'none' | 'pending' | 'generating' | 'done' | 'failed'
  url: string | null
  verify: BannerVerify | null
  /** 作り直せる残り回数 */
  remaining: number
}

export interface RunDto {
  id: string
  sourceUrl: string
  source: 'site' | 'manual'
  audience: Audience
  detectedAudience: Audience
  site: SiteProfile
  allowedUrls: string[]
  links: AskLink[]
  bannerCopy: BannerCopy | null
  banners: BannerDto[]
  createdAt: string
}

/** 1種類あたりの生成回数の上限（初回＋作り直し1回） */
export const BANNER_MAX_GENERATIONS = 2

type RunRow = {
  id: string
  sourceUrl: string
  source: string
  audience: string
  detectedAudience: string
  site: unknown
  allowedUrls: unknown
  links: unknown
  bannerCopy: unknown
  createdAt: Date
  banners: { kind: string; status: string; imagePath: string | null; verify: unknown; generations: number }[]
}

export async function toRunDto(run: RunRow): Promise<RunDto> {
  const banners = await Promise.all(
    BANNER_SPECS.map(async (spec): Promise<BannerDto> => {
      const b = run.banners.find((x) => x.kind === spec.kind)
      const url = b?.imagePath ? await signedUrl(b.imagePath, 3600).catch(() => null) : null
      return {
        kind: spec.kind,
        label: spec.label,
        use: spec.use,
        w: spec.w,
        h: spec.h,
        status: (b?.status as BannerDto['status']) || 'none',
        url,
        verify: (b?.verify as BannerVerify | null) ?? null,
        remaining: Math.max(0, BANNER_MAX_GENERATIONS - (b?.generations ?? 0)),
      }
    })
  )
  return {
    id: run.id,
    sourceUrl: run.sourceUrl,
    source: run.source === 'manual' ? 'manual' : 'site',
    audience: run.audience === 'b2c' ? 'b2c' : 'b2b',
    detectedAudience: run.detectedAudience === 'b2c' ? 'b2c' : 'b2b',
    site: run.site as SiteProfile,
    allowedUrls: (run.allowedUrls as string[]) || [],
    links: (run.links as AskLink[]) || [],
    bannerCopy: (run.bannerCopy as BannerCopy | null) ?? null,
    banners,
    createdAt: run.createdAt.toISOString(),
  }
}

export const RUN_SELECT = {
  id: true,
  sourceUrl: true,
  source: true,
  audience: true,
  detectedAudience: true,
  site: true,
  allowedUrls: true,
  links: true,
  bannerCopy: true,
  createdAt: true,
  banners: { select: { kind: true, status: true, imagePath: true, verify: true, generations: true } },
} as const
