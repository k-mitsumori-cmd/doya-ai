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
| `reference/04-database.md` | Prismaスキーマ・テーブル設計（38モデル） |
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

### 本番稼働中 (active)
| パス | サービス名 | ページ数 | API数 | DBモデル |
|------|-----------|---------|-------|---------|
| `/banner` | ドヤバナーAI | 16 | 17 | 1 |
| `/seo` | ドヤライティングAI | 45 | 54 | 12 |
| `/interview` | ドヤインタビュー | 15 | 21 | 7 |
| `/copy` | ドヤコピーAI | 12 | 11 | 3 |
| `/lp` | ドヤLP AI | 9 | 9 | 2 |
| `/persona` | ドヤペルソナAI | 5 | 3 | 汎用 |
| `/voice` | ドヤボイスAI | 10 | 12 | 2 |
| `/movie` | ドヤ動画AI | 11 | 15 | 3 |
| `/hr` | ドヤHR | 14 | 30 | 10 |
| `/admin` | 管理画面 | 15 | 16+ | 3 |

### 公開前 (coming_soon) — 実装完了済み
| パス | サービス名 | ページ数 | API数 | DBモデル |
|------|-----------|---------|-------|---------|
| `/adsim` | ドヤ広告シミュレーションAI | 6 | 9 | 1 |
| `/tenkai` | ドヤ展開AI | 10 | 23 | 6 |

### メンテナンス/その他
| パス | サービス名 | 状態 |
|------|-----------|------|
| `/kantan` | カンタンマーケAI | → `/seo` にリダイレクト |
| `/opening` | ドヤオープニングAI | maintenance |
| `/logo` | ドヤロゴ | maintenance（暫定無料） |
| `/shindan` | ドヤWeb診断AI | 仕様定義のみ |
| `/slide` `/slashslide` | スライド系 | 基本実装のみ |
| `/seo/swipe` | ドヤSwipe | SEO内サブ機能 |

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

- 設定: `vercel.json` の `crons` 配列
- 認証: `Authorization: Bearer ${CRON_SECRET}` ヘッダーで検証
- 通知先: Slack Incoming Webhook (SystemSetting `key: 'slack_webhook'`)
- 実装: `src/lib/notifications.ts`

### Slack通知

- **イベント通知**: ログイン/サインアップ/決済完了/解約 → `sendEventNotification()`
- **定期レポート**: 日次/週次/月次 → 上記Cronジョブから自動送信
- Webhook URL: DB `SystemSetting` テーブル (`key: 'slack_webhook'`) で管理
- `postToSlack()` はレスポンスチェック付き (非200でthrow)

### Google Tag Manager / HubSpot

- GTM ID: `GTM-5B2PRCL7` (環境変数: `NEXT_PUBLIC_GTM_ID`)
- GTMコンポーネント: `src/components/GoogleTagManager.tsx` (`'use client'`, `afterInteractive`)
- HubSpot: tracking code ID `48309253` — GTMカスタムHTMLタグ経由で配信
- HubSpotポップアップ (CTA): 全ページ対象、5秒後トリガー

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

### 過去に発生した型エラーパターン（修正済み）
| パターン | 原因 | 対処法 |
|---------|------|--------|
| `geminiGenerateText(prompt)` | 引数はstring不可 | `geminiGenerateText({ model, parts: [{ text: prompt }] })` |
| `geminiGenerateJson({ parts: ... })` | 引数形式が異なる | `geminiGenerateJson<T>({ prompt })` |
| `new NextResponse(buffer, ...)` | Buffer直接渡し不可 | `new NextResponse(new Uint8Array(buffer), ...)` |
| Stripe `apiVersion` 不一致 | 型定義と不一致 | `'2023-10-16'` に統一 |
| Prisma JSON → 具体型 | JsonValue型の不一致 | `as any` / `as number` でキャスト |

---

## エージェントチーム運用方針

### 動的チーム構成
チーム構成はタスクごとに最適な編成を自動で判断し構成する。固定テンプレートは使わない。

**リード (Lead) の責務:**
1. ユーザーの依頼内容を分析し、必要な役割・人数を判断する
2. タスクの性質に応じて最適なチームメンバーを動的にアサインする
3. 各メンバーの担当範囲を明確にし、ファイル競合を防ぐ
4. 進捗を統合し、最終的な品質を保証する

**メンバー数の目安:**
- 2〜4人程度（タスクの複雑さに応じて増減）
- 小さなタスクはチームを組まず単独で対応

### チームメイト共通ルール

1. **ファイル競合を避ける**: 他のチームメイトが編集中のファイルを同時に編集しない
2. **変更前に読む**: ファイルを編集する前に必ず最新の状態を読み取る
3. **小さな単位で完了報告**: 1つの機能・修正ごとに完了報告する
4. **ビルド確認**: コード変更後は `npx next build` でビルドが通ることを確認
5. **日本語UI**: ユーザー向けテキストは日本語で記述
6. **カラーテーマ**: ブランドカラーは `#0066ff` (青)。ドヤマーケAIリブランド(2026-06)でトップページ等は青系パレット（アクセント: `#ff1e72` / `#ffd400` / `#00e0ff` / `#009bff`）に統一。旧 `#7f19e6` (紫) は一部の既存サービス内UIに残存（順次置換）
7. **アイコン**: Material Symbols Outlined を使用
8. **APIパターン遵守**: `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`, `maxDuration = 300`
9. **Next.js 15互換**: params は `'then' in ctx.params ? await ctx.params : ctx.params` で取得
10. **編集対象の確認**: 必ず `09_Cursol/src/` 配下を編集すること（`doya-ai/src/` は不可）
11. **画像生成は統一ディスパッチャ経由**: 画像生成は必ず `src/lib/image-generator.ts:generateImageWithFallback()` 経由で行う。直接 OpenAI / Gemini API を叩かない。メインは `gpt-image-2`、フォールバックは `nano-banana-pro-preview`。Nano Banana 無印（Pro なし）/ Imagen / Gemini 2.x 画像系は使用禁止
