import { getServiceById } from '@/lib/services'
import { UNIFIED_PRO_PRICE } from '@/lib/unified-plan'
// ドヤポップアップ LPコンテンツ
import type { Step, Benefit, Faq } from '@/components/lp'

// シリーズの青（トークン。.popup-ds の中で解決される。統合仕様 R-3）
export const ACCENT = 'var(--blue)'
export const CTA = '/auth/signin?callbackUrl=/popup'

export const STEPS: Step[] = [
  { icon: 'link', title: 'サイトのURLを入れる', desc: 'URLを1つ入れるだけ。サイトの内容と、問い合わせ・資料・料金などの主要ページを読み取ります。' },
  { icon: 'auto_awesome', title: 'AIがポップアップを3案提案', desc: '「AIに聞く」ボタン、相談・申し込みへの案内、おすすめページの3案を、サイトの色で作ります。' },
  { icon: 'code', title: 'タグを1行貼って公開', desc: 'サイトに設置タグを貼り、使う案を公開にするだけ。表示数・クリック数・クリック率が日別で見られます。' },
]

export const BENEFITS: Benefit[] = [
  { icon: 'image_not_supported', title: '画像を用意しなくていい', desc: 'バナーはサイトの色に合わせて自動でデザインします。文言はあとから自由に直せます。手持ちの画像を使うこともできます。' },
  { icon: 'lightbulb', title: '何を出すかをAIが考える', desc: 'サイトで見つかったページと内容から、出す内容・出すタイミング・出す位置まで提案します。' },
  { icon: 'monitoring', title: '押されたかが数字で分かる', desc: '案ごとの表示数・クリック数・クリック率を日別に計測します。Cookieは使いません。' },
]

export const FAQ: Faq[] = [
  { q: '無料で使えますか？', a: `無料プランは${getServiceById('popup')!.pricing.free.limit}ご利用いただけます。プロプランは月額${UNIFIED_PRO_PRICE.toLocaleString('ja-JP')}円（税込）で、${getServiceById('popup')!.pricing.pro.limit}。1つの契約で全サービスのプロプランが使えます。` },
  { q: 'どんなサイトに設置できますか？', a: 'HTMLの<head>にタグを1行追加できるサイトなら設置できます。WordPress、Studio、Wix、HubSpot CMS などでも、ヘッダーにコードを追加する設定から貼れます。' },
  { q: 'サイトの表示が遅くなりませんか？', a: '設置タグは非同期で読み込み、ページの表示を待たせません。スクリプトは圧縮時7KB程度です。' },
  { q: '「AIに聞く」ボタンを押すと何が起きますか？', a: 'ChatGPTが新しいタブで開き、サイトに合わせた質問文が入力欄に入った状態になります。ChatGPTに質問文を渡す仕組みはOpenAIの公式仕様ではないため、将来動かなくなる可能性があります。' },
  { q: '訪問者の個人情報を取りますか？', a: '取りません。数えるのは案ごとの表示・クリック・閉じた回数だけで、Cookie・IPアドレスは保存しません。' },
]
