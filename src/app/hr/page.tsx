'use client'

import { getServiceById } from '@/lib/services'
import {
  LpShell, ProductHero, MockWindow, FeatureShowcase, HowItWorks, Benefits, UseCases, FaqSection, CtaBand,
  type ShowcaseRow,
} from '@/components/lp'
import { ACCENT, CTA, STEPS, BENEFITS, FAQ } from './lp-data'
import { HrEmployeesMock, HrOrgChartMock, HrEvalMock } from './mocks'

const SVC = getServiceById('hr')!

const ROWS: ShowcaseRow[] = [
  {
    icon: 'groups', title: '顔写真中心の従業員データベース',
    desc: '氏名・部署・役職・等級を、顔写真つきで一元管理。検索や絞り込みもすぐ。バラバラのExcelから卒業できます。',
    bullets: ['CSVで一括インポート／エクスポート', '名前・部署・役職で瞬時に検索', '顔写真で直感的に把握できる'],
    visual: <MockWindow title="doya-ai.surisuta.jp/hr"><HrEmployeesMock /></MockWindow>,
  },
  {
    icon: 'account_tree', title: '組織図を自動で生成',
    desc: '従業員データから組織図をワンクリックで生成。異動や採用があっても、図を手作業で描き直す必要はありません。',
    bullets: ['従業員データから自動生成', '部署・役職の変更が即反映', 'いつ見ても最新の組織図'],
    visual: <MockWindow title="組織図"><HrOrgChartMock /></MockWindow>,
  },
  {
    icon: 'auto_awesome', title: 'AIが人事評価を支援',
    desc: 'MBOの目標設定からスコアリング、フィードバックまでを一画面で。評価コメントはAIが下書きし、担当者の負担を減らします。',
    bullets: ['MBO目標設定〜スコアリング', 'AIが評価コメントを下書き', '評価の型が揃い、ばらつきを抑制'],
    visual: <MockWindow title="人事評価"><HrEvalMock /></MockWindow>,
  },
]

export default function HrLandingPage() {
  return (
    <LpShell serviceName="ドヤHR" icon="groups" ctaHref={CTA} ctaLabel="無料ではじめる" accent={ACCENT}>
      <ProductHero
        eyebrow="タレントマネジメント"
        title="人を活かすのは、"
        highlight="AIとデータ。"
        subtitle="従業員データベース・組織図・人事評価をまとめて管理。AIが評価コメントの作成まで支援します。"
        note="従業員5名まで永久無料。クレジットカード不要ではじめられます"
        ctaHref={CTA}
        ctaLabel="無料ではじめる"
        subCtaHref="/hr/pricing"
        subCtaLabel="料金を見る"
        visual={<MockWindow title="doya-ai.surisuta.jp/hr"><HrEmployeesMock /></MockWindow>}
      />
      <HowItWorks title={<>登録から評価まで、<br className="md:hidden" />3ステップ</>} lead="Excelやメールでのバラバラ管理を、ひとつのシステムに集約します。" steps={STEPS} />
      <FeatureShowcase title="現場で使う機能を、そのまま見せます。" lead="中小企業のタレントマネジメントに必要な機能を、ひとつの画面に。" rows={ROWS} />
      <Benefits title="なぜ、人事がラクになるのか" items={BENEFITS} />
      {SVC.useCases && <UseCases items={SVC.useCases} />}
      <FaqSection items={FAQ} />
      <CtaBand
        title={<>人材マネジメントを、<br className="md:hidden" />今日から。</>}
        subtitle="従業員5名まで永久無料。クレジットカード不要で今すぐ始められます。"
        ctaHref={CTA}
        ctaLabel="無料ではじめる"
        note="人数が増えても、スターター・プロへ段階的にアップグレードできます"
      />
    </LpShell>
  )
}
