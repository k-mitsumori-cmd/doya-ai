'use client'

// ドヤカンニング ランディングページ（未ログインの方に見せる面）
// ⚠️ 構成は国内BtoB SaaS LP15本を調べた最頻の型。
//    実績数値（導入社数・継続率・No.1）は持っていないので書かない。
// ⚠️ ヒーローのCTAは2個まで。
import {
  LpShell, ProductHero, MockWindow, HowItWorks, Benefits, UseCases, FaqSection, CtaBand,
} from '@/components/lp'
import { getServiceById } from '@/lib/services'
import { ACCENT, CTA, STEPS, BENEFITS, FAQ } from './lp-data'
import { ServiceFeatureMock } from '@/components/lp/ServiceFeatureMock'

const SVC = getServiceById('cunning')!

export default function CunningLp() {
  return (
    <LpShell serviceName={SVC.name} icon="support_agent" ctaHref={CTA} ctaLabel="無料ではじめる" accent={ACCENT}>
      <ProductHero
        eyebrow="ドヤマーケAI"
        title="想定外の質問にも、"
        highlight="言葉に詰まらない。"
        subtitle="Web会議の相手の発言から質問を見つけ、登録した資料を根拠にした回答案を画面に出します。"
        note="無料プランで月60分までお試しいただけます。クレジットカードの登録は不要です。"
        ctaHref={CTA}
        ctaLabel="無料ではじめる"
        subCtaHref="/cunning/pricing"
        subCtaLabel="料金を見る"
        visual={<MockWindow title={SVC.name}><ServiceFeatureMock features={SVC.features} /></MockWindow>}
      />

      <UseCases title="こんな場面のためのものです" items={['商談で想定外の質問に即答できない', '採用面接で企業に刺さる回答を準備したい', '応対の質が担当者によって違う', '新任のメンバーが独り立ちしにくい']} />

      <HowItWorks title="3ステップで使えます" steps={STEPS} />

      <Benefits title="根拠のある答えを、その場で" lead="登録した資料にある事から答えます。無いことは作りません。" items={BENEFITS} />

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
