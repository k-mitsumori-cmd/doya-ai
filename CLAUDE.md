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
- Git remote: `origin` = `09_Cursol.git`, `vercel` = `doya-ai.git`（デプロイ用）

### デプロイ手順
```bash
# コミット後、Vercelへプッシュ（subtree不要、ルート直接プッシュ）
git push vercel HEAD:main
```

### 本番URL
- https://doya-ai.surisuta.jp

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
| AI (画像) | Gemini 3 Pro Image Preview |
| AI (fallback) | OpenAI (gpt-4o) |
| 文字起こし | AssemblyAI (universal-2) |
| 決済 | Stripe |
| ストレージ | Supabase Storage |
| 画像処理 | Sharp, Satori, resvg-js |
| アナリティクス | Google Tag Manager + HubSpot |
| 通知 | Slack Incoming Webhooks |
| デプロイ | Vercel |

### パスエイリアス（tsconfig.json）
- `@/*` → `./src/*`
- `@seo/*` → `./seo/*`

---

## サービス一覧と実装状況

### 本番稼働中 (active)
| パス | サービス名 | ページ数 | API数 | Stripe | PRO月額 |
|------|-----------|---------|-------|--------|---------|
| `/banner` | ドヤバナーAI | 16 | 17 | 完全統合 | ¥9,980 |
| `/seo` | ドヤライティングAI | 45 | 35+ | 完全統合 | ¥9,980 |
| `/interview` | ドヤインタビュー | 15 | 15 | レガシー | ¥9,980 |
| `/persona` | ドヤペルソナAI | 5 | 3 | 未設定 | — |
| `/admin` | 管理画面 | 15 | 16+ | — | — |

### メンテナンス/開発予定
| パス | サービス名 | 状態 |
|------|-----------|------|
| `/tenkai` | ドヤ展開AI | coming_soon（10頁/23API実装済み） |
| `/opening` | ドヤオープニングAI | maintenance |
| `/kantan` | カンタンマーケAI | → `/seo` にリダイレクト |
| `/logo` | ドヤロゴ | maintenance（暫定無料） |
| `/shindan` | ドヤWeb診断AI | 実装ゼロ（定義のみ） |
| `/slide` `/slashslide` | スライド系 | 基本実装のみ |
| `/seo/swipe` | ドヤSwipe | SEO内サブ機能 |

### Stripe課金統合（stripe.ts PlanId）
```
seo-pro / seo-enterprise        → SEO・バナー・インタビュー・展開AI共通価格
banner-basic / banner-pro / banner-enterprise
interview-pro / interview-enterprise
bundle                          → セットプラン
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

### Gemini API 呼び出し（2パターン）
```typescript
// パターン1: 直接fetch（バナー画像生成等）
const model = process.env.DOYA_BANNER_IMAGE_MODEL || 'gemini-3-pro-image-preview'
const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

// パターン2: seo/lib/gemini.ts のラッパー
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
- Prismaスキーマ: `prisma/schema.prisma`（38モデル）
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
| tenkai | `src/app/tenkai/` | `src/app/api/tenkai/` | `src/components/tenkai/` | `src/lib/tenkai/` |
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

## ビルド・TypeScript

- `typescript.ignoreBuildErrors: true` — 型エラーがあってもビルドは通る
- `eslint.ignoreDuringBuilds: true`
- ビルド確認: `npx next build`
- 型チェック: `npx tsc --noEmit`
- 現在47件の型エラーが残存（全てUI型アノテーション。ランタイムには影響しない）

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
6. **カラーテーマ**: ブランドカラーは `#7f19e6` (紫)
7. **アイコン**: Material Symbols Outlined を使用
8. **APIパターン遵守**: `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`, `maxDuration = 300`
9. **Next.js 15互換**: params は `'then' in ctx.params ? await ctx.params : ctx.params` で取得
10. **編集対象の確認**: 必ず `09_Cursol/src/` 配下を編集すること（`doya-ai/src/` は不可）
