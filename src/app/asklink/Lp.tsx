'use client'

// ドヤAI質問リンク ランディングページ（未ログインの方に見せる面）
// ⚠️ 実績数値は持っていないので書かない。
// ⚠️ 画像（ヒーロー・手順）は Codex に依頼中（reference/services/asklink-images.md）。
//    届くまでは画面モック（mocks.tsx）で表示する。
import {
  LpShell, ProductHero, MockWindow, FeatureShowcase,
  HowItWorks, Benefits, UseCases, FaqSection, CtaBand, type ShowcaseRow,
} from '@/components/lp'
import { getServiceById } from '@/lib/services'
import { ACCENT, CTA, STEPS, BENEFITS, FAQ } from './lp-data'
import { AskLinkResultMock, AskLinkBannerMock, AskLinkCopyMock } from './mocks'
import ServiceDiagram from './diagram'

const SVC = getServiceById('asklink')!

const ROWS: ShowcaseRow[] = [
  {
    icon: 'forum',
    title: '訪問者の相談として、自然に届く',
    desc: '質問文は、ボタンを押した訪問者本人の発言としてChatGPTに表示されます。だから指示書のような文面にはせず、訪問者の気持ちから始まる丁寧な相談文として作ります。',
    bullets: ['ToB / ToC を判定して質問の内容を切り替え', '最初に答えやすい選択肢つきで状況を聞いてもらう形', '料金など確認できないことは「相談で確認」に回す'],
    visual: <MockWindow title="質問リンク"><AskLinkResultMock /></MockWindow>,
  },
  {
    icon: 'verified',
    title: 'サイトに無いURLを入れない',
    desc: '質問文に入れるURLは、サイトを読み取ったときに実際に見つかったページだけです。生成後に機械で照合し、合わないもの・長すぎるものは自動で作り直します。',
    bullets: ['文中のURLはサイト上で確認できたものだけ', '文字数とURLの長さを確認', '通らなければ「要確認」と表示'],
    visual: <MockWindow title="機械チェック"><AskLinkResultMock /></MockWindow>,
  },
  {
    icon: 'ad_units',
    title: 'ポップアップ用のバナーも3サイズ',
    desc: '「AIに聞く」ボタン付きのバナーを、PC向けの横長・スライドイン向けの正方形・スマホ向けの縦長で作ります。色はサイトの主要色に合わせます。',
    bullets: ['横長・正方形・縦長の3サイズ', '描かれた文字を読み取って照合', '設置用のHTMLもワンクリックでコピー'],
    visual: <MockWindow title="ポップアップ用バナー"><AskLinkBannerMock /></MockWindow>,
  },
]

export default function AskLinkLp() {
  const freeLimit = SVC.pricing?.free?.limit || '3回まで'
  return (
    <LpShell serviceName={SVC.name} icon="forum" ctaHref={CTA} ctaLabel="無料ではじめる" accent={ACCENT}>
      <ProductHero
        eyebrow="ドヤAI"
        title="URLを入れるだけで、"
        highlight="「AIに聞く」ボタンができる。"
        subtitle="訪問者がサイトについてChatGPTに相談できるリンクと、ポップアップ用のバナーを作ります。開発もチャットボットの導入も要りません。"
        note={`無料プランは${freeLimit}。クレジットカードの登録は不要です。`}
        ctaHref={CTA}
        ctaLabel="無料ではじめる"
        subCtaHref="/asklink/pricing"
        subCtaLabel="料金を見る"
        visual={<MockWindow title="ドヤAI質問リンク"><AskLinkCopyMock /></MockWindow>}
      />

      <UseCases
        title="こんな場面のためのものです"
        items={[
          'チャットボットを入れずに、訪問者が相談できる入口を置きたい',
          '無料相談の前に、訪問者に準備を済ませてきてほしい',
          'サイトを読んでも自分に合うか分からず、離脱されている',
          'ポップアップに置くボタンを、すぐに用意したい',
        ]}
      />

      <FeatureShowcase title="置いてすぐ使える形で" lead="コピーして貼るだけで設置が終わるように作ります。" rows={ROWS} />

      <HowItWorks title="3ステップで設置まで" steps={STEPS} diagram={<ServiceDiagram steps={STEPS} />} />

      <Benefits title="選ばれる理由" items={BENEFITS} />

      <FaqSection items={FAQ} />

      <CtaBand
        title="サイトに「AIに聞く」入口を置きましょう"
        subtitle="URLを入れるだけで、リンクとバナーができます。"
        ctaHref={CTA}
        ctaLabel="無料ではじめる"
        note="ChatGPTに質問文を渡す仕組みはOpenAIの公式仕様ではないため、将来動かなくなる可能性があります。"
      />
    </LpShell>
  )
}
