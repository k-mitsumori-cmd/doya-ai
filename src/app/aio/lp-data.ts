// ドヤAIO LP コンテンツ（page.tsx の表示と layout.tsx の JSON-LD で共有）
import type { Step, Benefit, Faq } from '@/components/lp'

export const ACCENT = '#00b8d4' // シアン（AI可視性 / AEO）
// ランディングは URL クイックスタート入力（#start）へ誘導する
export const CTA = '#start'

export const STEPS: Step[] = [
  { icon: 'add_link', title: 'URLを登録', desc: '分析したいサービスのURLを入れるだけ。サービス名や監視する質問（プロンプト）はAIが自動で用意します。あとから編集もできます。' },
  { icon: 'forum', title: '4つのAIで観測', desc: 'ChatGPT・Gemini・Claude・Perplexityに同じ質問群を反復で投げ、自社ブランドの言及率・Share of Voice・引用元ドメイン・感情を測定します。' },
  { icon: 'tips_and_updates', title: '改善アクションを提案', desc: 'AIに引用されるための打ち手（メディア掲載・サイトのAI可読化・比較コンテンツ）まで提案。認知度・SoVの推移も記録します。' },
]

export const BENEFITS: Benefit[] = [
  { icon: 'visibility', title: 'AIからの見られ方が数字でわかる', desc: '言及率・引用元・論調（ポジ/ネガ）まで測定。感覚ではなくデータで、AI上の現状を把握できます。' },
  { icon: 'leaderboard', title: '競合とのSoVを比較できる', desc: '同じ質問群で、競合より自社がどれだけ登場するか。AI上の占有率（Share of Voice）を定点観測します。' },
  { icon: 'trending_up', title: '改善を時系列で追える', desc: '認知度・SoVの推移を記録し、AEOの改善アクションを実行→効果検証まで一気通貫で回せます。' },
]

export const FAQ: Faq[] = [
  { q: '対応しているAIは何ですか？', a: 'ChatGPT・Gemini・Claude・Perplexityの4つに対応しています。同じ質問群を各AIに反復で投げ、回答内容を横断で比較します。' },
  { q: '何を測定できますか？', a: '自社ブランドの言及率、Share of Voice（競合比較）、AIが根拠にしている引用元ドメイン、ブランドへの論調（ポジ/ネガ）、プロンプト別の言及頻度（◯回中△回）、認知度・SoVの時系列推移などを測定します。' },
  { q: '監視する質問は自分で作る必要がありますか？', a: 'いいえ。URLを入力すると、AIが自動でサービス名を判定し、監視するプロンプトを用意します。登録後に質問を追加・編集することも可能です。' },
  { q: '無料で試せますか？', a: '無料プランでは、監視プロンプト3件・週1回のスキャン・認知度の閲覧までお試しいただけます。スキャン無制限とSoV・引用元・改善アクションの閲覧、チーム招待はプロプラン（月額9,980円）の機能です。' },
  { q: 'チームで使えますか？', a: 'メンバー招待と組織スコープに対応しています（プロプラン）。データは組織ごとに分離され、権限の範囲内でのみアクセスできます。' },
  { q: '入力した情報は安全に扱われますか？', a: '各データは組織スコープで他組織から分離されます。ログインユーザーの権限の範囲内でのみアクセスできます。' },
]
