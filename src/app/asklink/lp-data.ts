import { getServiceById } from '@/lib/services'
import { UNIFIED_PRO_PRICE } from '@/lib/unified-plan'
// ドヤAI質問リンク LPコンテンツ（page.tsx の表示と layout.tsx の JSON-LD で共有）
import type { Step, Benefit, Faq } from '@/components/lp'

export const ACCENT = '#0066ff' // ドヤシリーズのブランドブルー
export const CTA = '/auth/signin?callbackUrl=/asklink'

export const STEPS: Step[] = [
  { icon: 'link', title: 'サイトのURLを入れる', desc: '自社サイトのURLを1つ入れるだけ。サイトの内容と、問い合わせ・資料・料金などの主要ページを読み取ります。' },
  { icon: 'forum', title: 'リンクとバナーができる', desc: 'ChatGPTに質問が届く「AIに聞く」リンクを2本と、ボタン付きのバナーを3サイズ作ります。' },
  { icon: 'content_paste', title: 'ポップアップに貼る', desc: 'URLと画像をコピーして、HubSpotなどのポップアップに貼るだけで設置が終わります。' },
]

export const BENEFITS: Benefit[] = [
  { icon: 'code_off', title: '開発もチャットボットも不要', desc: '置くのはリンクと画像だけです。サイトの改修やチャットボットの導入・学習は要りません。' },
  { icon: 'record_voice_over', title: '訪問者の言葉で届く', desc: '質問文は、ボタンを押した訪問者本人の相談として自然に読める形で作ります。命令口調の文面にはしません。' },
  { icon: 'verified', title: 'サイトに無いURLを入れない', desc: '質問文に入るURLは、サイト上で実際に見つかったものだけです。生成後に機械で照合し、合わなければ作り直します。' },
]

export const FAQ: Faq[] = [
  { q: '無料で使えますか？', a: `無料プランは${getServiceById('asklink')!.pricing.free.limit}ご利用いただけます。プロプランは月額${UNIFIED_PRO_PRICE.toLocaleString('ja-JP')}円（税込）で、${getServiceById('asklink')!.pricing.pro.limit}。1つの契約で全サービスのプロプランが使えます。` },
  { q: 'リンクを押すと何が起きますか？', a: 'ChatGPTが新しいタブで開き、サイトに合わせた質問文が入力欄に入った状態になります（ウェブ検索も有効になります）。訪問者は送信ボタンを押すだけで相談を始められます。訪問者のChatGPTアカウントで動くため、こちら側の利用料はかかりません。' },
  { q: 'ずっと使い続けられますか？', a: 'ChatGPTに質問文を渡す仕組み（URLの q と hints の指定）はOpenAIの公式仕様ではありません。将来ChatGPT側の変更で動かなくなる可能性があります。' },
  { q: 'どのポップアップツールで使えますか？', a: 'ボタンやバナーにリンク先URLを設定できるツールであれば使えます。HubSpotのポップアップのほか、画像とリンクを置けるWebサイトのバナー枠でも使えます。' },
]
