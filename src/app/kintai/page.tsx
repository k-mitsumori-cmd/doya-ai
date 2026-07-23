'use client'

import { getServiceById } from '@/lib/services'
import {
  LpShell, Hero, HowItWorks, Benefits, FeatureGrid, UseCases, FaqSection, CtaBand,
} from '@/components/lp'
import { ACCENT, CTA, STEPS, BENEFITS, FAQ } from './lp-data'

const SVC = getServiceById('kintai')!

export default function KintaiLandingPage() {
  return (
    <LpShell serviceName="ドヤ勤怠" icon="schedule" ctaHref={CTA} ctaLabel="無料ではじめる" accent={ACCENT}>
      <Hero
        eyebrow="クラウド勤怠管理"
        title="勤怠管理を、"
        highlight="シンプルに。"
        subtitle="打刻・集計・申請承認をオールインワンで。中小企業のための、すぐ使えるクラウド勤怠管理システムです。"
        note="従業員5名まで無料。面倒な初期設定は不要です"
        ctaHref={CTA}
        mood="point"
      />
      <HowItWorks
        title={<>打刻から承認まで<br className="md:hidden" />3ステップ</>}
        lead="毎日の打刻も、月末の締めも、そのまま自動化します。"
        steps={STEPS}
      />
      <Benefits title="なぜ、勤怠管理が変わるのか" items={BENEFITS} />
      <FeatureGrid lead="勤怠管理に必要な機能を、ひとつの画面に。" features={SVC.features} />
      {SVC.useCases && <UseCases items={SVC.useCases} />}
      <FaqSection items={FAQ} />
      <CtaBand
        title={<>勤怠管理、<br className="md:hidden" />今日からラクにする。</>}
        subtitle="従業員5名まで無料。アカウントを作ればすぐに打刻を始められます。"
        ctaHref={CTA}
        ctaLabel="無料ではじめる"
        note="無料プランで従業員5名までご利用いただけます"
      />
    </LpShell>
  )
}
