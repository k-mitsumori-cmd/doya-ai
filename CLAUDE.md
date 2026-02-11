# ドヤAI プロジェクト — Claude Code ガイド

## 技術スタック
- Next.js 14 (App Router) + React 18 + TypeScript
- Prisma ORM + PostgreSQL (Supabase)
- NextAuth.js (Google OAuth)
- Tailwind CSS, Framer Motion, Zustand
- AI: Google Gemini (primary) + OpenAI (fallback)
- Payment: Stripe

## サービス一覧
| パス | サービス名 | 説明 |
|------|-----------|------|
| `/seo` | ドヤ記事作成 | SEO長文記事生成 |
| `/banner` | ドヤバナーAI | バナー画像生成 |
| `/logo` | ドヤロゴ | ロゴ生成 |
| `/interview` | ドヤインタビュー | インタビュー記事AI生成 (Phase 1-3 完了) |
| `/persona` | ドヤペルソナAI | URL→ペルソナ+クリエイティブ生成 |

## 重要な開発パターン

### API ルート
```typescript
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300
```

### Next.js 15 互換パラメータ
```typescript
const p = 'then' in ctx.params ? await ctx.params : ctx.params
```

### 認証
```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
const session = await getServerSession(authOptions)
// session.user に plan/id/firstLoginAt
```

### Gemini API 直接呼出
```typescript
const model = process.env.DOYA_BANNER_IMAGE_MODEL || 'gemini-3-pro-image-preview'
const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
```

### DB テーブルプレフィックス
- interview系: `@@map("interview_xxx")`
- Prismaスキーマ: `prisma/schema.prisma`

### ビルド注意
- `typescript.ignoreBuildErrors: true` — 既存の型エラーあり
- ビルド確認: `npx next build`

## ファイル構成ガイド

### Interview サービス
- `src/app/interview/` — フロントエンド (page.tsx, layout.tsx)
- `src/app/interview/projects/` — プロジェクト管理
- `src/app/api/interview/` — API エンドポイント
- `src/components/interview/` — コンポーネント
- `src/lib/interview/` — ユーティリティ (access, storage)

### Persona サービス
- `src/app/persona/` — フロントエンド
- `src/app/api/persona/` — API (generate, portrait, banner)
- `src/components/Persona*.tsx` — コンポーネント

---

## エージェントチーム運用方針

### 動的チーム構成
チーム構成はタスクごとに最適な編成を自動で判断し構成する。固定テンプレートは使わない。

**リード (Lead) の責務:**
1. ユーザーの依頼内容を分析し、必要な役割・人数を判断する
2. タスクの性質に応じて最適なチームメンバーを動的にアサインする
3. 各メンバーの担当範囲を明確にし、ファイル競合を防ぐ
4. 進捗を統合し、最終的な品質を保証する

**チーム構成の判断基準:**
- **新機能開発**: UI担当 + API/ロジック担当 + テスト担当 など
- **バグ修正**: 原因調査担当を問題領域ごとに分ける
- **UI改善**: デザイン担当 + 実装担当
- **リファクタリング**: 対象領域ごとに担当を分ける
- **小規模タスク**: チーム不要、リード単独で対応
- 上記は例示であり、実際のタスクに合わせて柔軟に構成すること

**メンバー数の目安:**
- 2〜4人程度（タスクの複雑さに応じて増減）
- 小さなタスクはチームを組まず単独で対応

### チームメイト共通ルール

チームメイトがスポーンされた時、以下のルールに従うこと:

1. **ファイル競合を避ける**: 他のチームメイトが編集中のファイルを同時に編集しない
2. **変更前に読む**: ファイルを編集する前に必ず最新の状態を読み取る
3. **小さな単位で完了報告**: 1つの機能・修正ごとに完了報告する
4. **ビルド確認**: コード変更後は `npx next build` でビルドが通ることを確認
5. **日本語UI**: ユーザー向けテキストは日本語で記述
6. **カラーテーマ**: ブランドカラーは `#7f19e6` (紫)
7. **アイコン**: Material Symbols Outlined を使用
8. **APIパターン遵守**: `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`, `maxDuration = 300`
9. **Next.js 15互換**: params は `'then' in ctx.params ? await ctx.params : ctx.params` で取得