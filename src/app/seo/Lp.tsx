'use client'

// ドヤ記事作成 ランディングページ（未ログインの方に見せる面）
// ⚠️ 構成は国内BtoB SaaS LP15本を調べた最頻の型。
//    実績数値（導入社数・継続率・No.1）は持っていないので書かない。
// ⚠️ ヒーローのCTAは2個まで。
import {
  LpShell, ProductHero, MockWindow, HowItWorks, Benefits, UseCases, FaqSection, CtaBand,
} from '@/components/lp'
import { getServiceById } from '@/lib/services'
import { ACCENT, CTA, STEPS, BENEFITS, FAQ } from './lp-data'
import { ServiceFeatureMock } from '@/components/lp/ServiceFeatureMock'

const SVC = getServiceById('seo')!

export default function SeoLp() {
  return (
    <LpShell serviceName={SVC.name} icon="article" ctaHref={CTA} ctaLabel="無料ではじめる" accent={ACCENT}>
      <ProductHero
        eyebrow="ドヤマーケAI"
        title="検索意図から組み立てて、"
        highlight="長文でも破綻しない。"
        subtitle="キーワードと参考URLを入れると、検索意図に沿ったアウトラインを作り、章ごとに整合性を確かめながら書き上げます。"
        note="無料プランで月3本までお試しいただけます。クレジットカードの登録は不要です。"
        ctaHref={CTA}
        ctaLabel="無料ではじめる"
        subCtaHref="/seo/pricing"
        subCtaLabel="料金を見る"
        visual={<MockWindow title={SVC.name}><ServiceFeatureMock features={SVC.features} /></MockWindow>}
      />

      <UseCases title="こんな場面のためのものです" items={['記事の量産にライターのリソースが足りない', '記事の品質が書き手によってばらつく', '長文にすると話の筋が通らなくなる', '参考記事の丸写しになっていないか不安がある']} />

      <HowItWorks title="3ステップで使えます" steps={STEPS} />

      <Benefits title="書き上げるまでを、途切れさせない" lead="参考記事を丸写しせず、話の筋を保ったまま長文にします。" items={BENEFITS} />

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
