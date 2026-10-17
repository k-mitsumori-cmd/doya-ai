import { getServiceById } from '@/lib/services'
import { UNIFIED_PRO_PRICE } from '@/lib/unified-plan'
// ドヤ社内インタビュー LPコンテンツ
import type { Step, Benefit, Faq } from '@/components/lp'

export const ACCENT = '#c026d3'
export const CTA = '/auth/signin?callbackUrl=/shanai'

export const STEPS: Step[] = [
  { icon: 'language', title: '会社のURLを登録', desc: '会社サイト・サービスサイト・採用ページのURLを入れると、ミッションや事業、数字、制度を読み取ります。最初に1回だけです。' },
  { icon: 'mic', title: '録音かアンケートを用意', desc: '社内インタビューの録音をアップロードするか、社員にアンケートのURLを送ります。写真も数枚アップロードします。' },
  { icon: 'description', title: '記事とサムネが完成', desc: '本人の言葉と会社の事実をつなげた記事ができます。Wordでダウンロードでき、サムネ画像も自動で作られます。' },
]

export const BENEFITS: Benefit[] = [
  { icon: 'fact_check', title: '書いていないことは書かない', desc: '先に録音・回答・会社サイトから「事実」だけを原文つきで抜き出し、確認した事実だけで記事を書きます。根拠のない段落は編集画面で知らせます。' },
  { icon: 'domain', title: '会社ならではの記事になる', desc: '会社サイトやサービスサイトの内容を読み取り、社員の仕事が会社のどこにつながっているかを記事の中で紹介します。' },
  { icon: 'edit_document', title: 'Wordで受け取ってすぐ使える', desc: '写真とサムネ入りの Word ファイルでダウンロードできます。Googleドライブで開けば Googleドキュメントとしても編集できます。' },
]

export function faq(): Faq[] {
  const svc = getServiceById('shanai')!
  return [
    { q: '無料で使えますか？', a: `無料プランは${svc.pricing.free.limit}ご利用いただけます。プロプランは月額${UNIFIED_PRO_PRICE.toLocaleString('ja-JP')}円（税込）で、${svc.pricing.pro.limit}。1つの契約で全サービスのプロプランが使えます。` },
    { q: '録音とアンケート、どちらがいいですか？', a: '対面で話を聞けるなら録音がおすすめです。忙しい社員には、アンケートのURLを送って後から書いてもらえます。アンケートは設問ごとに最低文字数があり、足りない設問にはAIが追加質問をします。' },
    { q: '記事に事実と違うことが書かれませんか？', a: '記事は、録音・回答・会社サイトから抜き出した事実だけを材料に書きます。抜き出した事実はすべて原文と照らし合わせ、原文に無いものは捨てています。それでも、公開前には必ずご本人と担当者で内容をご確認ください。' },
    { q: 'サムネ画像はAIが作るのですか？', a: 'いいえ。アップロードしたご本人の写真に、記事の一言とお名前を重ねて作ります。画像生成AIは使いません。' },
    { q: '社員の録音や写真はどう扱われますか？', a: '非公開の保存領域に置き、ログインしたご本人のアカウントからしか見られません。インタビューを削除すると、録音と写真も一緒に削除されます。' },
  ]
}
