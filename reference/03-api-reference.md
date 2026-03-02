# 03. API リファレンス (全エンドポイント一覧)

## 共通仕様

### 全APIルートの必須ヘッダ
```typescript
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300  // 5分タイムアウト
```

### 認証チェックパターン
```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const session = await getServerSession(authOptions)
if (!session?.user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
const userId = (session.user as any).id
const plan = (session.user as any).plan || 'FREE'
```

### Next.js 15 互換パラメータ取得
```typescript
const p = 'then' in ctx.params ? await ctx.params : ctx.params
const id = p.id
```

### レスポンス形式
- 通常: `{ success: boolean, data?: any, error?: string }`
- SSE: `Content-Type: text/event-stream`
- 画像: `Content-Type: image/png` (base64またはバイナリ)

---

## 認証 API

| メソッド | パス | 説明 |
|---------|------|------|
| * | `/api/auth/[...nextauth]` | NextAuth.js (Google OAuth) |

## 管理画面 API (20+エンドポイント)

### 認証
| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/admin/auth/login` | 管理者ログイン (bcrypt + Turnstile CAPTCHA + レート制限) |
| POST | `/api/admin/auth/logout` | 管理者ログアウト |
| GET | `/api/admin/auth/session` | 管理者セッション確認 |

### ユーザー・統計
| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/admin/stats` | KPI統計 (ユーザー数, 生成数, 収益, サービス別統計) |
| GET/PATCH/DELETE | `/api/admin/users` | ユーザー管理 (プラン変更, 使用回数管理, 削除) |
| POST | `/api/admin/users/export` | ユーザーデータ CSV/JSON エクスポート |

### 管理者ユーザー
| メソッド | パス | 説明 |
|---------|------|------|
| GET/POST | `/api/admin/admin-users` | 管理者ユーザー CRUD |
| PATCH/DELETE | `/api/admin/admin-users/[id]` | 管理者ユーザー個別管理 |

### テンプレート・画像
| メソッド | パス | 説明 |
|---------|------|------|
| GET/PUT | `/api/admin/templates` | テンプレート管理 |
| POST | `/api/admin/templates/generate-batch` | テンプレート一括生成 |
| GET/POST | `/api/admin/doyamana/categories` | ドヤマナカテゴリ CRUD |
| GET/PATCH/DELETE | `/api/admin/doyamana/categories/[id]` | カテゴリ個別操作 |
| GET/POST | `/api/admin/doyamana/images` | ドヤマナ画像 CRUD |
| GET/PATCH/DELETE | `/api/admin/doyamana/images/[id]` | 画像個別操作 |

### Stripe・マイグレーション
| メソッド | パス | 説明 |
|---------|------|------|
| GET/POST | `/api/admin/stripe` | Stripe同期・サブスクリプション管理 |
| POST | `/api/admin/migrate` | データマイグレーション |
| POST | `/api/admin/migrate-banner-prompts` | バナープロンプトマイグレーション |

### 管理画面ページ一覧 (`/admin/*`)
| パス | 説明 |
|------|------|
| `/admin` | ダッシュボード (KPI, サービス別統計, 最近のアクティビティ) |
| `/admin/login` | 管理者ログイン (Turnstile CAPTCHA対応) |
| `/admin/users` | ユーザー管理 (プラン編集, Stripe情報, 使用回数リセット) |
| `/admin/analytics` | 分析 (生成数推移, サービス別統計) |
| `/admin/billing` | 請求 (月間売上, MRR, ユーザー内訳) |
| `/admin/settings` | 設定 (管理者アカウント管理) |
| `/admin/templates` | テンプレート管理 |
| `/admin/admins` | 管理者ユーザー管理 |
| `/admin/admin-users` | 管理者ユーザー一覧 (CRUD) |
| `/admin/doyamana-categories` | ドヤマナカテゴリ管理 |
| `/admin/doyamana-categories/[id]` | カテゴリ詳細編集 |
| `/admin/doyamana-images` | ドヤマナ画像一覧 |
| `/admin/doyamana-images/new` | ドヤマナ画像新規作成 |
| `/admin/doyamana-images/[id]/edit` | ドヤマナ画像編集 |

## 決済 API (Stripe) (10エンドポイント)

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/stripe/checkout` | Checkout Session 作成 (subscription / payment) |
| POST | `/api/stripe/portal` | カスタマーポータルセッション |
| GET | `/api/stripe/portal/redirect` | ポータルリダイレクト |
| POST | `/api/stripe/webhook` | Webhook 受信 (署名検証 → UserServiceSubscription更新) |
| POST | `/api/stripe/subscription/cancel` | サブスクリプション解約 |
| POST | `/api/stripe/subscription/resume` | 解約取消 |
| GET | `/api/stripe/subscription/status` | サブスクリプション状態確認 |
| GET | `/api/stripe/sync` | Stripe同期 |
| POST | `/api/stripe/sync/latest` | 最新情報手動同期 |

### Stripe PlanId → ServiceId マッピング
```typescript
type PlanId = 'seo-pro' | 'seo-enterprise' | 'banner-basic' | 'banner-pro' |
              'banner-enterprise' | 'bundle'
type ServiceId = 'seo' | 'banner' | 'bundle'
```

## バナー API (28+)

→ 詳細: [services/banner.md](./services/banner.md)

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/banner/generate` | バナー生成 (Gemini 3 Pro Image) |
| POST | `/api/banner/from-url` | URLからバナー自動生成 |
| POST | `/api/banner/refine` | リファイン |
| POST | `/api/banner/chat` | チャット・リファイン |
| POST | `/api/banner/copy` | コピー提案 |
| GET | `/api/banner/gallery` | ギャラリー |
| GET | `/api/banner/history` | 生成履歴 |
| GET | `/api/banner/history/image` | 履歴画像取得 |
| GET | `/api/banner/history/thumb` | 履歴サムネイル |
| GET | `/api/banner/image` | 画像取得 |
| GET | `/api/banner/thumb` | サムネイル |
| GET | `/api/banner/models` | 利用可能モデル一覧 |
| GET | `/api/banner/stats` | 統計 |
| * | `/api/banner/test/*` | テスト用 (debug, generate, health, image, templates, bootstrap 等 12+) |

## SEO API (60+)

→ 詳細: [services/seo.md](./services/seo.md)

### 記事 CRUD
| メソッド | パス | 説明 |
|---------|------|------|
| GET/POST | `/api/seo/articles` | 記事一覧・作成 |
| GET/PUT/DELETE | `/api/seo/articles/[id]` | 記事詳細・更新・削除 |

### 記事生成・編集
| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/seo/articles/[id]/outline` | アウトライン生成 |
| POST | `/api/seo/articles/[id]/content` | セクション生成 (SSE) |
| POST | `/api/seo/articles/[id]/audit` | 記事監査 |
| POST | `/api/seo/articles/[id]/autofix` | 自動修正 |
| POST | `/api/seo/articles/[id]/chat-edit` | チャット編集 |
| POST | `/api/seo/articles/[id]/vibe-edit` | バイブ編集 |
| POST | `/api/seo/articles/[id]/check` | チェック |
| POST | `/api/seo/articles/[id]/competitor-analysis` | 競合分析 |
| POST | `/api/seo/articles/[id]/research` | リサーチ |
| GET | `/api/seo/articles/[id]/candidates` | 候補一覧 |
| POST | `/api/seo/articles/[id]/link-check` | リンクチェック |
| GET/PUT | `/api/seo/articles/[id]/memo` | メモ |
| GET/PUT | `/api/seo/articles/[id]/meta` | メタ情報 |
| POST | `/api/seo/articles/[id]/generate-note` | ノート生成 |

### 画像
| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/seo/articles/[id]/images/banner` | サムネイル/バナー生成 |
| POST | `/api/seo/articles/[id]/images/batch` | 画像一括生成 |
| POST | `/api/seo/articles/[id]/images/diagram` | 図解生成 |
| POST | `/api/seo/articles/[id]/images/ensure` | 画像確保 |
| POST | `/api/seo/articles/[id]/images/suggest` | 画像提案 |
| GET/DELETE | `/api/seo/images/[id]` | 画像取得・削除 |
| POST | `/api/seo/images/[id]/regenerate` | 画像再生成 |

### エクスポート
| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/seo/articles/[id]/export/html` | HTML出力 |
| GET | `/api/seo/articles/[id]/export/json` | JSON出力 |
| GET | `/api/seo/articles/[id]/export/markdown` | Markdown出力 |
| GET | `/api/seo/articles/[id]/export/note` | ノート出力 |
| GET | `/api/seo/articles/[id]/export/txt` | テキスト出力 |

### ジョブ管理
| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/seo/articles/[id]/jobs` | ジョブ作成 |
| GET | `/api/seo/jobs/[id]` | ジョブ状態 |
| POST | `/api/seo/jobs/[id]/advance` | ジョブ進行 |
| POST | `/api/seo/jobs/[id]/cancel` | ジョブキャンセル |
| POST | `/api/seo/jobs/[id]/pause` | ジョブ一時停止 |
| POST | `/api/seo/jobs/[id]/reset` | ジョブリセット |
| POST | `/api/seo/jobs/[id]/resume` | ジョブ再開 |

### セクション・参考URL
| メソッド | パス | 説明 |
|---------|------|------|
| GET/PUT | `/api/seo/sections/[id]` | セクション取得・更新 |
| POST | `/api/seo/sections/[id]/cv` | セクションCV |
| POST | `/api/seo/sections/[id]/regenerate` | セクション再生成 |
| POST | `/api/seo/sections/[id]/seo` | セクションSEO |
| GET | `/api/seo/reference/meta` | 参考URLメタ取得 |
| POST | `/api/seo/reference/parse` | 参考URL解析 |

### その他SEO
| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/seo/title-suggestions` | タイトル提案 |
| GET | `/api/seo/entitlements` | 利用権限確認 |
| POST | `/api/seo/predict` | 予測 |
| GET | `/api/seo/preview` | プレビュー |
| GET/POST | `/api/seo/compare/candidates` | 比較候補 |
| GET/POST | `/api/seo/knowledge` | ナレッジ一覧 |
| GET/PUT/DELETE | `/api/seo/knowledge/[id]` | ナレッジ個別 |
| POST | `/api/seo/migrate-prompts` | プロンプトマイグレーション |
| * | `/api/seo/test/*` | テスト用 (banners, generate, thumbnails, image 等) |

## インタビュー API (25+)

→ 詳細: [services/interview.md](./services/interview.md)

### プロジェクト
| メソッド | パス | 説明 |
|---------|------|------|
| GET/POST | `/api/interview/projects` | プロジェクト一覧・作成 |
| GET/PUT/DELETE | `/api/interview/projects/[id]` | プロジェクト CRUD |
| GET | `/api/interview/projects/[id]/thumbnail` | サムネイル取得 |

### 素材・文字起こし
| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/interview/materials/upload-url` | 署名付きアップロードURL取得 |
| POST | `/api/interview/materials/confirm` | アップロード完了通知 → DB保存 |
| GET/DELETE | `/api/interview/materials/[id]` | 素材取得・削除 |
| POST | `/api/interview/materials/[id]/transcribe` | 文字起こし開始 |
| GET | `/api/interview/transcriptions/[id]` | 文字起こし結果取得 |

### 記事生成・編集
| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/interview/articles/generate` | AI記事生成 (SSE) |
| GET/PUT | `/api/interview/articles/[id]` | 記事取得・保存 |
| POST | `/api/interview/articles/[id]/proofread` | 校正・校閲 |
| POST | `/api/interview/articles/[id]/suggest-titles` | タイトル提案 |
| POST | `/api/interview/articles/[id]/fact-check` | ファクトチェック |
| POST | `/api/interview/articles/[id]/sns-posts` | SNS投稿文生成 |
| POST | `/api/interview/articles/[id]/translate` | 翻訳 |

### レシピ
| メソッド | パス | 説明 |
|---------|------|------|
| GET/POST | `/api/interview/recipes` | レシピ一覧・作成 |
| PUT/DELETE | `/api/interview/recipes/[id]` | レシピ編集・削除 |
| POST | `/api/interview/recipes/generate` | レシピ自動生成 |

### その他
| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/interview/revise` | 記事修正 |
| GET | `/api/interview/usage` | 利用状況確認 |
| POST | `/api/interview/cleanup` | データクリーンアップ |

## ペルソナ API (3)

→ 詳細: [services/persona.md](./services/persona.md)

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/persona/generate` | ペルソナ生成 |
| POST | `/api/persona/portrait` | ポートレート画像 |
| POST | `/api/persona/banner` | バナー画像 |

## Swipe API (8+)

→ 詳細: [services/swipe.md](./services/swipe.md)

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/swipe/start` | セッション開始 |
| POST | `/api/swipe/generate` | 記事生成 |
| POST | `/api/swipe/log` | ログ保存 |
| POST | `/api/swipe/celebration-images` | お祝い画像 |
| GET | `/api/swipe/question-images` | 質問画像取得 |
| POST | `/api/swipe/question-images/generate` | 質問画像生成 |
| DELETE | `/api/swipe/question-images/clear` | 質問画像クリア |
| * | `/api/swipe/test/*` | テスト用 (finalize, question, start) |

## ロゴ API (1)

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/logo/generate` | ロゴ生成 |

## スライド API

→ 詳細: [services/slide.md](./services/slide.md)

### ドヤスライド (`/api/slide/`)
| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/slide/generate` | スライドJSON構成生成 (Gemini) |
| POST | `/api/slide/publish/google-slides` | Google Slides に変換・公開 |

### SlashSlide (`/api/slashslide/`)
| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/slashslide/generate` | スライドJSON構成生成 (Gemini) |
| POST | `/api/slashslide/publish/google-slides` | Google Slides に変換・公開 |

### リクエスト仕様 (共通)
```typescript
// /generate
{ topic: string, slidePurpose: 'proposal'|'meeting'|'sales'|'recruit'|'seminar'|'other',
  slideCount: 3-30, themeColor: '#RRGGBB', referenceText?: string }

// /publish/google-slides
{ title: string, themeColor: '#RRGGBB', recipientEmail: string,
  slides: Array<{ title, elements: Array<{type:'text'|'bullets'|'image', ...}> }> }
```

## 展開AI API (23)

→ 詳細: services/tenkai.md (※未作成)

### プロジェクト
| メソッド | パス | 説明 |
|---------|------|------|
| GET/POST | `/api/tenkai/projects` | プロジェクト一覧・作成 |
| GET/PUT/DELETE | `/api/tenkai/projects/[projectId]` | プロジェクト CRUD |
| GET | `/api/tenkai/projects/[projectId]/outputs` | プロジェクト出力一覧 |

### 生成
| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/tenkai/generate` | マルチプラットフォーム生成 |
| POST | `/api/tenkai/generate/[platform]` | プラットフォーム指定生成 |
| POST | `/api/tenkai/generate/regenerate` | 再生成 |

### コンテンツ取込
| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/tenkai/content/analyze` | コンテンツ分析 |
| POST | `/api/tenkai/content/ingest/text` | テキスト取込 |
| POST | `/api/tenkai/content/ingest/url` | URL取込 |
| POST | `/api/tenkai/content/ingest/video` | 動画取込 |
| POST | `/api/tenkai/content/ingest/youtube` | YouTube取込 |

### その他
| メソッド | パス | 説明 |
|---------|------|------|
| GET/PUT/DELETE | `/api/tenkai/outputs/[outputId]` | 出力管理 |
| GET | `/api/tenkai/outputs/[outputId]/export` | 出力エクスポート |
| GET/POST | `/api/tenkai/brand-voices` | ブランドボイス一覧・作成 |
| GET/PUT/DELETE | `/api/tenkai/brand-voices/[id]` | ブランドボイス CRUD |
| GET/POST | `/api/tenkai/templates` | テンプレート一覧・作成 |
| GET/PUT/DELETE | `/api/tenkai/templates/[id]` | テンプレート CRUD |
| GET | `/api/tenkai/account` | アカウント情報 |
| POST | `/api/tenkai/api-key` | APIキー管理 |
| GET | `/api/tenkai/usage` | 使用状況 |
| GET | `/api/tenkai/health` | ヘルスチェック |
| POST | `/api/tenkai/export` | エクスポート |

## オープニングAI API (5)

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/opening/analyze` | Webサイト解析 (URL→カラー・コンテンツ抽出) |
| GET/POST | `/api/opening/projects` | プロジェクト一覧・作成 |
| GET/PUT/DELETE | `/api/opening/projects/[id]` | プロジェクト CRUD |
| GET | `/api/opening/animations/[id]` | アニメーション取得 |
| POST | `/api/opening/animations/[id]/export` | アニメーションエクスポート |
| GET | `/api/opening/usage` | 使用状況確認 |

## Cronジョブ API (3)

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/cron/daily-summary` | 日次レポート → Slack通知 |
| GET | `/api/cron/weekly-summary` | 週次レポート (先週結果 + 累計) → Slack通知 |
| GET | `/api/cron/monthly-summary` | 月次レポート (先月結果 + 累計) → Slack通知 |

### 認証
```
Authorization: Bearer ${CRON_SECRET}
```

### レスポンス
- 成功: `{ success: true }` (200)
- 認証エラー: `{ error: 'Unauthorized' }` (401)
- 実行エラー: `{ error: string, stack: string }` (500)

### 設定 (vercel.json)
```json
{
  "crons": [
    { "path": "/api/cron/daily-summary", "schedule": "0 0 * * *" },
    { "path": "/api/cron/weekly-summary", "schedule": "0 0 * * 1" },
    { "path": "/api/cron/monthly-summary", "schedule": "0 0 1 * *" }
  ]
}
```

## その他 API

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/health` | ヘルスチェック |
| POST | `/api/generate` | 汎用生成 |
| POST | `/api/guide` | ガイド生成 |
| POST | `/api/guide/image` | ガイド画像生成 |
