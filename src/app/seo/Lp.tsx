'use client'

// ドヤ記事作成 ランディングページ（未ログインの方に見せる面）
// ⚠️ 構成は国内BtoB SaaS LP15本を調べた最頻の型。
//    実績数値（導入社数・継続率・No.1）は持っていないので書かない。
// ⚠️ ヒーローのCTAは2個まで。
import {
  LpShell, ProductHero, MockWindow, FeatureShowcase, HowItWorks, Benefits, UseCases, FaqSection, CtaBand, type ShowcaseRow,
} from '@/components/lp'
import { getServiceById } from '@/lib/services'
import { ACCENT, CTA, STEPS, BENEFITS, FAQ } from './lp-data'
import { SeoBriefMock, SeoOutlineMock, SeoAuditMock } from './mocks'
import ServiceDiagram from './diagram'

const SVC = getServiceById('seo')!
const ROWS: ShowcaseRow[] = [
  { icon: 'travel_explore', title: '検索意図を先に整理', desc: 'キーワード・読者・参考URLを入力し、記事が答えるべき問いを決めます。', bullets: ['参考URLは要点化して利用', '読者と目的を記事ごとに指定'], visual: <MockWindow title="記事の条件"><SeoBriefMock /></MockWindow>, image: { src: '/seo/shots/1-input.webp', alt: '検索意図を先に整理の画面' } },
  { icon: 'account_tree', title: '章ごとに筋を通す', desc: '検索意図をもとにアウトラインを組み、章ごとに書き進めます。', bullets: ['見出しごとの役割を明示', '前後の主張を整合性チェック'], visual: <MockWindow title="アウトライン"><SeoOutlineMock /></MockWindow>, image: { src: '/seo/shots/2-process.webp', alt: '章ごとに筋を通すの画面' } },
  { icon: 'fact_check', title: '公開前に自動監査', desc: '重複・根拠・リンクを確認し、修正が必要な箇所を明示します。', bullets: ['根拠が薄い箇所を検出', 'リンク切れも確認'], visual: <MockWindow title="公開前チェック"><SeoAuditMock /></MockWindow>, image: { src: '/seo/shots/3-output.webp', alt: '公開前に自動監査の画面' } },
]

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
        image={{ src: '/seo/hero.webp', alt: 'ドヤ記事作成のアウトライン生成画面' }}
        visual={<MockWindow title={SVC.name}><SeoOutlineMock /></MockWindow>}
      />

      <UseCases title="こんな場面のためのものです" items={['記事の量産にライターのリソースが足りない', '記事の品質が書き手によってばらつく', '長文にすると話の筋が通らなくなる', '参考記事の丸写しになっていないか不安がある']} />

      <FeatureShowcase title="構成から監査まで、ひとつながりに" lead="白紙から書かず、検索意図と根拠を確認しながら積み上げます。" rows={ROWS} />

      <HowItWorks title="3ステップで使えます" steps={STEPS} diagram={<ServiceDiagram steps={STEPS} />}  />

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
