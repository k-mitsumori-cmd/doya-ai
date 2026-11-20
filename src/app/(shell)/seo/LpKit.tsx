'use client'
// /renewal-preview/lp-seo 用。新しい共通の型（lp-kit）に、/seo の設定と画面の再現を渡す。
// 既存の Lp.tsx（本番の /seo）には触れない。
import { LpKitPage } from '@/components/lp-kit'
import { SEO_ACCENT, SEO_LP_CONTENT } from './lp-content'
import { SEO_VISUALS } from './lp-visuals'

export default function SeoLpKit({ hero }: { hero?: string }) {
  // 既定は案A（製品画面）。?hero=a2 は案Aにドヤくんを重ねる、?hero=c は絵が主役、?hero=b は既存の絵、?hero=text は文字だけ
  const variant = hero === 'b' ? 'b' : hero === 'a2' ? 'a2' : hero === 'c' ? 'c' : hero === 'text' || hero === 'none' ? undefined : 'a'
  return <LpKitPage content={SEO_LP_CONTENT} visuals={SEO_VISUALS} accent={SEO_ACCENT} heroVariant={variant} />
}
