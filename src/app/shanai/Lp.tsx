'use client'

// ドヤ社内インタビュー ランディングページ（未ログインの方に見せる面）
// ⚠️ 実績数値は持っていないので書かない。画面の例はコード内のモックで、実在の社員・会社ではない。
import { LpShell, ProductHero, MockWindow, FeatureShowcase, HowItWorks, Benefits, UseCases, FaqSection, CtaBand, type ShowcaseRow } from '@/components/lp'
import { getServiceById } from '@/lib/services'
import { ACCENT, CTA, STEPS, BENEFITS, faq } from './lp-data'

const SVC = getServiceById('shanai')!

function FactMock() {
  const rows: [string, string, string][] = [
    ['本人', 'お客様の声を直接聞けることが、いちばんのやりがい', '録音 12:40'],
    ['本人', '入社2年目で新サービスの立ち上げを任された', '録音 18:05'],
    ['会社', '「はたらくを、もっと誇れるものに」を掲げている', '会社サイト'],
  ]
  return (
    <MockWindow title="記事の根拠になる事実（表示例）">
      <div className="space-y-2 p-4 text-left">
        {rows.map(([who, text, src]) => (
          <div key={text} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${who === '会社' ? 'bg-slate-100 text-slate-600' : 'bg-fuchsia-50 text-fuchsia-700'}`}>{who}</span>
              <span className="text-[10px] font-bold text-slate-400">{src}</span>
            </div>
            <p className="mt-1 text-sm font-black text-slate-800">{text}</p>
          </div>
        ))}
      </div>
    </MockWindow>
  )
}

function ArticleMock() {
  return (
    <MockWindow title="できあがる記事（表示例）">
      <div className="space-y-3 p-5 text-left">
        <p className="text-base font-black leading-snug text-slate-900">「お客様の声が、仕事のいちばんの原動力です」</p>
        <p className="text-xs font-bold leading-relaxed text-slate-500">カスタマーサクセス部 リーダー / 2021年入社</p>
        <p className="text-sm font-black text-fuchsia-700">― 入社を決めた理由を教えてください。</p>
        <p className="text-sm font-bold leading-relaxed text-slate-700">前職では、自分の仕事がお客様にどう届いているのか見えませんでした。面接で……</p>
      </div>
    </MockWindow>
  )
}

const ROWS: ShowcaseRow[] = [
  {
    icon: 'fact_check',
    title: '書いていないことは、書かない',
    desc: '録音やアンケートの回答から「事実」だけを原文つきで抜き出します。担当者が確認した事実だけを使って記事を書くので、想像で盛った文章になりません。',
    bullets: ['事実はすべて原文と照合し、原文に無いものは捨てる', '根拠のない段落は編集画面で警告', 'アンケートは最低文字数とAIの追加質問で、材料を十分に集める'],
    visual: <FactMock />,
  },
  {
    icon: 'domain',
    title: '会社のURLで、その会社だけの記事に',
    desc: '会社サイト・サービスサイト・採用ページを読み取り、ミッションや事業、数字、制度を会社プロフィールにまとめます。社員の仕事がどのサービスにつながっているかまで記事で伝えます。',
    bullets: ['会社情報は一度登録すれば全インタビューで使い回し', 'サイトに書かれた原文を根拠として保存', 'サムネは会社の色とご本人の写真で作成'],
    visual: <ArticleMock />,
  },
]

export default function ShanaiLp() {
  const freeLimit = SVC.pricing?.free?.limit || '記事3本まで'
  return (
    <LpShell serviceName={SVC.name} icon="badge" ctaHref={CTA} ctaLabel="無料ではじめる" accent={ACCENT}>
      <ProductHero
        eyebrow="ドヤAI"
        title="録音と写真を入れるだけで、"
        highlight="会社が魅力的に見える社員インタビュー。"
        subtitle="社内インタビューの録音か、社員のアンケート回答から、会社の情報と組み合わせた記事をAIが書き上げます。Wordとサムネ画像で受け取れます。"
        note={`無料プランは${freeLimit}。クレジットカードの登録は不要です。`}
        ctaHref={CTA}
        ctaLabel="無料ではじめる"
        subCtaHref="/shanai/pricing"
        subCtaLabel="料金を見る"
        visual={<ArticleMock />}
      />

      <UseCases
        title="こんな場面のためのものです"
        items={[
          '採用サイトに社員インタビューを載せたいが、書く人がいない',
          'インタビューはしたものの、録音が手つかずのまま残っている',
          '社員にアンケートを書いてもらって、記事にまとめたい',
          '会社の魅力が伝わる社内報を、毎月出したい',
        ]}
      />

      <FeatureShowcase title="素材集めから記事まで、ひとつで" lead="録音でもアンケートでも、同じ手順で記事になります。" rows={ROWS} />

      <HowItWorks title="3ステップで記事が完成" steps={STEPS} />

      <Benefits title="選ばれる理由" items={BENEFITS} />

      <FaqSection items={faq()} />

      <CtaBand title="社員の言葉を、会社の魅力に" subtitle="録音か、アンケートの回答と写真があれば始められます。" ctaHref={CTA} ctaLabel="無料ではじめる" />
    </LpShell>
  )
}
