'use client'

// ドヤAI商談 ランディングページ（未ログインの方に見せる面）
// ⚠️ 構成は国内BtoB SaaS LP15本の最頻の型。実績数値は持っていないので書かない。
import {
  LpShell, ProductHero, MockWindow, FeatureShowcase,
  HowItWorks, Benefits, UseCases, FaqSection, CtaBand, type ShowcaseRow,
} from '@/components/lp'
import { getServiceById } from '@/lib/services'
import { ACCENT, CTA, STEPS, BENEFITS, FAQ } from './lp-data'
import { AishodanTalkMock, AishodanSlotsMock, AishodanFitMock } from './mocks'

const SVC = getServiceById('aishodan')!

const ROWS: ShowcaseRow[] = [
  {
    icon: 'record_voice_over',
    title: 'AIが音声で一次商談を進める',
    desc: '見込み客はお渡ししたURLを開くだけ。ログインもアプリも要りません。相手のご都合に合わせて、深夜でも土日でも商談が始まります。',
    bullets: ['ログイン不要・スマートフォン対応', '音声でもテキストでも参加できる', '話し始めたらAIはすぐ黙る（かぶらない）'],
    visual: <MockWindow title="一次商談"><AishodanTalkMock /></MockWindow>,
  },
  {
    icon: 'checklist',
    title: '聞くべきことを取りこぼさない',
    desc: '課題・予算・時期・決裁者といったヒアリング項目を、会話しながら構造化して記録します。取れなかった項目は「未取得」として残るので、次に何を聞けばよいかが分かります。',
    bullets: ['ヒアリング項目を自動で記録', '未取得の項目がひと目で分かる', '全文ログと要約も残る'],
    visual: <MockWindow title="ヒアリング項目"><AishodanSlotsMock /></MockWindow>,
  },
  {
    icon: 'insights',
    title: '適合度と、その理由',
    desc: '理想の顧客像と照らして適合度を出します。ただし判定は参考値で、最終的な判断は担当者が行う前提です。日程調整に進んだかどうかも記録されます。',
    bullets: ['理想顧客像との適合度と判定理由', '日程調整のリンクで実際の面談へ', '完了と同時にSlackへ通知'],
    visual: <MockWindow title="適合度の判定"><AishodanFitMock /></MockWindow>,
  },
]

export default function AishodanLp() {
  return (
    <LpShell serviceName={SVC.name} icon="forum" ctaHref={CTA} ctaLabel="無料ではじめる" accent={ACCENT}>
      <ProductHero
        eyebrow="ドヤマーケAI"
        title="問い合わせが来た瞬間に、"
        highlight="商談が始まる。"
        subtitle="AIが音声で一次商談を進め、ヒアリング項目と適合度まで残します。見込み客はURLを開くだけ、ログインは要りません。"
        note="無料プランで商材1件・商談5件までお試しいただけます。クレジットカードの登録は不要です。"
        ctaHref={CTA}
        ctaLabel="無料ではじめる"
        subCtaHref="/aishodan/pricing"
        subCtaLabel="料金を見る"
        image={{ src: '/aishodan/hero.webp', alt: 'ドヤAI商談の商談進行画面' }}
        visual={<MockWindow title="ドヤAI商談"><AishodanTalkMock /></MockWindow>}
      />

      <UseCases
        title="こんな場面のためのものです"
        items={[
          '問い合わせへの一次対応が追いつかず、取りこぼしている',
          '担当者が対応できるまでに時間が空き、その間に熱が冷める',
          '一次ヒアリングの内容が担当者ごとにバラつく',
          '商談の記録が残らず、次に何を聞くべきか引き継げない',
        ]}
      />

      <FeatureShowcase
        title="一次対応を、待たせずに"
        lead="資料にある事だけを答え、無いことは推測しません。"
        rows={ROWS}
      />

      <HowItWorks title="3ステップで商談を任せる" steps={STEPS} />

      <Benefits title="選ばれる理由" items={BENEFITS} />

      <FaqSection items={FAQ} />

      <CtaBand
        title="次の問い合わせから、待たせません"
        subtitle="無料プランで商談5件まで。プロプランなら月額9,980円で、ドヤシリーズの全サービスが使えます。"
        ctaHref={CTA}
        ctaLabel="無料ではじめる"
        note="クレジットカードの登録は不要です"
      />
    </LpShell>
  )
}
