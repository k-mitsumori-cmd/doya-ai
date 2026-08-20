'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import toast from 'react-hot-toast'
import { getServiceById } from '@/lib/services'
import {
  LpShell, ProductHero, MockWindow, FeatureShowcase, HowItWorks, Benefits, UseCases, FaqSection, CtaBand,
  DoyaKun, BgDots, type ShowcaseRow,
} from '@/components/lp'
import { ACCENT, CTA, STEPS, BENEFITS, FAQ } from './lp-data'
import { ShodanResearchMock, ShodanHypothesisMock, ShodanProposalMock } from './mocks'
import ServiceDiagram from './diagram'

const ROWS: ShowcaseRow[] = [
  {
    icon: 'travel_explore', title: 'URLを入れるだけで深掘り調査',
    desc: '商談先のURLを貼るだけで、従業員数・マーケ施策・オウンドメディアの規模や更新頻度まで公開情報を自動で収集。アポ前の調べ物がゼロになります。',
    bullets: ['従業員数・マーケ状況を自動収集', 'オウンドメディアの規模と更新頻度を把握', 'PR TIMES等の最新動向もチェック'],
    visual: <MockWindow title="doya-ai.surisuta.jp/shodan"><ShodanResearchMock /></MockWindow>, image: { src: '/shodan/shots/1-input.webp', alt: 'URLを入れるだけで深掘り調査の画面' },
  },
  {
    icon: 'psychology', title: '課題仮説をAIが立案',
    desc: '集めた情報から現状分析と課題仮説を自動生成。優先度つきで整理されるので、どこを突けば刺さるかが一目でわかります。',
    bullets: ['現状分析から課題を自動抽出', '優先度つきで論点を整理', '担当者ごとの品質のばらつきを抑制'],
    visual: <MockWindow title="課題仮説"><ShodanHypothesisMock /></MockWindow>, image: { src: '/shodan/shots/2-process.webp', alt: '課題仮説をAIが立案の画面' },
  },
  {
    icon: 'description', title: '提案資料を一括生成',
    desc: '現状分析→課題仮説→解決策の型で提案書（Markdown）を一括生成。自社情報を登録すれば、自社の商材・強みに最適化された提案になります。',
    bullets: ['現状分析・課題仮説・解決策を自動構成', 'Markdownでコピーして資料に流用', '自社の商材・強みに最適化'],
    visual: <MockWindow title="提案資料"><ShodanProposalMock /></MockWindow>, image: { src: '/shodan/shots/3-output.webp', alt: '提案資料を一括生成の画面' },
  },
]

const SVC = getServiceById('shodan')!

// ============================================
// shodan ランディングページ
// ============================================
// ⚠️ ここは **page.tsx がサーバ側で描く**。クライアントで判定してから描くと、
//    最初に返るHTMLにLPの本文が1文字も入らず、検索エンジンから空に見える
//    （2026-08-18 に本番で確認して切り出した）。
// ⚠️ Entry.tsx にも同じJSXが残っているが、そちらは未ログインでは到達しない。
//    文言を直すときは**このファイル**を直すこと。
export default function ShodanLp() {
  return (
    <LpShell serviceName="ドヤ商談準備" icon="handshake" ctaHref={CTA} ctaLabel="無料ではじめる" accent={ACCENT}>
      <ProductHero
        eyebrow="商談準備AI"
        title="商談準備を、"
        highlight="URL1本で。"
        subtitle="リサーチ → 課題仮説 → 解決策 → 提案資料まで、AIが一気通貫で仕上げます。"
        note="Googleアカウントでかんたんに始められます"
        ctaHref={CTA}
        ctaLabel="無料ではじめる"
        subCtaHref="/shodan/pricing"
        subCtaLabel="料金を見る"
        image={{ src: '/shodan/hero.webp', alt: 'ドヤ商談準備の企業調査画面' }}
        visual={<MockWindow title="doya-ai.surisuta.jp/shodan"><ShodanResearchMock /></MockWindow>}
      />
      <HowItWorks title={<>URLを入れるだけの<br className="md:hidden"  />3ステップ</>} lead="アポ前の調べ物と資料づくりを、そのまま自動化します。" steps={STEPS} diagram={<ServiceDiagram steps={STEPS} />} />
      <FeatureShowcase title="商談準備の一連の流れを、そのまま見せます。" lead="リサーチから提案資料づくりまで、ひとつの画面で完結します。" rows={ROWS} />
      <Benefits title="なぜ、商談が変わるのか" items={BENEFITS} />
      {SVC.useCases && <UseCases items={SVC.useCases} />}
      <FaqSection items={FAQ} />
      <CtaBand
        title={<>次の商談、<br className="md:hidden" />ドヤって決めにいく。</>}
        subtitle="URLを入れるだけ。今日から商談準備が変わります。"
        ctaHref={CTA}
        ctaLabel="無料ではじめる"
        note="無料プランで企業調査を月5件までお試しいただけます"
      />
    </LpShell>
  )
}
