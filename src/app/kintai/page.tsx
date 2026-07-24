'use client'

import { getServiceById } from '@/lib/services'
import {
  LpShell, ProductHero, MockWindow, FeatureShowcase, HowItWorks, Benefits, UseCases, FaqSection, CtaBand,
  type ShowcaseRow,
} from '@/components/lp'
import { ACCENT, CTA, STEPS, BENEFITS, FAQ } from './lp-data'
import { KintaiClockMock, KintaiSummaryMock, KintaiRequestsMock } from './mocks'

const SVC = getServiceById('kintai')!

const ROWS: ShowcaseRow[] = [
  {
    icon: 'punch_clock', title: 'ワンクリックで出退勤を打刻',
    desc: 'PC・スマホのブラウザから、出勤・退勤ボタンを押すだけ。本日の勤務時間と現在時刻がひと目でわかり、専用アプリのインストールも不要です。',
    bullets: ['PC・スマホ両対応（アプリ不要）', '本日の勤務時間をリアルタイム表示', '全員の勤務状況がすぐに見える'],
    visual: <MockWindow title="doya-ai.surisuta.jp/kintai"><KintaiClockMock /></MockWindow>,
  },
  {
    icon: 'bar_chart', title: '勤怠を自動で集計',
    desc: '日次・月次の実働時間を自動集計。残業・深夜・休日出勤も就業ルールに沿って正確に計算するので、Excelの手計算やミスから解放されます。',
    bullets: ['実働・残業を自動で正確に計算', '月次の締め処理まで一気通貫', 'CSVで給与ソフトへエクスポート'],
    visual: <MockWindow title="勤怠集計"><KintaiSummaryMock /></MockWindow>,
  },
  {
    icon: 'task_alt', title: '申請・承認をオンラインで完結',
    desc: '休暇・残業・打刻修正の申請から承認までを一画面で。承認フローは組織に合わせて設定でき、メールでのやり取りから解放されます。',
    bullets: ['休暇・残業・打刻修正に対応', '承認・却下をその場でワンタップ', '未処理の申請がひと目でわかる'],
    visual: <MockWindow title="申請・承認"><KintaiRequestsMock /></MockWindow>,
  },
]

export default function KintaiLandingPage() {
  return (
    <LpShell serviceName="ドヤ勤怠" icon="schedule" ctaHref={CTA} ctaLabel="無料ではじめる" accent={ACCENT}>
      <ProductHero
        eyebrow="クラウド勤怠管理"
        title="勤怠管理を、"
        highlight="シンプルに。"
        subtitle="打刻・集計・申請承認をオールインワンで。中小企業のための、すぐ使えるクラウド勤怠管理システムです。"
        note="従業員5名まで無料。面倒な初期設定は不要ではじめられます"
        ctaHref={CTA}
        ctaLabel="無料ではじめる"
        subCtaHref="/kintai/pricing"
        subCtaLabel="料金を見る"
        visual={<MockWindow title="doya-ai.surisuta.jp/kintai"><KintaiClockMock /></MockWindow>}
      />
      <HowItWorks
        title={<>打刻から承認まで<br className="md:hidden" />3ステップ</>}
        lead="毎日の打刻も、月末の締めも、そのまま自動化します。"
        steps={STEPS}
      />
      <FeatureShowcase title="現場で使う機能を、そのまま見せます。" lead="勤怠管理に必要な機能を、ひとつの画面に。" rows={ROWS} />
      <Benefits title="なぜ、勤怠管理が変わるのか" items={BENEFITS} />
      {SVC.useCases && <UseCases items={SVC.useCases} />}
      <FaqSection items={FAQ} />
      <CtaBand
        title={<>勤怠管理、<br className="md:hidden" />今日からラクにする。</>}
        subtitle="従業員5名まで無料。アカウントを作ればすぐに打刻を始められます。"
        ctaHref={CTA}
        ctaLabel="無料ではじめる"
        note="無料プランで従業員5名までご利用いただけます"
      />
    </LpShell>
  )
}
