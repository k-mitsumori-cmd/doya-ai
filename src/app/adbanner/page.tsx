'use client'

import { getServiceById } from '@/lib/services'
import {
  LpShell, Hero, HowItWorks, Benefits, FeatureGrid, UseCases, FaqSection, CtaBand,
} from '@/components/lp'
import { ACCENT, CTA, CTA_SUB, STEPS, BENEFITS, FAQ } from './lp-data'

const SVC = getServiceById('adbanner')!

export default function AdBannerLanding() {
  return (
    <LpShell serviceName="ドヤ広告バナーAI" icon="campaign" ctaHref={CTA} ctaLabel="無料で作る" accent={ACCENT}>
      <Hero
        eyebrow="広告バナーAI"
        title="広告バナー、"
        highlight="量産して改善。"
        subtitle="URL・ブランドから広告特化バナーを一括生成 → AIが採点 → 直して再生成。成果の出るクリエイティブを作り続けられます。"
        note="ログイン不要でお試し（ゲスト3枚/日）"
        ctaHref={CTA}
        ctaLabel="無料でバナーを作る"
        subCtaHref={CTA_SUB}
        subCtaLabel="ダッシュボードを見る"
        mood="present"
      />
      <HowItWorks
        title={<>URLを入れるだけの<br className="md:hidden" />3ステップ</>}
        lead="広告クリエイティブの制作と改善を、そのまま自動化します。"
        steps={STEPS}
      />
      <Benefits title="なぜ、成果が変わるのか" items={BENEFITS} />
      <FeatureGrid lead="広告バナーの量産と改善に必要な機能を、ひとつの画面に。" features={SVC.features} />
      {SVC.useCases && <UseCases items={SVC.useCases} />}
      <FaqSection items={FAQ} />
      <CtaBand
        title={<>次の広告、<br className="md:hidden" />ドヤって当てにいく。</>}
        subtitle="URLを入れるだけ。今日から広告バナーの量産が変わります。"
        ctaHref={CTA}
        ctaLabel="無料でバナーを作る"
        note="ログイン不要でお試し（ゲスト3枚/日）。無料プランは1日9枚まで。"
      />
    </LpShell>
  )
}
