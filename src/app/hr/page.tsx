'use client'

import { getServiceById } from '@/lib/services'
import {
  LpShell, Hero, HowItWorks, Benefits, FeatureGrid, UseCases, FaqSection, CtaBand,
} from '@/components/lp'
import { ACCENT, CTA, STEPS, BENEFITS, FAQ } from './lp-data'

const SVC = getServiceById('hr')!

export default function HrLandingPage() {
  return (
    <LpShell serviceName="ドヤHR" icon="groups" ctaHref={CTA} ctaLabel="無料ではじめる" accent={ACCENT}>
      <Hero
        eyebrow="タレントマネジメント"
        title="人を活かすのは、"
        highlight="AIとデータ。"
        subtitle="従業員データベース・組織図・人事評価をまとめて管理。AIが評価コメントの作成まで支援します。"
        note="従業員5名まで永久無料。クレジットカード不要ではじめられます"
        ctaHref={CTA}
        ctaLabel="無料ではじめる"
        subCtaHref="/hr/pricing"
        subCtaLabel="料金を見る"
        mood="point"
      />
      <HowItWorks title={<>登録から評価まで、<br className="md:hidden" />3ステップ</>} lead="Excelやメールでのバラバラ管理を、ひとつのシステムに集約します。" steps={STEPS} />
      <Benefits title="なぜ、人事がラクになるのか" items={BENEFITS} />
      <FeatureGrid lead="中小企業のタレントマネジメントに必要な機能を、ひとつの画面に。" features={SVC.features} />
      {SVC.useCases && <UseCases items={SVC.useCases} />}
      <FaqSection items={FAQ} />
      <CtaBand
        title={<>人材マネジメントを、<br className="md:hidden" />今日から。</>}
        subtitle="従業員5名まで永久無料。クレジットカード不要で今すぐ始められます。"
        ctaHref={CTA}
        ctaLabel="無料ではじめる"
        note="人数が増えても、スターター・プロへ段階的にアップグレードできます"
      />
    </LpShell>
  )
}
