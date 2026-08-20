'use client'

// ドヤカンニング ランディングページ（未ログインの方に見せる面）
// ⚠️ 構成は国内BtoB SaaS LP15本を調べた最頻の型。
//    実績数値（導入社数・継続率・No.1）は持っていないので書かない。
// ⚠️ ヒーローのCTAは2個まで。
import {
  LpShell, ProductHero, MockWindow, FeatureShowcase, HowItWorks, Benefits, UseCases, FaqSection, CtaBand, type ShowcaseRow,
} from '@/components/lp'
import { getServiceById } from '@/lib/services'
import { ACCENT, CTA, STEPS, BENEFITS, FAQ } from './lp-data'
import { CunningKnowledgeMock, CunningLiveMock, CunningAnswerMock } from './mocks'
import ServiceDiagram from './diagram'

const SVC = getServiceById('cunning')!
const ROWS: ShowcaseRow[] = [
  { icon: 'menu_book', title: '根拠にする資料を登録', desc: 'サービス資料や想定問答を先に入れ、回答の範囲を決めます。', visual: <MockWindow title="ナレッジ"><CunningKnowledgeMock /></MockWindow>, image: { src: '/cunning/shots/1-input.webp', alt: '根拠にする資料を登録の画面' } },
  { icon: 'cast', title: '会話から質問を検出', desc: '会議の発言を文字にし、回答が必要な質問を見つけます。', visual: <MockWindow title="会議モニター"><CunningLiveMock /></MockWindow>, image: { src: '/cunning/shots/2-process.webp', alt: '会話から質問を検出の画面' } },
  { icon: 'quickreply', title: '要点と根拠を同時に', desc: '最初の一言、話すための補足、参照した資料を同じ画面に出します。', visual: <MockWindow title="回答案"><CunningAnswerMock /></MockWindow>, image: { src: '/cunning/shots/3-output.webp', alt: '要点と根拠を同時にの画面' } },
]

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
        image={{ src: '/cunning/hero.webp', alt: 'ドヤカンニングの回答支援画面' }}
        visual={<MockWindow title={SVC.name}><CunningAnswerMock /></MockWindow>}
      />

      <UseCases title="こんな場面のためのものです" items={['商談で想定外の質問に即答できない', '採用面接で企業に刺さる回答を準備したい', '応対の質が担当者によって違う', '新任のメンバーが独り立ちしにくい']} />

      <FeatureShowcase title="準備した知識を、会話のその場へ" lead="答えを作り込まず、登録資料から話すための要点を取り出します。" rows={ROWS} />

      <HowItWorks title="3ステップで使えます" steps={STEPS} diagram={<ServiceDiagram steps={STEPS} />}  />

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
