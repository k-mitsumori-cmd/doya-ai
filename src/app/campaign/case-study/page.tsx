import type { Metadata } from 'next'
import Link from 'next/link'
import CaseStudyForm from './Form'
import { UNIFIED_PRO_PRICE_LABEL } from '@/lib/unified-plan'

// ⚠️ 募集ページなので検索には出す。canonical はこのパスで固定する。
export const metadata: Metadata = {
  title: { absolute: '活用事例・ロゴ掲載キャンペーン｜6ヶ月無料 | ドヤマーケAI' },
  description:
    '30分ほどのオンライン取材と、企業ロゴ・サービスロゴの掲載にご協力いただいた方に、ドヤマーケAIのプロプランを6ヶ月無料でご提供します。',
  alternates: { canonical: '/campaign/case-study' },
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    url: 'https://doya-ai.surisuta.jp/campaign/case-study',
    siteName: 'ドヤマーケAI',
    title: '活用事例・ロゴ掲載キャンペーン｜6ヶ月無料',
    description:
      '30分ほどのオンライン取材と、ロゴ掲載にご協力いただいた方にプロプランを6ヶ月無料でご提供します。',
  },
}

const STEPS = [
  { n: 1, title: 'このページから申し込む', body: '所要2分ほどです。ご利用中のサービスと、掲載可否をお知らせください。' },
  { n: 2, title: '日程を調整する', body: '2営業日以内に担当よりご連絡します。オンラインで30分ほどのお時間をいただきます。' },
  { n: 3, title: '6ヶ月無料を反映する', body: '取材の日程が確定した時点で、プロプランを6ヶ月無料の状態に切り替えます。' },
  { n: 4, title: '取材と掲載', body: '内容は公開前に必ずご確認いただきます。掲載を見送りたい箇所があれば削ります。' },
]

export default function CaseStudyCampaignPage() {
  return (
    <main className="min-h-screen bg-slate-50 pb-20">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <Link href="/" className="text-xs font-bold text-slate-500 hover:underline">← ドヤマーケAI</Link>

        <span className="mt-6 inline-flex items-center rounded-full bg-[#0066ff]/10 px-3 py-1 text-xs font-black tracking-wide text-[#0066ff]">
          活用事例・ロゴ掲載キャンペーン
        </span>
        <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight text-slate-900 sm:text-4xl">
          30分の取材とロゴ掲載で、
          <br />
          プロプランが<span className="text-[#0066ff]">6ヶ月無料</span>。
        </h1>
        <p className="mt-4 text-sm font-semibold leading-relaxed text-slate-600 sm:text-base">
          ドヤマーケAIをどう使っていただいているかを、オンラインで30分ほどうかがわせてください。
          あわせて御社のロゴ・サービスロゴを当サイトに掲載させていただける方に、
          プロプラン（通常 {UNIFIED_PRO_PRICE_LABEL}/月）を6ヶ月無料でご提供します。
        </p>

        <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-base font-black text-slate-900">進め方</h2>
          <ol className="mt-4 space-y-4">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0066ff] text-xs font-black text-white">
                  {s.n}
                </span>
                <div>
                  <p className="text-sm font-black text-slate-900">{s.title}</p>
                  <p className="mt-0.5 text-sm font-semibold leading-relaxed text-slate-600">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-base font-black text-slate-900">あらかじめお伝えしておくこと</h2>
          <ul className="mt-3 space-y-2 text-sm font-semibold leading-relaxed text-slate-600">
            <li>・公開前に必ず内容をご確認いただきます。見送りたい箇所は削ります。</li>
            <li>・具体的な数値や社内の固有名詞は、伏せた形での掲載も承ります。</li>
            <li>・6ヶ月の無料期間が終わったあとは、通常のプロプランに戻ります。自動で高額なプランに切り替わることはありません。</li>
            <li>・期間中に解約いただいても、費用は一切かかりません。</li>
          </ul>
        </div>

        <div className="mt-8">
          <h2 className="mb-4 text-lg font-black text-slate-900">お申し込み</h2>
          <CaseStudyForm />
        </div>
      </div>
    </main>
  )
}
