'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signIn } from 'next-auth/react'
import toast from 'react-hot-toast'
import { getServiceById } from '@/lib/services'
import {
  LpShell, ProductHero, MockWindow, FeatureShowcase, HowItWorks, Benefits, UseCases, FaqSection, CtaBand,
  DoyaKun, BgDots, type ShowcaseRow,
} from '@/components/lp'
import { ACCENT, CTA, STEPS, BENEFITS, FAQ } from './lp-data'
import { SfaPipelineMock, SfaAccountsMock, SfaDashboardMock } from './mocks'

const SVC = getServiceById('sfa')!

const ROWS: ShowcaseRow[] = [
  {
    icon: 'view_kanban', title: '商談をカンバンで管理',
    desc: '「リード → 商談中 → 提案 → 受注」のパイプラインをカンバンで見える化。ドラッグでフェーズを動かし、案件の停滞をひと目で把握できます。',
    bullets: ['4フェーズのパイプラインを俯瞰', '取引先名と金額をカードで管理', '停滞している商談にすぐ気づける'],
    visual: <MockWindow title="doya-ai.surisuta.jp/sfa"><SfaPipelineMock /></MockWindow>,
  },
  {
    icon: 'apartment', title: '取引先を一元管理',
    desc: '取引先ごとに商談・担当者・金額をまとめて管理。会社名や担当者で検索でき、バラバラのExcelやメモから卒業できます。',
    bullets: ['会社名・担当者で瞬時に検索', '取引先ごとに商談履歴を集約', 'CSVで一括インポート／エクスポート'],
    visual: <MockWindow title="取引先"><SfaAccountsMock /></MockWindow>,
  },
  {
    icon: 'monitoring', title: '売上ダッシュボード',
    desc: '今月売上・進行中の商談・受注率を、ダッシュボードでひと目で把握。月次の売上推移までグラフで確認できます。',
    bullets: ['今月売上・商談数・受注率を集計', '月次の売上推移をグラフ表示', 'チーム全体の進捗を共有できる'],
    visual: <MockWindow title="売上ダッシュボード"><SfaDashboardMock /></MockWindow>,
  },
]

// ============================================
// sfa ランディングページ
// ============================================
// ⚠️ ここは **page.tsx がサーバ側で描く**。クライアントで判定してから描くと、
//    最初に返るHTMLにLPの本文が1文字も入らず、検索エンジンから空に見える
//    （2026-08-18 に本番で確認して切り出した）。
// ⚠️ Entry.tsx にも同じJSXが残っているが、そちらは未ログインでは到達しない。
//    文言を直すときは**このファイル**を直すこと。
export default function SfaLp() {
  return (
    <LpShell serviceName="ドヤ営業管理" icon="view_kanban" ctaHref={CTA} ctaLabel="無料ではじめる" accent={ACCENT}>
      <ProductHero
        eyebrow="かんたんSFA"
        title="営業管理を、"
        highlight="シンプルに。"
        subtitle="取引先・商談パイプライン・タスク・売上ダッシュボードを、設定不要・即日で。Salesforceは重すぎる中小チームのための、シンプルで安いSFAです。"
        note="Googleアカウントでかんたんに始められます"
        ctaHref={CTA}
        ctaLabel="無料ではじめる"
        visual={<MockWindow title="doya-ai.surisuta.jp/sfa"><SfaPipelineMock /></MockWindow>}
      />
      <HowItWorks title={<>登録して、すぐ使える<br className="md:hidden" />3ステップ</>} lead="難しい初期設定はいりません。組織を作れば、その日から商談を見える化できます。" steps={STEPS} />
      <FeatureShowcase title="現場で使う機能を、そのまま見せます。" lead="営業チームに必要な機能を、ひとつの画面に。" rows={ROWS} />
      <Benefits title="なぜ、営業が回り出すのか" items={BENEFITS} />
      {SVC.useCases && <UseCases items={SVC.useCases} />}
      <FaqSection items={FAQ} />
      <CtaBand
        title={<>商談の見える化を、<br className="md:hidden" />今日から。</>}
        subtitle="設定不要・無料で今すぐ。まずはサンプルから触ってみてください。"
        ctaHref={CTA}
        ctaLabel="無料ではじめる"
        note="無料プランで3名・取引先/商談 各50件までお試しいただけます"
      />
    </LpShell>
  )
}
