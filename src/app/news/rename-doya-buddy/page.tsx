// 名前の変更のお知らせのページ（ドヤAI → ドヤバディ）。ログイン前でも読める公開ページ
// ⚠️ 旗 NEXT_PUBLIC_BRAND_RENAME_ROLLOUT=all のときだけ出す。off のときは 404（今の画面のまま）。
// ⚠️ 文面は src/lib/brand/rename-news.ts（本人と法務の確認前の案）。このファイルには旧名を直接書かない（ビルド時の置き換えの対象のため）。
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { brandAlternateNames, isBrandRenamed } from '@/lib/brand'
import { RENAME_NEWS, RENAME_NEWS_PATH, renameDate, renameDateLabel } from '@/lib/brand/rename-news'
import { SITE_CONFIG } from '@/lib/seo'

export const dynamic = 'force-static'

// ⚠️ 旗が off のときは、メタデータも空にする（404 の画面の中に、新しい名前が出ないように）
export const metadata: Metadata = isBrandRenamed()
  ? {
      title: RENAME_NEWS.title,
      description: RENAME_NEWS.description,
      alternates: { canonical: RENAME_NEWS_PATH },
      openGraph: { title: RENAME_NEWS.title, description: RENAME_NEWS.description, type: 'article' },
    }
  : {}

export default function RenameNewsPage() {
  if (!isBrandRenamed()) notFound()
  const date = renameDate()
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: RENAME_NEWS.title,
    description: RENAME_NEWS.description,
    datePublished: date,
    mainEntityOfPage: `${SITE_CONFIG.url}${RENAME_NEWS_PATH}`,
    publisher: { '@type': 'Organization', name: '株式会社スリスタ' },
    about: { '@type': 'SoftwareApplication', name: SITE_CONFIG.name, alternateName: brandAlternateNames(true), url: SITE_CONFIG.url },
  }
  return (
    <main className="mx-auto max-w-2xl px-5 py-12 text-slate-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <p className="text-sm font-bold text-slate-500">お知らせ</p>
      <h1 className="mt-2 text-3xl font-black leading-tight" style={{ textWrap: 'balance' }}>{RENAME_NEWS.title}</h1>
      <p className="mt-6 leading-8 text-slate-700">{RENAME_NEWS.lead(renameDateLabel(date))}</p>
      <h2 className="mt-10 text-xl font-black">変わること</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 leading-8 text-slate-700">
        {RENAME_NEWS.changes.map((t) => <li key={t}>{t}</li>)}
      </ul>
      <h2 className="mt-10 text-xl font-black">変わらないこと</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 leading-8 text-slate-700">
        {RENAME_NEWS.unchanged.map((t) => <li key={t}>{t}</li>)}
      </ul>
      <h2 className="mt-10 text-xl font-black">よくある質問</h2>
      <dl className="mt-3 space-y-5">
        {RENAME_NEWS.faq.map((f) => (
          <div key={f.q}>
            <dt className="font-bold">{f.q}</dt>
            <dd className="mt-1 leading-8 text-slate-700">{f.a}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-12"><Link href="/" className="font-bold text-blue-600 underline">トップページへ</Link></p>
    </main>
  )
}
