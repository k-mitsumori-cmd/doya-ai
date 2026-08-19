'use client'

// ドヤインタビュー ランディングページ（未ログインの方に見せる面）
// ⚠️ 構成は国内BtoB SaaS LP15本を調べた最頻の型。実績数値は書かない。
import {
  LpShell, ProductHero, MockWindow, FeatureShowcase, HowItWorks, Benefits, UseCases, FaqSection, CtaBand, type ShowcaseRow,
} from '@/components/lp'
import { getServiceById } from '@/lib/services'
import { ACCENT, CTA, STEPS, BENEFITS, FAQ } from './lp-data'
import { InterviewUploadMock, InterviewTranscriptMock, InterviewArticleMock } from './mocks'

const SVC = getServiceById('interview')!
const ROWS: ShowcaseRow[] = [
  { icon: 'upload_file', title: '録音をそのまま入れる', desc: '音声や動画をアップロードするだけで取材後の作業を始められます。', visual: <MockWindow title="音声アップロード"><InterviewUploadMock /></MockWindow> },
  { icon: 'record_voice_over', title: '話者ごとに文字へ', desc: '対談でも発言者を分け、誰が何を話したかを追える状態にします。', visual: <MockWindow title="文字起こし"><InterviewTranscriptMock /></MockWindow> },
  { icon: 'article', title: '媒体に合う記事へ', desc: 'Q&Aやストーリーなど、用途に合う形で編集できるドラフトを作ります。', visual: <MockWindow title="記事ドラフト"><InterviewArticleMock /></MockWindow> },
]

export default function InterviewLp() {
  return (
    <LpShell serviceName={SVC.name} icon="record_voice_over" ctaHref={CTA} ctaLabel="無料ではじめる" accent={ACCENT}>
      <ProductHero
        eyebrow="ドヤマーケAI"
        title="取材の録音から、"
        highlight="記事の形まで。"
        subtitle="音声をアップロードすると、話者を分けて文字に起こし、載せる媒体に合わせた記事のドラフトまで作ります。"
        note="無料プランでお試しいただけます。クレジットカードの登録は不要です。"
        ctaHref={CTA}
        ctaLabel="無料ではじめる"
        subCtaHref="/interview/pricing"
        subCtaLabel="料金を見る"
        image={{ src: '/interview/hero.webp', alt: 'ドヤインタビューの話者別文字起こし画面' }}
        visual={<MockWindow title={SVC.name}><InterviewTranscriptMock /></MockWindow>}
      />

      <UseCases title="こんな場面のためのものです" items={['インタビュー音声の文字起こしに時間がかかる', '取材後の記事化に数日かかっている', 'ライターのリソースが足りない', '記事の品質が書き手によってばらつく']} />

      <FeatureShowcase title="録音から記事の叩き台まで" lead="話者分離、構成、校正を一つの流れで進めます。" rows={ROWS} />

      <HowItWorks title="3ステップで記事になります" steps={STEPS} />

      <Benefits title="選ばれる理由" lead="取材のあとの、一番時間がかかるところを引き受けます。" items={BENEFITS} />

      <FaqSection items={FAQ} />

      <CtaBand
        title="次の取材から、当日に記事へ"
        subtitle="プロプランなら月額9,980円で、ドヤシリーズの全サービスが使えます。"
        ctaHref={CTA}
        ctaLabel="無料ではじめる"
        note="クレジットカードの登録は不要です"
      />
    </LpShell>
  )
}
