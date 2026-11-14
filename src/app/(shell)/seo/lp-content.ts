// ドヤ記事作成 LP（新しい共通の型 lp-kit 用）の設定。文言・数字はここに集める。
// ⚠️ 機能の説明・数字は Lp.tsx / lp-data.ts / services.ts の範囲内。導入社数・ロゴ・お客様の声・根拠のない数字は書かない。
// ⚠️ 「5万字書けます」と言い切らない。最後の CTA に月額金額は書かない（料金は料金ページへのリンクだけ）。
import { getServiceById } from '@/lib/services'
import type { LpKitContent } from '@/components/lp-kit/types'
import { CTA, FAQ, STEPS } from './lp-data'

const SVC = getServiceById('seo')!
const FREE_LIMIT = SVC.pricing.free.limit // 例: 記事3本/月まで
const FREE_N = FREE_LIMIT.match(/\d+/)?.[0]
const FREE_PHRASE = FREE_N ? `月${FREE_N}本` : FREE_LIMIT

/** 書き出しの形式。実際の書き出し画面（articles/[id]/export）の形式に合わせる（lp-data.ts の FAQ には JSON とあるが、書き出し画面には無い。要確認） */
export const EXPORT_FORMATS = ['HTML', 'Markdown', 'note', 'テキスト']
export const SEO_ACCENT = '#ffd400' // gold（文章の道具に合う黄色の線）

export const SEO_LP_CONTENT: LpKitContent = {
  serviceName: SVC.name,
  ctaHref: CTA,
  loginHref: CTA,
  pricingHref: '/seo/pricing',
  hero: {
    heading: {
      phrases: ['SEO記事を、', '構成から', '公開前の', '点検まで', '作る。'],
      breakPc: [1],
      breakSp: [0, 2],
      mark: [3],
    },
    sub: 'キーワードと参考URLを入れると、検索意図に沿った構成を作り、章ごとに前後のつながりを確かめながら書き上げて、公開前に点検します。',
    ctaLabel: '無料で記事を作る',
    subCtaLabel: '操作の流れを見る',
    note: `無料プランで${FREE_PHRASE}まで。クレジットカードの登録は不要です。`,
    image: { src: '/renewal/cinematic/seo-20260910-v1.webp', alt: 'ドヤくんが階段の上で記事づくりの道具を使っているイラスト', width: 1672, height: 941 },
    facts: ['クレジットカード登録は不要', `無料で${FREE_PHRASE}まで`, `${EXPORT_FORMATS.length}形式で書き出し`],
  },
  stage: {
    heading: { phrases: ['記事が', 'できるまでの', '流れを、', '画面で', '見る。'] },
    lead: 'キーワードを入れてから、構成、本文、チェック、完成まで。製品の画面を再現して、順に動かしています。下の札を押すと、その段階から見られます。',
    windowTitle: SVC.name,
    tabs: [
      { id: 'input', label: 'キーワード', from: 0 },
      { id: 'outline', label: '構成', from: 2200 },
      { id: 'write', label: '本文', from: 4400 },
      { id: 'check', label: 'チェック', from: 6400 },
    ],
    duration: 8400,
    hold: 3200,
    caption: 'サンプルのデータで再現した画面です。実際の画面や出力は、入力した内容によって変わります。',
  },
  stats: {
    items: [
      { value: Number(FREE_N ?? 3), unit: '本 / 月', label: '無料プランで作れる記事' },
      { value: EXPORT_FORMATS.length, unit: '形式', label: '書き出しの形式' },
      { value: STEPS.length, unit: 'ステップ', label: '使う手順の数' },
    ],
    marqueeLabel: '書き出しと、いっしょに作れるもの',
    marquee: [...EXPORT_FORMATS, '図解', 'アイキャッチ', 'リンク切れの確認'],
  },
  showcase: {
    heading: { phrases: ['作れるものを、', '先に', '見る。'] },
    lead: 'サンプルのキーワードから、製品の出力に近い形で再現した例です。実際の出力は、入力した内容によって変わります。',
    items: [
      { title: '完成した記事', keyword: 'BtoB マーケティング AI活用', note: '章ごとに書いた本文を、見出しと一緒に確認できます。' },
      { title: '検索意図から作った構成', keyword: 'BtoB マーケティング AI活用', note: '見出しごとに役割を決めてから、本文に進みます。' },
      { title: '図解', keyword: 'AI活用 導入ステップ', note: '本文に合わせた図解の画像を作れます。' },
      { title: 'アイキャッチ', keyword: 'BtoB マーケティング AI活用', note: '記事に添えるアイキャッチ画像も作れます。' },
      { title: '書き出した HTML', keyword: 'BtoB マーケティング AI活用', note: 'HTML、Markdown、note、テキストで書き出せます。' },
      { title: '無料でできる範囲', keyword: '無料プランの内容', note: `${FREE_LIMIT}。クレジットカードの登録は不要です。` },
    ],
  },
  features: {
    heading: { phrases: ['構成から', '監査まで、', 'ひとつながりに。'] },
    items: [
      { icon: 'search', title: '検索意図を先に整理', desc: 'キーワード・読者・参考URLを入力し、記事が答えるべき問いを決めます。', bullets: ['参考URLは要点化して利用', '読者と目的を記事ごとに指定'] },
      { icon: 'list', title: '章ごとに筋を通す', desc: '検索意図をもとにアウトラインを組み、章ごとに書き進めます。', bullets: ['見出しごとの役割を明示', '前後の主張を整合性チェック'] },
      { icon: 'check', title: '公開前に自動監査', desc: '重複・根拠・リンクを確認し、修正が必要な箇所を明示します。', bullets: ['根拠が薄い箇所を検出', 'リンク切れも確認'] },
    ],
  },
  statement: {
    label: '参考記事の使い方',
    phrases: ['参考記事を', '写さず、', '話の筋を', '保ったまま、', '長い記事に', 'する。'],
    breakPc: [1, 3],
    breakSp: [1, 3],
  },
  steps: {
    heading: { phrases: ['使い方は', '3ステップ。'] },
    items: [
      { title: STEPS[0].title, desc: STEPS[0].desc, item: 'pen' },
      { title: STEPS[1].title, desc: STEPS[1].desc, item: 'doc' },
      { title: STEPS[2].title, desc: STEPS[2].desc, item: 'lens' },
    ],
    bearLines: ['キーワードから、はじめましょう。', '章ごとに、書き進めます。', '公開前に、点検します。'],
  },
  faq: {
    heading: { phrases: ['よくある', '質問'] },
    items: [
      { q: FAQ[0].q, a: `無料プランは${FREE_LIMIT}ご利用いただけます。有料プランの内容と料金は、料金ページでご確認ください。1つの契約で全サービスのプロプランが使えます。` },
      FAQ[1],
      { q: 'LLMO（AI検索）を意識した作りですか？', a: FAQ[2].a },
      { q: FAQ[3].q, a: '本文はエディタで編集でき、HTML・Markdown・note・テキストで書き出せます。note に貼り付けやすい形式にも対応しています。' },
      // 利用規約 第5条（src/app/terms/page.tsx）の文言に合わせた「できないこと」
      { q: '生成された記事の内容は保証されますか？', a: '利用規約の第5条で、本サービスの内容について、正確性、完全性、有用性等を保証しないと定めています。詳しくは利用規約をご覧ください。' },
    ],
    pricingLinkLabel: '料金の詳細は、料金ページをご覧ください',
  },
  finalCta: {
    heading: { phrases: ['まず1本、', '無料で', '作ってみる。'] },
    imageSrc: '/character/hello-512.webp',
    imageAlt: 'あいさつをしているドヤくん',
  },
  footerLinks: [
    { label: 'サービス一覧', href: '/' },
    { label: '料金', href: '/seo/pricing' },
    { label: '利用規約', href: '/terms' },
    { label: 'プライバシー', href: '/privacy' },
    { label: '特定商取引法', href: '/tokushoho' },
  ],
}
