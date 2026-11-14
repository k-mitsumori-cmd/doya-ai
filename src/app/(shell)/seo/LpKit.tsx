'use client'
// /renewal-preview/lp-seo 用。新しい共通の型（lp-kit）に、/seo の設定と画面の再現を渡す。
// 既存の Lp.tsx（本番の /seo）には触れない。
import { LpKitPage } from '@/components/lp-kit'
import { SEO_ACCENT, SEO_LP_CONTENT } from './lp-content'
import { SEO_VISUALS } from './lp-visuals'

export default function SeoLpKit({ hero }: { hero?: string }) {
  const variant = hero === 'a' || hero === 'b' ? hero : undefined
  return <LpKitPage content={SEO_LP_CONTENT} visuals={SEO_VISUALS} accent={SEO_ACCENT} heroVariant={variant} />
}
