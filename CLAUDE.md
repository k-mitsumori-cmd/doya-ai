# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# ドヤAI プロジェクト — Claude Code ガイド

## !! 最重要: プロジェクト構造の注意 !!

```
09_Cursol/          ← ★ Gitルート & Vercelデプロイ対象（こちらを編集すること）
├── src/            ← ★ 本番で使われるソースコード
├── seo/            ← ★ SEOモジュール（@seo/* エイリアス）
├── prisma/
├── public/
├── doya-ai/        ← ⚠️ 別のNext.jsプロジェクト（編集しても本番に反映されない）
│   ├── src/        ← ⚠️ ルートのsrc/とほぼ同内容だがデプロイされない
│   └── seo/        ← シンボリックリンク → seo-symlink-backup/
└── ...
```

- **ソースコード編集は必ず `09_Cursol/src/` で行う**（`doya-ai/src/` ではない）
- Vercelは `09_Cursol/` をルートとしてビルド・デプロイする
- `doya-ai/` は過去のサブプロジェクト。変更しても本番に反映されない
- Git remote: `origin` のみ（`https://github.com/k-mitsumori-cmd/doya-ai.git`）。Vercel は GitHub Integration で `origin` の `main` ブランチに連動して自動デプロイ

### デプロイ手順
```bash
# コミット後、GitHubへプッシュすれば Vercel が自動デプロイ
git push origin main
# 進行確認
vercel ls doya-ai --scope=surisutas-projects
```

### 本番URL
- https://doya-ai.surisuta.jp
- Vercelプロジェクト: `surisutas-projects/doya-ai`

---

## 詳細リファレンス

タスクに取り掛かる前に、関連する reference/ ドキュメントを読むこと:

| ファイル | 内容 |
|---------|------|
| `reference/01-overview.md` | プロジェクト概要・ディレクトリ構成 |
| `reference/02-architecture.md` | アーキテクチャ・データフロー |
| `reference/03-api-reference.md` | 全APIエンドポイント一覧（150+） |
| `reference/04-database.md` | Prismaスキーマ・テーブル設計（正本は `prisma/schema.prisma`＝103モデル） |
| `reference/05-auth-payments.md` | 認証・管理者認証・Stripe決済・アクセス制御 |
| `reference/06-ui-patterns.md` | UIコンポーネント・デザインパターン |
| `reference/07-dev-guide.md` | 開発パターン・デプロイ・トラブルシューティング |
| `reference/08-environment.md` | 環境変数一覧・セットアップ手順 |
| `reference/09-bootstrap.md` | バナーテンプレート一括生成 |
| `reference/10-service-status.md` | サービスステータス一元管理 |
| `reference/services/*.md` | 各サービスの詳細仕様 |

---

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フレームワーク | Next.js 14 (App Router) + React 18 + TypeScript |
| DB/ORM | Prisma 5.7+ + PostgreSQL (Supabase) |
| 認証 | NextAuth.js (Google OAuth) |
| CSS | Tailwind CSS |
| アニメーション | Framer Motion |
| 状態管理 | Zustand |
| AI (テキスト) | Google Gemini API (gemini-2.0-flash) |
| AI (画像メイン) | OpenAI gpt-image-2 (ChatGPT Images 2.0) |
| AI (画像フォールバック) | nano-banana-pro-preview (Gemini 3 Pro Image Preview) |
| AI (テキスト fallback) | OpenAI (gpt-4o) |
| 文字起こし | AssemblyAI (universal-2) |
| 決済 | Stripe |
| ストレージ | Supabase Storage |
| 画像処理 | Sharp, Satori, resvg-js |
| アナリティクス | Google Tag Manager + HubSpot |
| 通知 | Slack Incoming Webhooks |
| メール送信 | Resend（`RESEND_API_KEY` / `RESEND_FROM_EMAIL`）。共通ユーティリティ `src/lib/email.ts:sendEmail()`。※SendGridは未使用 |
| デプロイ | Vercel |

### パスエイリアス（tsconfig.json）
- `@/*` → `./src/*`
- `@seo/*` → `./seo/*`

---

## サービス一覧と実装状況

### 課金方針: 統一プラン方式
1つのサブスク契約で全サービスのPROプランが利用可能。個別課金しない（無料 / プロ ¥9,980 の2プラン）。料金判定は `User.plan` 単一参照、料金定義は `src/lib/unified-plan.ts` / `UnifiedPricingPlans`。

### ⚠️ サービス定義の正本は `src/lib/services.ts`
`SERVICES` 配列が全サービスの**唯一の正本**（id / 名前 / 説明 / href / `status` / `order` / 料金）。トップページ `src/app/page.tsx` はこの配列からサービスカードと「公開中/開発中/調整中」区分を**派生**する（ベタ書きしない）。**下の表は概要把握用で実態とズレることがある**ため、各サービスの公開状態は必ず `services.ts` の `status` を見る（`active`=公開中 / `coming_soon`=開発中 / `maintenance`=調整中 / `beta`）。ルートが未実装の registry エントリは `page.tsx` の `HIDDEN_SERVICE_IDS` で除外。

各サービスの公開状態・一覧表はここに持たない（drift防止）。`services.ts` の `status` と `reference/10-service-status.md` を参照。サービス個別の詳細仕様は `reference/services/*.md`（21ファイル）。

### Stripe統合（stripe.ts）
```typescript
type ServiceId = 'seo' | 'banner' | 'interview' | 'copy' | 'lp' | 'voice' | 'movie' | 'adsim' | 'hr' | 'bundle'
// 各サービスに light / pro / enterprise の PlanId がある
```

---

## 重要な開発パターン

### API ルート定型
```typescript
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
```

### Next.js 15 互換パラメータ
```typescript
type Ctx = { params: Promise<{ id: string }> | { id: string } }
export async function GET(req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const id = p.id
}
```

### 画像生成 API（統一ディスパッチャ）
```typescript
// 統一ラッパー: src/lib/image-generator.ts
// メイン: gpt-image-2 / フォールバック: nano-banana-pro-preview
// 入力画像あり → nano-banana-pro-preview 直接使用
import { generateImageWithFallback } from '@/lib/image-generator'

const result = await generateImageWithFallback({
  prompt: '...',
  size: '1024x1024',  // gpt-image-2 は 16の倍数、3:1以内、最大3840px
  quality: 'medium',  // low / medium / high / auto
  inputImages: [],    // { mimeType, base64 }[]
})
// result: { base64, mimeType, model, fallbackUsed, primaryError? }
```

### テキスト生成（Gemini）
```typescript
// seo/lib/gemini.ts のラッパー
import { geminiGenerateText, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
// テキスト生成: GenerateContentRequest形式
await geminiGenerateText({ model: GEMINI_TEXT_MODEL_DEFAULT, parts: [{ text: prompt }] })
// JSON生成: { prompt } 形式（テキストのみ）
import { geminiGenerateJson } from '@seo/lib/gemini'
await geminiGenerateJson<T>({ prompt, model, ... })
```

### Prisma JSONフィールドの型キャスト
```typescript
// Prisma の Json 型フィールドは JsonValue を返すため、キャストが必要
content: result.content as any,
charCount: result.charCount as number,
project.analysis as Record<string, unknown>  // or as any
```

### DB テーブルプレフィックス
- interview系: `@@map("interview_xxx")`
- tenkai系: `@@map("tenkai_xxx")`
- Prismaスキーマ: `prisma/schema.prisma`（103モデル）
- Prisma再生成: `npx prisma generate`（モデル追加後に必須）

---

## ファイル構成ガイド

### サービス共通構造
```
src/app/{service}/           — フロントエンド（page.tsx, layout.tsx）
src/app/api/{service}/       — API エンドポイント
src/components/{service}/    — コンポーネント
src/components/sidebar/      — サイドバー共通コンポーネント（5テーマ対応）
src/lib/{service}/           — ユーティリティ・ビジネスロジック
```

### 主要サービス詳細

| サービス | ページ | API | コンポーネント | lib |
|---------|--------|-----|-------------|-----|
| banner | `src/app/banner/` | `src/app/api/banner/` | `DashboardSidebar.tsx` | `src/lib/banners.ts`, `banner-prompts-v2.ts` |
| seo | `src/app/seo/` | `src/app/api/seo/` | `SeoSidebar.tsx`, `src/components/seo/` | `seo/lib/` (pipeline.ts=175KB) |
| interview | `src/app/interview/` | `src/app/api/interview/` | `src/components/interview/` | `src/lib/interview/` |
| copy | `src/app/copy/` | `src/app/api/copy/` | `CopySidebar.tsx`, `src/components/copy/` | `src/lib/copy/` |
| lp | `src/app/lp/` | `src/app/api/lp/` | `LpSidebar.tsx` | `src/lib/lp/` |
| adsim | `src/app/adsim/` | `src/app/api/adsim/` | `AdSimSidebar.tsx` | `src/lib/adsim/` |
| tenkai | `src/app/tenkai/` | `src/app/api/tenkai/` | `src/components/tenkai/` | `src/lib/tenkai/` |
| voice | `src/app/voice/` | `src/app/api/voice/` | — | — |
| movie | `src/app/movie/` | `src/app/api/movie/` | — | — |
| hr | `src/app/hr/` | `src/app/api/hr/` | — | — |
| persona | `src/app/persona/` | `src/app/api/persona/` | `Persona*.tsx` | — |
| opening | `src/app/opening/` | `src/app/api/opening/` | `src/components/opening/` | `src/lib/opening/` |
| admin | `src/app/admin/` | `src/app/api/admin/` | `AdminSidebar.tsx` | `src/lib/admin-auth.ts` |

---

## 運用機能

### Cronジョブ (Vercel Cron)

| スケジュール | パス | 関数 | 説明 |
|------------|------|------|------|
| 毎日 0:00 UTC | `/api/cron/daily-summary` | `sendDailySummary()` | 日次レポート (当日の登録/生成/決済数) |
| 毎週月曜 0:00 UTC | `/api/cron/weekly-summary` | `sendWeeklySummary()` | 週次レポート (先週結果 + 累計) |
| 毎月1日 0:00 UTC | `/api/cron/monthly-summary` | `sendMonthlySummary()` | 月次レポート (先月結果 + 累計) |
| 毎日 23:00 UTC (JST 8:00) | `/api/cron/drip-report-morning` | `sendDripReport('morning')` | ドリップ(Resend)配信レポート・朝 (本日の配信予定 + 昨日の実績) |
| 毎日 11:00 UTC (JST 20:00) | `/api/cron/drip-report-evening` | `sendDripReport('evening')` | ドリップ(Resend)配信レポート・夜 (本日の配信実績 + 開封/クリック率) |

※ Vercel Cron はパスにクエリ文字列(`?slot=`)を付けると定時発火しない。slotごとに独立したプレーンパスのルートを用意すること。汎用の `/api/cron/drip-report?slot=` は手動テスト用に残置。

- 設定: `vercel.json` の `crons` 配列
- 認証: `Authorization: Bearer ${CRON_SECRET}` ヘッダーで検証
- 通知先: Slack Incoming Webhook (SystemSetting `key: 'slack_webhook'`)
- 実装: `src/lib/notifications.ts`

### Slack通知

- **イベント通知**: ログイン/サインアップ/決済完了/解約 → `sendEventNotification()`
- **定期レポート**: 日次/週次/月次 → 上記Cronジョブから自動送信
- **ドリップ配信レポート**: 朝/夜の2回 → `sendDripReport('morning'|'evening')`。Resend配信の予定件数/実配信数/開封率/クリック率を通知
- Webhook URL: DB `SystemSetting` テーブル (`key: 'slack_webhook'`) で管理
  - ただしドリップ配信レポートは専用チャンネル用に環境変数 `SLACK_DRIP_WEBHOOK_URL` を優先参照（未設定時は `slack_webhook` にフォールバック）
- `postToSlack()` はレスポンスチェック付き (非200でthrow)

### Google Tag Manager / HubSpot

- GTM ID: `GTM-5B2PRCL7` (環境変数: `NEXT_PUBLIC_GTM_ID`)
- GTMコンポーネント: `src/components/GoogleTagManager.tsx` (`'use client'`, `afterInteractive`)
- HubSpot: tracking code ID `48309253` — GTMカスタムHTMLタグ経由で配信
- HubSpotポップアップ (CTA): 全ページ対象、5秒後トリガー

---

## 課金・トライアルの仕組み（billing — 複数ファイル横断の中核）

料金判定の唯一の真実は `User.plan`。Stripe の状態はここに集約される。billing を触る前に全体像を把握すること。

- **プラン付与フロー**: Checkout → `src/app/api/stripe/webhook/route.ts`（`checkout.session.completed` / `customer.subscription.*`）の `updateUserSubscription()` が `User.plan` と全 `UserServiceSubscription` を同期。決済直後の即時反映は `src/app/api/stripe/sync/route.ts`（成功URLの `session_id` から同期）。**どちらも subscription status ではなく planId で判定**するため `trialing` でも即 PRO。
- **統一プラン**: 実売は無料 / プロ ¥9,980 の2つ。プロの planId は `UNIFIED_PRO_PLAN_ID = 'banner-pro'`（`src/lib/unified-plan.ts`、`isPaidPlan()` もここが単一ソース）。checkout は `src/app/api/stripe/checkout/route.ts` → `createCheckoutSession()`（`src/lib/stripe.ts`）。
- **ダウングレード**: subscription が `canceled` / `unpaid` になったら `User.plan`→FREE（全サービスも FREE）。`past_due` は猶予として PRO 維持。
- **初月無料トライアル（30日 = `UNIFIED_TRIAL_DAYS`）**:
  - 付与: checkout route が **月額かつ非enterprise/非bundle** のときだけ `trial_period_days` を付与。支払い方法未登録で終了したら自動解約（`trial_settings.missing_payment_method:'cancel'`）。
  - 対象は**新規顧客のみ**（trial cycling 防止）。判定 `src/lib/trial.ts:isTrialEligible({email, stripeCustomerId})` は **メール横断で全 Stripe 顧客の実サブスク履歴**を照会する（checkout は `customer_email` で都度新規顧客を作るため、また `stripeCustomerId=null` でも取りこぼさないため）。`incomplete`系は履歴に数えない。障害時は fail-closed（付与しない）。
  - 表示の出し分け: **「初月無料」を直書きせず必ず `src/components/TrialCallout.tsx` 経由**（`TrialBadge` / `TrialNote` / `TrialCallout` / `TrialInlineSuffix` と `useTrialEligible()` フック）。`/api/stripe/trial-eligibility` を見て**対象外なら何も描画しない**（既定非表示・確定時のみ表示・fail-closed）。CTA文言も `trialEligible ? … : …` で出し分ける。

## 組織スコープ型サービスの共通パターン（sfa / shodan / aio、hr も類似）

新しめのB2Bサービスは「組織（ワークスペース）＋メンバー招待＋ロール」の共通アーキテクチャ。各 `src/lib/{svc}/access.ts` が全APIの入口:

- `get{Svc}Context(orgSlug?)` がログインユーザーの **ACTIVE メンバーシップを userId でスコープ**して解決するため、他組織は決して解決されない（IDOR安全）。orgSlug は クエリ `?org=` 優先、無ければヘッダ `x-{svc}-org`（日本語slugは `encodeURIComponent` で送りサーバでdecode）。
- ロール階層 `owner > admin > manager > member`（`ROLE_HIERARCHY` / `hasMinRole()`）。破壊的操作（メンバー削除・招待・組織設定変更）は admin+ を要求。自己降格・同格以上への操作は禁止。
- `[id]` 系APIは必ず `findFirst({ where: { id, organizationId } })` の**二重条件**（idだけの他組織アクセス不可）。
- Prisma モデルは `{svc}_*`（例 `aio_organization` / `aio_member` / `aio_scan`）。招待は unique token。
- ⚠ `adbanner` は組織スコープではなく **userId / guestId(Cookie) スコープ**（別パターン）。

---

## コマンド

| 目的 | コマンド |
|------|---------|
| 開発サーバ | `npm run dev` |
| 本番ビルド | `npm run build`（= `prisma generate` → `db-push-if-db-url.mjs` → `next build`） |
| ビルド確認のみ | `npx next build` |
| 型チェック | `npx tsc --noEmit` |
| Lint | `npm run lint` |
| Prisma生成 | `npx prisma generate`（モデル追加後に必須） |
| DBスキーマ反映 | `npm run db:push`（本番は `POSTGRES_PRISMA_URL` で手動。Vercelビルドは設計上スキップ） |
| 検証/単発スクリプト | `npx tsx scripts/<name>.ts`（env は `scripts/_env.ts` の `loadEnv()` 経由。別env指定は `AIO_ENV_FILE=...` ） |

**自動テストは無い**（jest/vitest等なし・`*.test`/`*.spec` 0件）。変更の検証は `npx next build` ＋ `npx tsc --noEmit`、および `scripts/` 配下の手動検証スクリプト（`npx tsx`）で行う。

## TypeScript の注意

- `typescript.ignoreBuildErrors: true` / `eslint.ignoreDuringBuilds: true` — **型エラーがあってもビルド・本番デプロイは通る**。
- ⚠️ そのため `tsc` エラーには「UI型注釈だけの無害なもの」と「**実行時に必ず壊れる実バグ**」が混在する。例: Prisma に存在しない field/relation を `select`/`where` に使う（`promaneTimeEntry` の `startTime`/`member` 等）→ 実行時に throw。型エラーは無害と決めつけず、Prismaスキーマと突き合わせて triage すること。

---

## ブランドUI規約

- **カラー**: ブランドカラーは `#0066ff`（青）。ドヤマーケAIリブランド(2026-06)で青系パレット（アクセント: `#ff1e72` / `#ffd400` / `#00e0ff` / `#009bff`）に統一。旧 `#7f19e6`（紫）は一部の既存サービス内UIに残存（順次置換）
- **アイコン**: Material Symbols Outlined／**フォント**: Inter + Noto Sans JP
- **日本語UI**: ユーザー向けテキストは日本語で記述
- **画像生成の禁止事項**: Nano Banana 無印（Pro なし）/ Imagen / Gemini 2.x 画像系は使用禁止（必ず上記の統一ディスパッチャ経由）

※ エージェントチーム運用・コミット規約・検証方針などプロジェクト非依存の方針は `~/.claude/CLAUDE.md`（グローバル）に集約。
