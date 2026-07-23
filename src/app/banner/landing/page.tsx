'use client'

import { useSession } from 'next-auth/react'
import { getServiceById } from '@/lib/services'
import { LpShell, Hero, HowItWorks, Benefits, FeatureGrid, UseCases, FaqSection, CtaBand } from '@/components/lp'
import { ACCENT, STEPS, BENEFITS, FAQ } from './lp-data'

const SVC = getServiceById('banner')!

export default function BannerLandingPage() {
  const { data: session } = useSession()
  // ログイン済みはツール本体(/banner)へ、未ログインはログイン経由で /banner へ
  const cta = session ? '/banner' : '/auth/signin?callbackUrl=/banner'

  return (
    <LpShell serviceName="ドヤバナーAI" icon="image" ctaHref={cta} ctaLabel="無料で作る" accent={ACCENT}>
      <Hero
        eyebrow="バナー生成AI"
        title="プロ品質のバナーを、"
        highlight="AIで自動生成。"
        subtitle="業種を選んでAIにおまかせ。A/B/Cの3案を数分で。デザイン知識がなくても、効果的な広告バナーが作れます。"
        note="無料プランで月15枚まで・ゲストも1日1回お試し可"
        ctaHref={cta}
        ctaLabel="無料で作る"
        mood="present"
      />
      <HowItWorks title={<>選ぶ・生成・書き出しの<br className="md:hidden" />3ステップ</>} lead="テンプレートを選んでAIにまかせるだけ。" steps={STEPS} />
      <Benefits title="なぜ、バナーづくりが速くなるのか" items={BENEFITS} />
      <FeatureGrid lead="広告バナーに必要な機能を、ひとつに。" features={SVC.features} />
      {SVC.useCases && <UseCases items={SVC.useCases} />}
      <FaqSection items={FAQ} />
      <CtaBand
        title={<>最初のバナー、<br className="md:hidden" />いま作ってみる。</>}
        subtitle="業種を選ぶだけ。3案が数分で仕上がります。"
        ctaHref={cta}
        ctaLabel="無料で作る"
        note="無料プランで月15枚まで"
      />
    </LpShell>
  )
}
