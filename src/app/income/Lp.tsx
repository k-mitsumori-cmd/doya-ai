'use client'

// ドヤ収入管理 ランディングページ（未ログインの方に見せる面）
// ⚠️ 実績数値は持っていないので書かない。画面の数字はすべて「表示例」。
import {
  LpShell, ProductHero, MockWindow, FeatureShowcase,
  HowItWorks, Benefits, UseCases, FaqSection, CtaBand, type ShowcaseRow,
} from '@/components/lp'
import { getServiceById } from '@/lib/services'
import { ACCENT, CTA, STEPS, BENEFITS, FAQ } from './lp-data'

const SVC = getServiceById('income')!

function KpiMock() {
  const tiles = [
    ['売上予定', '¥3,200,000'],
    ['請求済', '¥2,400,000'],
    ['入金済', '¥1,800,000'],
    ['未入金', '¥600,000'],
  ]
  return (
    <MockWindow title="ダッシュボード（表示例）">
      <div className="grid grid-cols-2 gap-2 p-4 text-left">
        {tiles.map(([k, v]) => (
          <div key={k} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
            <p className="text-[11px] font-black text-slate-500">{k}</p>
            <p className="text-base font-black tabular-nums text-slate-900">{v}</p>
          </div>
        ))}
        <div className="col-span-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
          <p className="text-xs font-black text-red-700">請求漏れ サンプル商事 11月分 ¥300,000</p>
          <p className="text-[11px] font-bold text-red-600">請求予定日 11/30 を経過</p>
        </div>
      </div>
    </MockWindow>
  )
}

const ROWS: ShowcaseRow[] = [
  {
    icon: 'event_repeat',
    title: '契約から、毎月の売上予定を自動で作る',
    desc: '月額・四半期・年額、前払い・後払い、月の途中からの日割りにも対応。自動更新の契約は先々の月まで予定を延ばします。',
    bullets: ['請求予定日を過ぎた未請求の月を「請求漏れ」として表示', '今月は請求しない月は理由を残してスキップ', '契約を変えると、未請求の月だけ作り直し'],
    visual: <KpiMock />,
  },
  {
    icon: 'receipt_long',
    title: '請求書と入金を、同じ画面で',
    desc: '月次の一覧から取引先ごとに請求書をまとめて作成。入金を登録すると、金額と振込名義から照合の候補を出します。',
    bullets: ['登録番号・税率ごとの内訳を記載した請求書', '確定後は編集できない（取消して作り直し）', '一部入金・2か月分まとめての入金・手数料差引に対応'],
    visual: (
      <MockWindow title="入金の照合（表示例）">
        <div className="space-y-2 p-4 text-left">
          {[
            ['ｶ)ｻﾝﾌﾟﾙｼｮｳｼﾞ ¥330,000', '金額と振込名義が一致'],
            ['ﾍﾞﾂｶﾞｲｼｬ ¥219,340', '振込名義が一致（660円不足・手数料の可能性）'],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
              <p className="text-sm font-black text-slate-800">{k}</p>
              <p className="text-[11px] font-bold text-emerald-700">{v}</p>
            </div>
          ))}
        </div>
      </MockWindow>
    ),
  },
]

export default function IncomeLp() {
  return (
    <LpShell serviceName={SVC.name} icon="payments" ctaHref={CTA} ctaLabel="無料ではじめる" accent={ACCENT}>
      <ProductHero
        eyebrow="ドヤAI"
        title="契約を入れるだけで、"
        highlight="請求漏れが起きない。"
        subtitle="B2Bの「契約 → 毎月の売上 → 請求書 → 入金」を一本の線で管理。出し忘れと入金の確認漏れを、ダッシュボードで気づけるようにします。"
        note="開発中のため、現在は無料でお使いいただけます。"
        ctaHref={CTA}
        ctaLabel="無料ではじめる"
        subCtaHref="/income/pricing"
        subCtaLabel="料金を見る"
        visual={<KpiMock />}
      />

      <UseCases title="こんな場面のためのものです" items={SVC.useCases ?? []} />

      <FeatureShowcase title="契約から入金まで、ひとつで" lead="売上予定・請求書・入金を同じデータでつなぎます。" rows={ROWS} />

      <HowItWorks title="3ステップで回りはじめる" steps={STEPS} />

      <Benefits title="選ばれる理由" items={BENEFITS} />

      <FaqSection items={FAQ} />

      <CtaBand title="請求の出し忘れを、なくしましょう" subtitle="契約を登録するだけで、毎月の売上予定ができます。" ctaHref={CTA} ctaLabel="無料ではじめる" />
    </LpShell>
  )
}
