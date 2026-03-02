# 04. データベース設計

## 概要
- **ORM**: Prisma Client 5.7+
- **DB**: PostgreSQL (Supabase)
- **スキーマファイル**: `prisma/schema.prisma`
- **モデル数**: 38
- **接続**: 環境変数 `DATABASE_URL`

## テーブル一覧

### 認証 (NextAuth.js)

| テーブル | 説明 |
|---------|------|
| `Account` | OAuth プロバイダ情報 (Google) |
| `Session` | ユーザーセッション |
| `VerificationToken` | メール検証トークン |

### ユーザー管理

#### User (統一アカウント)
```
id            String   @id @default(cuid())
email         String?  @unique
name          String?
image         String?
role          String   @default("USER")        // USER | ADMIN
plan          String   @default("FREE")        // FREE | STARTER | PRO | BUSINESS | BUNDLE
firstLoginAt  DateTime?                         // 1時間生成し放題の起点

// Stripe
stripeCustomerId       String?  @unique
stripeSubscriptionId   String?  @unique
stripePriceId          String?
stripeCurrentPeriodEnd DateTime?
```

#### UserServiceSubscription (サービス別プラン)
```
userId    String
serviceId String    // 'kantan' | 'banner' | 'seo' | 'interview' | 'persona' | 'shindan'
plan      String    @default("FREE")    // FREE | PRO | ENTERPRISE

// Stripe
stripeSubscriptionId   String?  @unique
stripePriceId          String?
stripeCurrentPeriodEnd DateTime?

// 使用制限
dailyUsage     Int      @default(0)
monthlyUsage   Int      @default(0)
lastUsageReset DateTime @default(now())

@@unique([userId, serviceId])    // ユーザー×サービスでユニーク
```

### 決済 (Stripe)

#### Subscription
```
stripeSubscriptionId String  @unique
stripeCustomerId     String
planId               String?     // 'kantan-pro', 'banner-pro' など
status               String      // active, canceled, past_due
currentPeriodStart   DateTime
currentPeriodEnd     DateTime
cancelAtPeriodEnd    Boolean  @default(false)
```

### サービス定義

#### Service (DBマスタ)
```
slug        String  @unique    // 'kantan', 'banner', 'seo'
name        String
freeLimit   Int     @default(3)
proLimit    Int     @default(100)
proPrice    Int     @default(2980)
```

### テンプレート (カンタンマーケAI)

#### Category
```
name      String
slug      String   @unique
serviceId String   @default("kantan")
```

#### Template
```
categoryId  String
name        String
description String   @db.Text
prompt      String   @db.Text
inputFields Json     // [{name, label, type, required}]
outputType  String   @default("TEXT")
isPremium   Boolean  @default(false)
usageCount  Int      @default(0)
```

### 生成履歴 (全サービス共通)

#### Generation
```
userId     String
serviceId  String    // 'kantan' | 'banner' | ...
templateId String?
input      Json
output     String    @db.Text
outputType String    @default("TEXT")  // TEXT | IMAGE | HTML
metadata   Json?
isFavorite Boolean   @default(false)
```

### SEO 記事生成

#### SeoArticle
```
userId    String?
guestId   String?
status    String   @default("DRAFT")  // DRAFT | RUNNING | DONE | ERROR

// 入力
title         String
keywords      Json        // string[]
persona       String?
targetChars   Int         @default(10000)
tone          String      @default("丁寧")
requestText   String?     // 依頼内容
llmoOptions   Json?       // {tldr, faq, glossary, comparison, ...}
mode          String      @default("standard")  // standard | comparison_research

// 成果物
outline       String?     @db.Text
finalMarkdown String?     @db.Text
```

#### SeoJob (生成ジョブ)
```
articleId String
status    String  @default("queued")   // queued | running | done | error
progress  Int     @default(0)
step      String  @default("init")     // init | outline | sections | integrate | audit | done
cursor    Int     @default(0)          // 次セクションindex
```

#### SeoSection
```
articleId   String
index       Int
headingPath String?
status      String  @default("pending")  // pending | generated | reviewed | error
content     String? @db.Text
@@unique([articleId, index])
```

#### その他SEOテーブル
- `SeoReference` — 参考URL (抽出テキスト, 見出し, インサイト)
- `SeoAuditReport` — 監査レポート
- `SeoImage` — 画像 (BANNER / DIAGRAM)
- `SeoLinkCheckResult` — リンクチェック
- `SeoKnowledgeItem` — ナレッジ (trend / insight / prompt / note)
- `SeoUserMemo` — メモ

### Swipe

#### SwipeSession
```
sessionId   String   @unique
mainKeyword String
swipes      Json     // [{questionId, decision}]
finalConditions Json?
primaryInfo Json?
generatedArticleId String?
```

### インタビュー

**全テーブルに `@@map("interview_xxx")` プレフィックス付き**

#### InterviewProject
```
userId    String?
guestId   String?
title     String
status    String  @default("DRAFT")
// DRAFT | PLANNING | RECORDING | TRANSCRIBING | EDITING | REVIEWING | COMPLETED

// インタビュー対象者
intervieweeName    String?
intervieweeRole    String?
intervieweeCompany String?
intervieweeBio     String?

// レシピ (企画案)
recipeId String?
```

#### InterviewRecipe
```
userId      String?
title       String
description String?
questions   Json?       // 質問リスト
structure   Json?       // 記事構成テンプレート
aiPrompt    String?     @db.Text
isPreset    Boolean     @default(false)  // プリセット10種
```

#### InterviewMaterial
```
projectId String
type      String    // audio | video | text | pdf | image
fileName  String
fileUrl   String?
fileSize  Int?
mimeType  String?
duration  Float?    // 秒
status    String    @default("UPLOADED")
storagePath String?  // Supabase Storageパス
```

#### InterviewTranscription
```
projectId  String
materialId String?
text       String   @db.Text
segments   Json?    // [{start, end, text, speaker}]
summary    String?
provider   String?  // 'assemblyai'
confidence Float?
status     String   @default("PENDING")
@@map("interview_transcription")
```

#### InterviewReview (校正・校閲)
```
projectId  String
draftId    String?
type       String   // 'proofread' | 'factcheck' | 'seo'
score      Float?
issues     Json?    // [{type, severity, original, suggestion, reason}]
status     String   @default("PENDING")
@@map("interview_review")
```

#### InterviewDraft (記事下書き)
```
projectId  String
title      String?
content    String?  @db.Text
format     String   @default("markdown")
version    Int      @default(1)
status     String   @default("DRAFT")
@@map("interview_draft")
```

### 管理者

- `AdminUser` — 管理者アカウント (bcrypt)
- `AdminLoginAttempt` — ログイン試行記録 (IPアドレス, Turnstile対応)
- `AdminSession` — 管理者セッション

### システム

- `SystemSetting` — キーバリューストア
- `GuestSession` — ゲスト使い放題セッション

### その他

- `StrategyProject` — ドヤ戦略AI (`@@map("strategy_project")`)
- `DoyamanaCategory` / `DoyamanaImage` / `DoyamanaUsageLog` — ドヤマナAI (`@@map("doyamana_*")`)
- `BannerTemplate` — バナーテンプレート (`@@map("banner_template")`)
- `SwipeCelebrationImage` / `SwipeQuestionImage` — Swipe画像

## 全モデル一覧 (38個)

| # | モデル名 | カテゴリ | @@map |
|---|---------|---------|-------|
| 1 | Account | 認証 | - |
| 2 | Session | 認証 | - |
| 3 | VerificationToken | 認証 | - |
| 4 | User | ユーザー | - |
| 5 | UserServiceSubscription | ユーザー | - |
| 6 | Subscription | 決済 | - |
| 7 | Service | マスタ | - |
| 8 | Category | カンタン | - |
| 9 | Template | カンタン | - |
| 10 | Generation | 共通 | - |
| 11 | SystemSetting | システム | - |
| 12 | AdminUser | 管理 | - |
| 13 | AdminLoginAttempt | 管理 | - |
| 14 | AdminSession | 管理 | - |
| 15 | SeoArticle | SEO | - |
| 16 | SeoJob | SEO | - |
| 17 | SeoSection | SEO | - |
| 18 | SeoReference | SEO | - |
| 19 | SeoAuditReport | SEO | - |
| 20 | SeoUserMemo | SEO | - |
| 21 | SeoImage | SEO | - |
| 22 | SeoLinkCheckResult | SEO | - |
| 23 | SeoKnowledgeItem | SEO | - |
| 24 | SwipeSession | Swipe | - |
| 25 | SwipeCelebrationImage | Swipe | - |
| 26 | SwipeQuestionImage | Swipe | - |
| 27 | InterviewProject | インタビュー | `interview_project` |
| 28 | InterviewRecipe | インタビュー | `interview_recipe` |
| 29 | InterviewMaterial | インタビュー | `interview_material` |
| 30 | InterviewTranscription | インタビュー | `interview_transcription` |
| 31 | InterviewReview | インタビュー | `interview_review` |
| 32 | InterviewDraft | インタビュー | `interview_draft` |
| 33 | GuestSession | システム | `guest_session` |
| 34 | StrategyProject | 戦略 | `strategy_project` |
| 35 | DoyamanaCategory | ドヤマナ | `doyamana_category` |
| 36 | DoyamanaImage | ドヤマナ | `doyamana_image` |
| 37 | DoyamanaUsageLog | ドヤマナ | `doyamana_usage_log` |
| 38 | BannerTemplate | バナー | `banner_template` |

## @@map テーブルマッピング

| Prismaモデル | DBテーブル名 |
|-------------|------------|
| InterviewProject | `interview_project` |
| InterviewRecipe | `interview_recipe` |
| InterviewMaterial | `interview_material` |
| InterviewTranscription | `interview_transcription` |
| InterviewReview | `interview_review` |
| InterviewDraft | `interview_draft` |
| StrategyProject | `strategy_project` |
| DoyamanaCategory | `doyamana_category` |
| DoyamanaImage | `doyamana_image` |
| DoyamanaUsageLog | `doyamana_usage_log` |
| BannerTemplate | `banner_template` |

## リレーション図 (主要)

```
User
  ├── 1:N → UserServiceSubscription (サービス別プラン)
  ├── 1:N → Subscription (Stripe)
  ├── 1:N → Generation (生成履歴)
  ├── 1:N → SeoArticle
  │            ├── 1:N → SeoJob → SeoSection
  │            ├── 1:N → SeoImage
  │            ├── 1:N → SeoReference
  │            └── 1:N → SeoAuditReport
  ├── 1:N → InterviewProject
  │            ├── 1:N → InterviewMaterial
  │            │            └── 1:1 → InterviewTranscription
  │            ├── 1:N → InterviewDraft
  │            │            └── 1:N → InterviewReview
  │            └── N:1 → InterviewRecipe
  ├── 1:N → SwipeSession
  └── 1:N → StrategyProject
```

## Prisma操作パターン

```typescript
import { prisma } from '@/lib/prisma'

// 基本CRUD
const user = await prisma.user.findUnique({ where: { id } })
const articles = await prisma.seoArticle.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })

// インタビューテーブル (@@map 使用)
const project = await prisma.interviewProject.findUnique({ where: { id } })

// 使用制限の更新
await prisma.userServiceSubscription.upsert({
  where: { userId_serviceId: { userId, serviceId: 'persona' } },
  update: { dailyUsage: { increment: 1 } },
  create: { userId, serviceId: 'persona', dailyUsage: 1 },
})
```
