'use client'

import Link from 'next/link'

import { getServiceById } from '@/lib/services'
import {
  LpShell, ProductHero, MockWindow, FeatureShowcase, HowItWorks, Benefits, UseCases, FaqSection, CtaBand,
  DoyaKun, Sym, type ShowcaseRow,
} from '@/components/lp'
import { ACCENT, CTA, STEPS, BENEFITS, FAQ } from './lp-data'
import { AioSovMock, AioEnginesMock, AioCitationsMock } from './mocks'
import ServiceDiagram from './diagram'

const SVC = getServiceById('aio')!

const ROWS: ShowcaseRow[] = [
  {
    icon: 'hub', title: '4つのAIで言及率を測定',
    desc: 'ChatGPT・Gemini・Claude・Perplexityに同じ質問群を反復で投げ、自社ブランドが「◯回中△回」登場するかをエンジンごとに計測します。',
    bullets: ['4エンジンを横断で同時観測', '質問ごとの言及頻度を記録', 'AIごとの得意・不得意が一目でわかる'],
    visual: <MockWindow title="4エンジン言及率"><AioEnginesMock /></MockWindow>, image: { src: '/aio/shots/1-input.webp', alt: '4つのAIで言及率を測定の画面' },
  },
  {
    icon: 'leaderboard', title: '競合とSoVを比較',
    desc: '同じ質問群で、競合より自社がどれだけ登場するか。AI上の占有率（Share of Voice）をランキングで定点観測します。',
    bullets: ['自社と競合の登場比率を可視化', '占有率の推移を時系列で追跡', '「AIに推されている度合い」を数値化'],
    visual: <MockWindow title="AI可視性ランキング"><AioSovMock /></MockWindow>, image: { src: '/aio/shots/2-process.webp', alt: '競合とSoVを比較の画面' },
  },
  {
    icon: 'link', title: '引用元ドメインを把握',
    desc: 'AIが回答の根拠にしているサイトを一覧化。どのメディア・記事に載れば引用されるかがわかり、AEOの打ち手につながります。',
    bullets: ['AIが参照した引用元を集計', '自社サイトの引用回数も追える', '掲載を狙うべき媒体が見える'],
    visual: <MockWindow title="引用元ドメイン"><AioCitationsMock /></MockWindow>, image: { src: '/aio/shots/3-output.webp', alt: '引用元ドメインを把握の画面' },
  },
]

// ============================================
// aio ランディングページ
// ============================================
// ⚠️ ここは **page.tsx がサーバ側で描く**。クライアントで判定してから描くと、
//    最初に返るHTMLにLPの本文が1文字も入らず、検索エンジンから空に見える
//    （2026-08-18 に本番で確認して切り出した）。
// ⚠️ Entry.tsx にも同じJSXが残っているが、そちらは未ログインでは到達しない。
//    文言を直すときは**このファイル**を直すこと。
export default function AioLp() {
  return (
    <LpShell serviceName="ドヤAIO" icon="query_stats" ctaHref={CTA} loginHref="/auth/signin?callbackUrl=/aio" ctaLabel="無料で診断する" accent={ACCENT}>
      <ProductHero
        eyebrow="AI可視性 / AEO"
        title="そのブランド、"
        highlight="AIは推してる？"
        subtitle="ChatGPT・Gemini・Claude・Perplexityでの言及・引用・順位を測定。URLを入れるだけで、AIからの見られ方がわかります。"
        note="Googleアカウントで無料ではじめられます"
        ctaHref={CTA}
        ctaLabel="無料で診断する"
        subCtaHref="#start"
        subCtaLabel="診断の始め方"
        image={{ src: '/aio/hero.webp', alt: 'ドヤAIOのAI可視性ランキング画面' }}
        visual={<MockWindow title="AI可視性ランキング"><AioSovMock /></MockWindow>}
      />

      <section id="start" className="doya-ai-start">
        <div>
          <h2>無料の診断は、ログインから。</h2>
          <p>ログイン後に、分析したいサービスのURLとブランド情報を登録できます。</p>
          <Link href="/auth/signin?callbackUrl=/aio" className="doya-button">ログインして診断を始める<Sym name="arrow_forward" size={20} /></Link>
        </div>
      </section>

      <HowItWorks
        title={<>URLを入れるだけの<br className="md:hidden"  />3ステップ</>}
        lead="監視プロンプトの用意から観測、改善提案まで、AI可視性の運用を自動化します。"
        steps={STEPS} diagram={<ServiceDiagram steps={STEPS} />}
      />
      <FeatureShowcase title="AIでの「選ばれ方」を、そのまま見せます。" lead="AI検索での可視性を測る機能を、ひとつの画面に。" rows={ROWS} />
      <Benefits title="なぜ、いまAI可視性なのか" items={BENEFITS} />
      {SVC.useCases && <UseCases items={SVC.useCases} />}
      <FaqSection items={FAQ} />
      <CtaBand
        title={<>AIに選ばれているか、<br className="md:hidden" />今すぐ確かめる。</>}
        subtitle="URLを入れるだけ。ChatGPT・Gemini・Claude・PerplexityでのAI可視性がわかります。"
        ctaHref={CTA}
        ctaLabel="無料で診断する"
        note="無料プランで監視プロンプト3件・週1回スキャンをお試しいただけます"
      />

      {/* ⚠️ 第2CTAをURL診断に使っているため、料金への導線がLPから辿れなかった。
           実LPは料金を明記する型（同価格帯のセルフサーブSaaSは全社が金額を出している）。 */}
      <div className="pb-16 text-center">
        <Link href="/aio/pricing" className="text-sm font-bold text-slate-500 underline-offset-4 hover:text-slate-800 hover:underline">
          料金プランを見る
        </Link>
      </div>
    </LpShell>
  )
}
