import type { Metadata } from 'next'
import Link from 'next/link'
import { getActiveServices } from '@/lib/services'
import { UNIFIED_PRO_PRICE_LABEL } from '@/lib/unified-plan'
import {
  LpShell, Hero, HowItWorks, Benefits, FaqSection, CtaBand, Sym, SectionHeading,
  type Step, type Benefit, type Faq,
} from '@/components/lp'
import { UnifiedPricingPlans } from '@/components/UnifiedPricingPlans'

export const metadata: Metadata = {
  title: '統一プラン｜プロ1つで全サービス使い放題 | ドヤマーケAI',
  description:
    'プロプランを1つ契約するだけで、ドヤAIの全サービスのプロ機能が使い放題。記事・バナー・営業リスト・人事・勤怠・SFAなど、B2Bに必要なAIツールが月々¥9,980でまるごと揃う統一プラン。',
  alternates: { canonical: '/all-in-one' },
}

const ACCENT = '#ff1e72'

const STEPS: Step[] = [
  { icon: 'workspace_premium', title: 'プロを1つ契約', desc: 'お好きなサービスのプロプランを1つ契約するだけ。難しい組み合わせや個別契約は不要です。' },
  { icon: 'lock_open', title: '全サービスが自動で解放', desc: '同じアカウントで、ドヤAIの全サービスのプロ機能（上限アップ）が自動的に使えるようになります。' },
  { icon: 'all_inclusive', title: '追加課金なしで使い放題', desc: '追加料金は一切なし。すべてのサービスのプロを、心ゆくまで使い倒せます。' },
]

const BENEFITS: Benefit[] = [
  { icon: 'apps', title: '全サービス使い放題', desc: 'バナー・記事・営業リスト・人事・勤怠・SFA・資料作成まで、すべてのプロが1契約で使えます。' },
  { icon: 'trending_up', title: 'サービスは増え続ける', desc: '新サービスが追加されても追加料金なし。早く入るほど、受け取れる価値はどんどん大きくなります。' },
  { icon: 'account_circle', title: 'アカウントも請求も1つ', desc: 'すべて同じアカウントで利用。ログインも請求もまとまり、運用がシンプルになります。' },
]

const FAQ: Faq[] = [
  { q: '本当に1契約で全サービス使えますか？', a: 'はい。プロプランを1つ契約すると、同じアカウントでドヤAIの全サービスのプロ機能（上限アップ）が使えます。サービスごとの追加契約は不要です。' },
  { q: 'どのサービスで契約すればいいですか？', a: 'どのサービスのプロでも同じ統一プラン（月々¥9,980）です。お好きなサービスのプロから契約してください。契約後は全サービスに反映されます。' },
  { q: '新しいサービスが増えたら追加料金はかかりますか？', a: 'いいえ。新サービスが追加されても追加料金なしでお使いいただけます。ラインナップが増えるほどお得になります。' },
  { q: '無料でも使えますか？', a: '各サービスに無料プランがあり、まずは無料でお試しいただけます。プロにすると全サービスの上限が大きく広がります。' },
  { q: '解約はできますか？', a: 'いつでも解約できます。お支払い方法の変更・解約は各料金ページ、またはお支払い管理からお手続きいただけます。' },
]

export default function AllInOnePage() {
  const services = getActiveServices()
  const count = services.length
  const totalProValue = services.reduce((sum, s) => sum + (s.pricing?.pro?.price || 0), 0)

  return (
    <LpShell serviceName="統一プラン" icon="all_inclusive" ctaHref="/banner" ctaLabel="無料ではじめる" accent={ACCENT}>
      <Hero
        eyebrow="統一プラン"
        title="その1契約で、"
        highlight="ぜんぶ使える。"
        subtitle={`ドヤAIの全${count}サービスのプロ機能が、月々${UNIFIED_PRO_PRICE_LABEL}で使い放題。個別契約も、組み合わせも要りません。`}
        note="まずは無料で。クレジットカード不要ではじめられます"
        ctaHref="/banner"
        ctaLabel="無料ではじめる"
        subCtaHref="#pricing"
        subCtaLabel="料金を見る"
        mood="present"
      />

      {/* 価値アンカー */}
      {totalProValue > 0 && (
        <section className="relative -mt-6 pb-4">
          <div className="max-w-2xl mx-auto px-5">
            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm px-5 py-4 flex flex-wrap items-center justify-center gap-3 text-center">
              <span className="text-sm font-bold text-slate-400 line-through">単体で全部そろえると 月¥{totalProValue.toLocaleString()} 相当</span>
              <Sym name="arrow_forward" size={18} className="text-slate-300" />
              <span className="text-lg font-black" style={{ color: '#0066ff' }}>まとめて {UNIFIED_PRO_PRICE_LABEL}/月</span>
            </div>
          </div>
        </section>
      )}

      <HowItWorks title={<>契約はシンプル、<br className="md:hidden" />使える範囲は無限大。</>} lead="たった3ステップで、全サービスが使い放題になります。" steps={STEPS} />
      <Benefits title="統一プランが選ばれる理由" items={BENEFITS} />

      {/* 1契約で使える全サービス */}
      <section id="services" className="relative py-20 md:py-28 bg-slate-50/70 scroll-mt-16">
        <div className="max-w-6xl mx-auto px-5">
          <SectionHeading eyebrow="ALL SERVICES" title={<>1契約で使える{count}サービス</>} lead="すべてのプロ機能が、追加課金なしで使い放題に。" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s, i) => (
              <Link key={s.id} href={s.dashboardHref}
                className="group flex flex-col gap-3 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg hover:border-[color:#0066ff]">
                <div className="flex items-center gap-3">
                  <span className="grid place-items-center w-11 h-11 rounded-2xl text-white font-black shadow-md shrink-0"
                    style={{ background: `linear-gradient(135deg, #0066ff, ${ACCENT})` }}>{s.name.replace(/^ドヤ|^カンタン/, '').charAt(0) || 'A'}</span>
                  <h3 className="text-base font-black text-slate-900 leading-tight">{s.name}</h3>
                </div>
                <p className="text-sm text-slate-500 font-medium leading-relaxed line-clamp-2">{s.description}</p>
                <span className="mt-auto inline-flex items-center gap-1 text-sm font-black" style={{ color: '#0066ff' }}>
                  くわしく見る<Sym name="arrow_forward" size={16} className="transition group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 料金（購入導線） */}
      <section id="pricing" className="relative py-20 md:py-28 scroll-mt-16">
        <div className="max-w-6xl mx-auto px-5">
          <SectionHeading eyebrow="PRICING" title="料金はシンプルに2つだけ" lead="無料ではじめて、プロで全サービスを解放。" />
          <UnifiedPricingPlans serviceId="banner" />
        </div>
      </section>

      <FaqSection items={FAQ} />

      <CtaBand
        title={<>さあ、1契約で<br className="md:hidden" />ぜんぶ始めよう。</>}
        subtitle="まずは無料で。B2Bマーケに必要なAIツールを、まるごと体験してください。"
        ctaHref="/banner"
        ctaLabel="無料ではじめる"
        note="新サービスが増えても追加料金なし。早く入るほどお得です"
      />
    </LpShell>
  )
}
