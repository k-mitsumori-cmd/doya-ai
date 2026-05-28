# ドヤマーケ フロントページ制作 - Codex用プロンプト

## タスク

`src/app/page.tsx` を書き換えて、ドヤマーケ（AIマーケティングプラットフォーム）のフロントページを制作してください。

## ブランド情報

- **サービス名:** ドヤマーケ（by ドヤAI）
- **ブランドカラー:** #7f19e6（紫）
- **コンセプト:** 1つの共通プランで全AIツールが使い放題
- **ターゲット:** 日本の中小企業マーケティング担当者
- **本番URL:** https://doya-ai.surisuta.jp
- **言語:** 日本語

## 技術スタック

- Next.js 14 App Router + React 18 + TypeScript
- Tailwind CSS
- Framer Motion（`framer-motion`パッケージ、`import { motion } from 'framer-motion'`）
- lucide-react（アイコン）
- next-auth（`useSession`でログイン判定）
- ページは `'use client'` コンポーネント

## 掲載する9つのアクティブサービス

| サービス名 | パス | 説明 |
|---|---|---|
| ドヤ記事作成 | /seo | SEO最適化された長文記事を30秒で自動生成。最大20,000字 |
| ドヤバナーAI | /banner | プロ品質のバナーをA/B/C 3案同時生成 |
| ドヤコピーAI | /copy | 広告コピー・キャッチコピーを大量生成 |
| ドヤインタビュー | /interview | 音声からプロ品質のインタビュー記事を自動生成 |
| ドヤワイヤーフレームAI | /lp | LP構成・ワイヤーフレームを1分で設計 |
| ドヤペルソナAI | /persona | URLからターゲットペルソナを自動分析・生成 |
| ドヤムービーAI | /movie | 動画広告を10分で企画・制作 |
| ドヤボイスAI | /voice | プロ品質の音声コンテンツを数秒で生成 |
| ドヤHR | /hr | AI搭載タレントマネジメント。評価・1on1を効率化 |

## 料金体系

- **無料プラン:** ¥0（永久無料、全ツールの基本機能、サービスごとに回数制限、登録不要）
- **プロプラン:** ¥9,980/月（税込）。全9サービスがPROに。おすすめプラン。
- **エンタープライズ:** 要相談（チーム・法人向け、全サービス無制限、専用サポート、カスタムAPI連携）
- **統一プラン方式:** プロプランひとつに契約するだけで全サービスのPRO機能が解放される。個別課金なし。新サービスも追加料金なしで自動解放。

## デザイン要件（taste-skill準拠）

### Anti-Slopルール（AIっぽいデザインの排除）
- 紫グラデーションを全面に使わない（アクセントとしてのみ使用）
- Sparkles、Crown等のAI装飾アイコンを使わない
- グラデーションテキストは使わない
- 3カラム均等カードの繰り返しは避ける
- ネオングロー、アウターグロー禁止
- em-dash（—）は一切使用禁止。ハイフン（-）のみ使用可
- 「AIで10倍速」等のAIスラング的な訴求を避け、実用的なメッセージにする
- セクション番号（01/02/03）のeyebrowは使わない

### レイアウト
- **Hero:** 左寄せ非対称レイアウト（Asymmetric Split Hero）推奨。中央揃えは避ける
- **サービス一覧:** ベントグリッド（Bento Grid）レイアウト。カードサイズに変化をつける（全部同じサイズにしない）
- **ベントグリッドの背景多様性:** 全カード白一色はNG。2-3セルに視覚的変化（色付き背景、ダーク背景など）をつける
- **セクションレイアウト重複禁止:** 各セクションは異なるレイアウト構成にする
- **Pricing:** 非対称（プロプランを大きく、視覚的に強調）

### タイポグラフィ
- 見出し: `text-4xl md:text-6xl tracking-tighter leading-none`
- 本文: `text-base text-zinc-500 leading-relaxed max-w-[65ch]`
- セリフフォントは使わない

### カラー
- ライトモード（bg-stone-50 / bg-white ベース）
- アクセントカラー: #7f19e6 のみ。1色に統一
- テキスト: zinc-900（見出し）、zinc-500（本文）、zinc-400（補助）
- テーマロック: ページ全体で一貫したライトモード。セクションごとにダーク/ライトを切り替えない
  - 例外: CTA帯のみ bg-zinc-900 は許容（同テーマ内のtint変化として）

### インタラクション
- ホバー: `hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300`
- クリック: `active:scale-[0.98]`
- ボタン: pill型（rounded-full）
- Framer MotionのwhileInViewで控えめなスクロールアニメーション
- ease: `[0.16, 1, 0.3, 1]` を統一使用

### 角丸
- カード: rounded-2xl
- ボタン: rounded-full
- Shape Consistency Lock: この2種類のみ使用

### Hero制約（taste-skill Section 4.7準拠）
- Hero内テキスト要素は最大4つ（eyebrow/H1/subtext/CTAs）
- H1は最大2行
- subtextは最大20ワード、最大4行
- CTAはスクロールせずに見える位置
- pt-24以下（Hero上部の余白）
- min-h-[100dvh]（h-screen禁止）

## 参考サイト

- https://linear.app/ - ミニマルで洗練されたSaaS
- https://stripe.com/jp - クリーンなレイアウト、ホワイトスペース
- https://sales-marker.jp/ - 日本のB2B SaaS、統一プラットフォーム訴求

## ページ構成（推奨）

1. **Header** - テキストロゴ「ドヤマーケ」+ ナビ + CTAボタン。高さ64px、1行
2. **Hero** - 非対称Split。左: H1 + subtext + CTAs。右: スタッツまたはビジュアル
3. **Bento Grid** - 9サービスをベントグリッドで表示。1つのヒーローカード（大）+ 残り（小）
4. **統一プラン訴求** - 「ひとつのプランですべてが手に入る」。前セクションと異なるレイアウト
5. **Pricing** - 非対称3プラン。プロプランを視覚的に強調
6. **CTA** - 最終アクション誘導
7. **Footer** - 利用規約/プライバシー/特商法/お問い合わせ

## コード構造

```tsx
'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import { ArrowRight, Check, ArrowUpRight } from 'lucide-react'

// サービスデータ定義

export default function DoyaMarkePage() {
  const { data: session } = useSession()

  return (
    <div className="min-h-[100dvh] bg-stone-50 text-zinc-900 antialiased">
      {/* Header */}
      {/* Hero */}
      {/* Bento Grid */}
      {/* One Plan */}
      {/* Pricing */}
      {/* CTA */}
      {/* Footer */}
    </div>
  )
}
```

## CTAリンク先

- ログイン済み: `/seo`（ダッシュボードへ）
- 未ログイン: `/auth/signin`
- 条件: `const { data: session } = useSession()` で判定
- プロプラン申込: `/auth/signin`
- エンタープライズ: `mailto:support@doya-ai.com`
- フッターリンク: `/terms`, `/privacy`, `/tokushoho`

## 重要な制約

- ファイルは `src/app/page.tsx` のみ編集
- 新しいコンポーネントファイルは作成しない（1ファイル完結）
- 既存の `@/lib/services` からのimportは不要（サービスデータはpage.tsx内に定義）
- `@/lib/pricing` からのimportも不要
- TypeScriptの型定義は最小限で可
- コメントは最小限
