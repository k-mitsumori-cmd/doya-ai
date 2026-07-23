'use client'

import { useSession } from 'next-auth/react'
import { getServiceById } from '@/lib/services'
import {
  LpShell, Hero, HowItWorks, Benefits, FeatureGrid, UseCases, FaqSection, CtaBand,
} from '@/components/lp'
import { ACCENT, CTA, STEPS, BENEFITS, FAQ } from './lp-data'

const SVC = getServiceById('kantan')!

export default function KantanEntryPage() {
  const { data: session } = useSession()
  // ログイン済みはダッシュボードへ、未ログインはサインインへ
  const ctaHref = session ? '/kantan/dashboard' : CTA
  const ctaLabel = session ? 'ダッシュボードへ' : '無料ではじめる'

  return (
    <LpShell serviceName="カンタンマーケAI" icon="smart_toy" ctaHref={ctaHref} ctaLabel={ctaLabel} accent={ACCENT}>
      <Hero
        eyebrow="マーケ業務AIエージェント"
        title="マーケ業務を丸ごと、"
        highlight="プロンプト不要で。"
        subtitle="LP構成案・バナーコピー・広告分析・メルマガまで、チャット形式のAIエージェントがプロ品質で仕上げます。"
        note="Googleアカウントでかんたんに始められます"
        ctaHref={ctaHref}
        ctaLabel={ctaLabel}
        mood="point"
      />
      <HowItWorks title={<>むずかしい設定なしの<br className="md:hidden" />3ステップ</>} lead="やりたいことを伝えるだけで、下書きから仕上げまで一気に進みます。" steps={STEPS} />
      <Benefits title="なぜ、マーケが速くなるのか" items={BENEFITS} />
      <FeatureGrid lead="マーケ業務に必要な機能を、ひとつの画面に。" features={SVC.features} />
      {SVC.useCases && <UseCases items={SVC.useCases} />}
      <FaqSection items={FAQ} />
      <CtaBand
        title={<>次のマーケ、<br className="md:hidden" />ドヤって片づける。</>}
        subtitle="プロンプト不要。今日からマーケ業務が変わります。"
        ctaHref={ctaHref}
        ctaLabel={ctaLabel}
        note="無料プランで1日3回までお試しいただけます"
      />
    </LpShell>
  )
}
