'use client'

// ドヤペルソナAI ランディングページ（未ログインの方に見せる面）
// ⚠️ 構成は国内BtoB SaaS LP15本を調べた最頻の型。
//    実績数値（導入社数・継続率・No.1）は持っていないので書かない。
// ⚠️ ヒーローのCTAは2個まで。
import {
  LpShell, ProductHero, MockWindow, HowItWorks, Benefits, UseCases, FaqSection, CtaBand,
} from '@/components/lp'
import { getServiceById } from '@/lib/services'
import { ACCENT, CTA, STEPS, BENEFITS, FAQ } from './lp-data'
import { ServiceFeatureMock } from '@/components/lp/ServiceFeatureMock'

const SVC = getServiceById('persona')!

export default function PersonaLp() {
  return (
    <LpShell serviceName={SVC.name} icon="groups" ctaHref={CTA} ctaLabel="無料ではじめる" accent={ACCENT}>
      <ProductHero
        eyebrow="ドヤマーケAI"
        title="「誰に向けて作るか」を、"
        highlight="30秒で1枚に。"
        subtitle="商材と業界を入れるだけで、年齢・職種・課題・情報収集の仕方まで、施策に使える粒度のペルソナが出ます。"
        note="無料プランで1日5件までお試しいただけます。クレジットカードの登録は不要です。"
        ctaHref={CTA}
        ctaLabel="無料ではじめる"
        subCtaHref="/persona/pricing"
        subCtaLabel="料金を見る"
        visual={<MockWindow title={SVC.name}><ServiceFeatureMock features={SVC.features} /></MockWindow>}
      />

      <UseCases title="こんな場面のためのものです" items={['LPの構成案を考えるのに時間がかかる', '制作会社への指示書をまとめきれない', 'コピーの方向性がチーム内で揃わない', 'ターゲット設定が担当者の勘に頼っている']} />

      <HowItWorks title="3ステップで使えます" steps={STEPS} />

      <Benefits title="叩き台が先にあると、速い" lead="ゼロから考えるより、出てきたものを直す方が早く形になります。" items={BENEFITS} />

      <FaqSection items={FAQ} />

      <CtaBand
        title="まずは無料で試せます"
        subtitle="プロプランなら月額9,980円で、ドヤシリーズの全サービスが使えます。"
        ctaHref={CTA}
        ctaLabel="無料ではじめる"
        note="クレジットカードの登録は不要です"
      />
    </LpShell>
  )
}
