'use client'

import { LpShell, ProductHero, MockWindow, FeatureShowcase, HowItWorks, Benefits, UseCases, FaqSection, CtaBand, type ShowcaseRow } from '@/components/lp'
import { getServiceById } from '@/lib/services'
import { ACCENT, CTA, STEPS, BENEFITS, FAQ } from './lp-data'
import { DoyaSlideBriefMock, DoyaSlideStructureMock, DoyaSlideDeckMock } from './mocks'

const SVC = getServiceById('doyaslide')!
const ROWS: ShowcaseRow[] = [
  { icon: 'edit_note', title: '用途とテーマを入力', desc: '資料タイプ、枚数、比率、スタイルを選び、伝えたいことを入力します。', visual: <MockWindow title="資料の条件"><DoyaSlideBriefMock /></MockWindow> },
  { icon: 'account_tree', title: '資料の流れを設計', desc: '目的に合うページ構成を先に作り、全体の話がつながる状態にします。', visual: <MockWindow title="ページ構成"><DoyaSlideStructureMock /></MockWindow> },
  { icon: 'view_carousel', title: '全ページを画像で生成', desc: '選んだスタイルと配色を保ちながら、ページごとのビジュアルを作ります。', visual: <MockWindow title="生成結果"><DoyaSlideDeckMock /></MockWindow> },
]

export default function DoyaSlideLp() {
  return <LpShell serviceName={SVC.name} icon="view_carousel" ctaHref={CTA} accent={ACCENT}>
    <ProductHero eyebrow="ドヤマーケAI" title="テーマを入れたら、" highlight="全ページができている。" subtitle="構成からビジュアルまで、プレゼン資料を全ページ画像で生成。ページ単位の修正とPDF書き出しまで一つの画面で進められます。" note="無料プランで月3プロジェクト・20枚まで。" ctaHref={CTA} ctaLabel="無料ではじめる" subCtaHref="/doyaslide/pricing" subCtaLabel="料金を見る" image={{ src: '/doyaslide/hero.webp', alt: 'ドヤスライドの生成済みページ一覧画面' }} visual={<MockWindow title={SVC.name}><DoyaSlideDeckMock /></MockWindow>} />
    <UseCases title="こんな場面のためのものです" items={SVC.useCases || []} />
    <FeatureShowcase title="構成もデザインも、一つの流れで" lead="白紙のページを一枚ずつ整える作業を減らします。" rows={ROWS} />
    <HowItWorks title="3ステップで書き出しまで" steps={STEPS} />
    <Benefits title="資料制作を止めないための機能" items={BENEFITS} />
    <FaqSection items={FAQ} />
    <CtaBand title="次の資料を、テーマ入力から始めませんか" subtitle="無料プランで月3プロジェクトまで試せます。" ctaHref={CTA} ctaLabel="無料ではじめる" note="クレジットカードの登録は不要です" />
  </LpShell>
}
