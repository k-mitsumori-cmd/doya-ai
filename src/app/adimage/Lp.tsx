'use client'

// ドヤ広告画像AI ランディングページ（未ログインの方に見せる面）
// ⚠️ 構成は国内BtoB SaaS LP15本の最頻の型。実績数値は持っていないので書かない。
import {
  LpShell, ProductHero, MockWindow, FeatureShowcase,
  HowItWorks, Benefits, UseCases, FaqSection, CtaBand, type ShowcaseRow,
} from '@/components/lp'
import { getServiceById } from '@/lib/services'
import { ACCENT, CTA, STEPS, BENEFITS, FAQ } from './lp-data'
import { AdImageGridMock, AdImageVerifyMock, AdImageRefineMock } from './mocks'

const SVC = getServiceById('adimage')!

const ROWS: ShowcaseRow[] = [
  {
    icon: 'aspect_ratio',
    title: '媒体別の実寸で、切り抜かずに',
    desc: '目標サイズと同じ比率で生成してから縮小します。正方形から作った画像を縦長に切り抜く、といった処理をしないので、文字が切れません。',
    bullets: ['Meta・Google・X・LINE・Yahoo! の各配置に対応', '目標比率のまま生成するので文字切れが起きない', '媒体別に整理したZIPで一括ダウンロード'],
    visual: <MockWindow title="媒体別の書き出し"><AdImageGridMock /></MockWindow>,
  },
  {
    icon: 'spellcheck',
    title: '文字が正しく出たかを検査する',
    desc: '画像生成AIは文字を崩すことがあります。生成後に描かれた文字を読み取って指定と照合し、合っていなければ自動で作り直します。',
    bullets: ['文字を画像に直接描き込む（後乗せの継ぎはぎなし）', '描かれた文字を読み取って照合', '不合格なら自動で作り直し'],
    visual: <MockWindow title="文字の検査"><AdImageVerifyMock /></MockWindow>,
  },
  {
    icon: 'auto_fix_high',
    title: '気になるところを直せる',
    desc: 'AIが実際に出来上がった画像を見て採点し、具体的な改善点を出します。ボタンを押すだけで、その改善を反映した次の案を作ります。',
    bullets: ['出来上がった画像をAIが見て採点', '具体的な改善点を文章で提示', 'ボタン一つで改善版を再生成'],
    visual: <MockWindow title="採点と改善"><AdImageRefineMock /></MockWindow>,
  },
]

export default function AdImageLp() {
  return (
    <LpShell serviceName={SVC.name} icon="wallpaper" ctaHref={CTA} ctaLabel="無料ではじめる" accent={ACCENT}>
      <ProductHero
        eyebrow="ドヤマーケAI"
        title="URLを貼るだけで、"
        highlight="入稿できる広告画像。"
        subtitle="媒体・配置ごとにサイズの揃った広告画像が出ます。文字は画像に描き込み済みで、そのまま入稿できます。"
        note="無料プランで1日5コンセプトまでお試しいただけます。クレジットカードの登録は不要です。"
        ctaHref={CTA}
        ctaLabel="無料ではじめる"
        subCtaHref="/adimage/pricing"
        subCtaLabel="料金を見る"
        image={{ src: '/adimage/hero.webp', alt: 'ドヤ広告画像AIの媒体別サイズ生成画面' }}
        visual={<MockWindow title="ドヤ広告画像AI"><AdImageGridMock /></MockWindow>}
      />

      <UseCases
        title="こんな場面のためのものです"
        items={[
          '毎週の広告クリエイティブの差し替えに手が回らない',
          'デザイナーに頼まず自分で入稿物を揃えたい',
          '媒体ごとにサイズを作り直すのが面倒',
          '切り抜きで文字が切れて、入稿前に作り直しになる',
        ]}
      />

      <FeatureShowcase
        title="そのまま入稿できる状態で"
        lead="作った後の手直しを、なるべく無くす設計にしています。"
        rows={ROWS}
      />

      <HowItWorks title="3ステップで入稿物まで" steps={STEPS} />

      <Benefits title="選ばれる理由" items={BENEFITS} />

      <FaqSection items={FAQ} />

      <CtaBand
        title="今週の差し替えから、間に合います"
        subtitle="無料プランで1日5コンセプトまで。プロプランなら月額9,980円で、ドヤシリーズの全サービスが使えます。"
        ctaHref={CTA}
        ctaLabel="無料ではじめる"
        note="クレジットカードの登録は不要です"
      />
    </LpShell>
  )
}
