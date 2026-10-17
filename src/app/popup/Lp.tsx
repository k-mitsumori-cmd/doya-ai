'use client'

// ドヤポップアップ ランディングページ（未ログインの方に見せる面）
// ⚠️ 実績数値は持っていないので書かない。ヒーロー画像の数値は「表示例」と画像内に明記している。
// ヒーロー画像・アイコンは SVG から sharp で描き出したもの（画像生成APIは使っていない）。
import {
  LpShell, ProductHero, MockWindow, FeatureShowcase,
  HowItWorks, Benefits, UseCases, FaqSection, CtaBand, type ShowcaseRow,
} from '@/components/lp'
import { getServiceById } from '@/lib/services'
import { ACCENT, CTA, STEPS, BENEFITS, FAQ } from './lp-data'

const SVC = getServiceById('popup')!

const ROWS: ShowcaseRow[] = [
  {
    icon: 'auto_awesome',
    title: 'URLだけで、出す内容までAIが考える',
    desc: 'サイトを読み取り、そのサイトに合ったポップアップを3案作ります。ChatGPTに相談できる「AIに聞く」ボタン、問い合わせや資料への案内、次に読むおすすめページです。',
    bullets: ['ToB / ToC を判定して内容を切り替え', 'リンク先はサイトで実際に見つかったページだけ', '出すタイミングと位置もあわせて提案'],
    image: { src: '/popup/hero.webp', alt: 'AIが提案したポップアップがサイトの上に表示されている様子' },
  },
  {
    icon: 'tune',
    title: '出し方を細かく決められる',
    desc: '何秒後・何％スクロールしたら・ページを離れそうなとき、の3つのきっかけと、端末・ページ・頻度を設定できます。スマホでは画面を覆わない形で出します。',
    bullets: ['中央・右下・下部の帯の3つの形', 'PCのみ・スマホのみ・特定のページだけ', '閉じたら何日出さないかを設定'],
    visual: (
      <MockWindow title="表示の条件">
        <div className="space-y-2 p-4 text-left">
          {[
            ['きっかけ', '50%スクロールしたら'],
            ['形', '中央に表示（スマホは下から）'],
            ['端末', 'PC・スマホ'],
            ['ページ', '/service/* のページだけ'],
            ['頻度', '閉じたら7日表示しない'],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5">
              <span className="text-xs font-black text-slate-500">{k}</span>
              <span className="text-sm font-black text-slate-800">{v}</span>
            </div>
          ))}
        </div>
      </MockWindow>
    ),
  },
]

export default function PopupLp() {
  const freeLimit = SVC.pricing?.free?.limit || '提案3回まで'
  return (
    <LpShell serviceName={SVC.name} icon="web_asset" ctaHref={CTA} ctaLabel="無料ではじめる" accent={ACCENT}>
      <ProductHero
        eyebrow="ドヤAI"
        title="URLを入れるだけで、"
        highlight="押されるポップアップができる。"
        subtitle="AIがサイトに合ったポップアップを提案し、タグを1行貼るだけで表示。クリック率まで計測できます。"
        note={`無料プランは${freeLimit}。クレジットカードの登録は不要です。`}
        ctaHref={CTA}
        ctaLabel="無料ではじめる"
        subCtaHref="/popup/pricing"
        subCtaLabel="料金を見る"
        image={{ src: '/popup/hero.webp', alt: 'サイトの上に表示された「AIに聞く」ポップアップと計測の数字' }}
      />

      <UseCases
        title="こんな場面のためのものです"
        items={[
          'HubSpotなどを契約せずに、サイトにポップアップを出したい',
          'ポップアップに何を出せばよいか分からない',
          'バナー画像を毎回作るのが手間になっている',
          '出したポップアップが押されているか、数字で確かめたい',
        ]}
      />

      <FeatureShowcase title="提案から計測まで、ひとつで" lead="作る・出す・測るを、同じ画面で行えます。" rows={ROWS} />

      <HowItWorks title="3ステップで設置まで" steps={STEPS} />

      <Benefits title="選ばれる理由" items={BENEFITS} />

      <FaqSection items={FAQ} />

      <CtaBand
        title="サイトに、押されるポップアップを"
        subtitle="URLを入れるだけで、AIが3案を提案します。"
        ctaHref={CTA}
        ctaLabel="無料ではじめる"
      />
    </LpShell>
  )
}
