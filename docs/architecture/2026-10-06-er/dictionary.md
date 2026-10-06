# 全モデル データ辞書

スキーマの構造定義のみ。実レコードや環境変数値は含みません。

## Account

領域: 共通基盤・認証・課金 / DBテーブル: Account / schema.prisma:18

```prisma
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])

}
```

## Session

領域: 共通基盤・認証・課金 / DBテーブル: Session / schema.prisma:37

```prisma
model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

}
```

## VerificationToken

領域: 共通基盤・認証・課金 / DBテーブル: VerificationToken / schema.prisma:45

```prisma
model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])

}
```

## User

領域: 共通基盤・認証・課金 / DBテーブル: User / schema.prisma:57

```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  role          String    @default("USER") // USER | ADMIN

  // NextAuth関連
  accounts Account[]
  sessions Session[]

  // サービス別のプラン・使用状況（1対多）
  serviceSubscriptions UserServiceSubscription[]

  // Stripeサブスクリプション
  subscriptions Subscription[]

  // 生成履歴
  generations Generation[]
  personaProjects PersonaProject[]
  personaImageUsageDays PersonaImageUsageDay[]
  personaUsageDays PersonaUsageDay[]

  // SEO記事生成（ドヤ記事作成）
  seoArticles       SeoArticle[]
  seoKnowledgeItems SeoKnowledgeItem[]
  swipeSessions     SwipeSession[]

  // ドヤインタビューAI
  interviewProjects InterviewProject[]
  interviewRecipes  InterviewRecipe[]

  // ドヤ戦略AI
  strategyProjects StrategyProject[]

  // ドヤ展開AI
  tenkaiProjects    TenkaiProject[]
  tenkaiBrandVoices TenkaiBrandVoice[]
  tenkaiTemplates   TenkaiTemplate[]
  tenkaiUsages      TenkaiUsage[]
  tenkaiApiKeys     TenkaiApiKey[]

  // ドヤオープニングAI
  openingProjects OpeningProject[]

  // ドヤコピーAI
  copyProjects    CopyProject[]
  copyBrandVoices CopyBrandVoice[]

  // ドヤボイスAI
  voiceProjects VoiceProject[]

  // ドヤLP AI
  lpProjects LpProject[]

  // ドヤムービーAI
  movieProjects MovieProject[]

  // ドヤインタビューAI-X
  interviewxProjects InterviewXProject[]

  // ドヤ広告シミュレーションAI
  adSimProjects AdSimProject[]

  // 三ツ星アプリ Vol.01 ナグサメ（toCシリーズ、ドヤAIとは独立）
  mitsuboshiNagusamePosts        MitsuboshiNagusamePost[]
  mitsuboshiNagusameSubscription MitsuboshiNagusameSubscription?

  // ドヤHR（タレントマネジメント）
  hrMemberships HrOrganizationMember[]

  // ドヤプロマネ（プロジェクト管理）
  promaneWorkspaces  PromaneWorkspace[]
  promaneMembers     PromaneMember[]
  promaneInvitations PromaneInvitation[] @relation("PromaneInvitationInvitedBy")

  // ドリップマーケティング
  dripEnrollments  DripEnrollment[]
  dripEmailLogs    DripEmailLog[]
  dripUnsubscribes DripUnsubscribe[]

  // Stripe関連（ポータル全体の顧客情報）
  stripeCustomerId       String?   @unique
  stripeSubscriptionId   String?   @unique
  stripePriceId          String?
  stripeCurrentPeriodEnd DateTime?
  plan                   String    @default("FREE") // FREE | STARTER | PRO | BUSINESS | BUNDLE

  // 初回ログイン時刻（1時間生成し放題の起点）
  firstLoginAt DateTime?

  // 登録時のアトリビューション（Slack通知・獲得分析用）
  signupService String? // 登録操作を行ったサービス（例: banner, seo, portal）
  signupSource  String? // 流入経路（例: Google検索 / ドヤマーケ / X / direct）

  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt
  serviceFeedback     ServiceFeedback[]
  feedbackPromptState FeedbackPromptState?

}
```

## UserServiceSubscription

領域: 共通基盤・認証・課金 / DBテーブル: UserServiceSubscription / schema.prisma:164

```prisma
model UserServiceSubscription {
  id        String @id @default(cuid())
  user      User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  serviceId String // 'kantan' | 'banner' | 'lp' | 'video' など

  // プラン情報
  plan String @default("FREE") // FREE | PRO | ENTERPRISE

  // Stripe（統一課金: 1つの契約を全サービス行が共有する）
  // ⚠️ かつて @unique が付いていたが、統一プランでは同じ subscriptionId を
  //    全サービス行に書くため2件目以降が P2002 で失敗し、
  //    **banner 以外がプロにならない**状態になっていた（webhook側は catch で握り潰し）。
  //    サービス別サブスクは廃止済みなので一意制約は外す。
  stripeSubscriptionId   String?
  stripePriceId          String?
  stripeCurrentPeriodEnd DateTime?

  // 使用制限
  dailyUsage     Int      @default(0)
  monthlyUsage   Int      @default(0)
  lastUsageReset DateTime @default(now())

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, serviceId]) // ユーザー×サービスでユニーク
  @@index([serviceId])

}
```

## Subscription

領域: 共通基盤・認証・課金 / DBテーブル: Subscription / schema.prisma:198

```prisma
model Subscription {
  id     String @id @default(cuid())
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Stripe情報
  stripeSubscriptionId String  @unique
  stripeCustomerId     String
  priceId              String?
  planId               String? // 'kantan-pro', 'banner-starter' など

  // ステータス
  status             String // active, canceled, past_due, etc.
  currentPeriodStart DateTime
  currentPeriodEnd   DateTime
  cancelAtPeriodEnd  Boolean  @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([stripeCustomerId])

}
```

## Service

領域: 共通基盤・認証・課金 / DBテーブル: Service / schema.prisma:226

```prisma
model Service {
  id          String  @id @default(cuid())
  slug        String  @unique // 'kantan', 'banner', 'lp', 'video'
  name        String // 'カンタンドヤAI'
  description String? @db.Text
  icon        String? // 絵文字 or アイコン名
  color       String? // グラデーションクラス

  // 料金設定
  freeLimit Int @default(3) // 無料プランの1日の上限
  proLimit  Int @default(100) // プロプランの1日の上限
  proPrice  Int @default(2980) // プロプラン月額（円）

  // 状態
  isActive     Boolean @default(true)
  isComingSoon Boolean @default(false)
  order        Int     @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

}
```

## Category

領域: 共通基盤・認証・課金 / DBテーブル: Category / schema.prisma:252

```prisma
model Category {
  id          String     @id @default(cuid())
  name        String
  slug        String     @unique
  description String?
  icon        String?
  color       String?
  order       Int        @default(0)
  serviceId   String     @default("kantan") // どのサービスのカテゴリか
  templates   Template[]
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@index([serviceId])

}
```

## Template

領域: 共通基盤・認証・課金 / DBテーブル: Template / schema.prisma:268

```prisma
model Template {
  id          String       @id @default(cuid())
  name        String
  description String       @db.Text
  category    Category     @relation(fields: [categoryId], references: [id])
  categoryId  String
  prompt      String       @db.Text
  inputFields Json // [{name: string, label: string, type: string, required: boolean}]
  outputType  String       @default("TEXT")
  isPremium   Boolean      @default(false)
  isActive    Boolean      @default(true)
  usageCount  Int          @default(0)
  generations Generation[]
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

}
```

## Generation

領域: 共通基盤・認証・課金 / DBテーブル: Generation / schema.prisma:289

```prisma
model Generation {
  id     String @id @default(cuid())
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId String

  // サービス識別
  serviceId String // 'kantan' | 'banner' | 'lp' など

  // テンプレート（オプション、テンプレートを使う場合）
  template   Template? @relation(fields: [templateId], references: [id])
  templateId String?

  // 入出力
  input      Json
  output     String @db.Text
  outputType String @default("TEXT") // TEXT | IMAGE | HTML など

  // メタデータ
  metadata Json? // サービス固有の追加情報

  isFavorite Boolean  @default(false)
  createdAt  DateTime @default(now())

  @@index([userId, serviceId])
  @@index([serviceId, createdAt])

}
```

## SystemSetting

領域: 共通基盤・認証・課金 / DBテーブル: SystemSetting / schema.prisma:320

```prisma
model SystemSetting {
  id    String @id @default(cuid())
  key   String @unique
  value String @db.Text

}
```

## StripeWebhookEvent

領域: 共通基盤・認証・課金 / DBテーブル: StripeWebhookEvent / schema.prisma:327

```prisma
model StripeWebhookEvent {
  id              String    @id
  type            String
  status          String    @default("processing") // processing | processed | failed
  attempts        Int       @default(1)
  firstReceivedAt DateTime @default(now())
  lastReceivedAt  DateTime  @default(now())
  processedAt     DateTime?
  leaseExpiresAt  DateTime?
  claimToken      String?

  @@index([status, lastReceivedAt])
  @@index([lastReceivedAt])

}
```

## StripeWebhookNotification

領域: 共通基盤・認証・課金 / DBテーブル: StripeWebhookNotification / schema.prisma:343

```prisma
model StripeWebhookNotification {
  eventId        String    @id
  eventType      String
  payload        Json
  status         String    @default("pending") // pending | sending | sent
  attempts       Int       @default(0)
  nextAttemptAt  DateTime  @default(now())
  leaseExpiresAt DateTime?
  claimToken     String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  sentAt         DateTime?

  @@index([status, nextAttemptAt, createdAt])

}
```

## AdminUser

領域: 共通基盤・認証・課金 / DBテーブル: AdminUser / schema.prisma:363

```prisma
model AdminUser {
  id            String              @id @default(cuid())
  username      String              @unique
  passwordHash  String
  email         String?             @unique
  name          String?
  isActive      Boolean             @default(true)
  lastLoginAt   DateTime?
  totpSecret    String?
  totpEnabled   Boolean             @default(false)
  loginAttempts AdminLoginAttempt[]
  sessions      AdminSession[]
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt

}
```

## AdminLoginAttempt

領域: 共通基盤・認証・課金 / DBテーブル: AdminLoginAttempt / schema.prisma:379

```prisma
model AdminLoginAttempt {
  id            String     @id @default(cuid())
  adminUser     AdminUser? @relation(fields: [adminUserId], references: [id], onDelete: Cascade)
  adminUserId   String?
  username      String
  ipAddress     String?
  userAgent     String?
  success       Boolean
  failureReason String?
  createdAt     DateTime   @default(now())

  @@index([adminUserId, createdAt])
  @@index([username, createdAt])
  @@index([ipAddress, createdAt])

}
```

## AdminSession

領域: 共通基盤・認証・課金 / DBテーブル: AdminSession / schema.prisma:395

```prisma
model AdminSession {
  id          String    @id @default(cuid())
  token       String    @unique
  adminUser   AdminUser @relation(fields: [adminUserId], references: [id], onDelete: Cascade)
  adminUserId String
  ipAddress   String?
  userAgent   String?
  expiresAt   DateTime
  createdAt   DateTime  @default(now())

  @@index([adminUserId])
  @@index([token])
  @@index([expiresAt])

}
```

## SeoArticle

領域: ドヤ記事作成 / DBテーブル: SeoArticle / schema.prisma:414

```prisma
model SeoArticle {
  id String @id @default(cuid())

  userId  String?
  user    User?   @relation(fields: [userId], references: [id], onDelete: SetNull)
  // 未ログイン（ゲスト）向けの識別子（cookieで付与）
  guestId String?

  status String @default("DRAFT") // DRAFT | RUNNING | DONE | ERROR

  // 入力
  title         String
  keywords      Json // string[]
  persona       String? @db.Text
  searchIntent  String? @db.Text
  targetChars   Int     @default(10000)
  tone          String  @default("丁寧")
  forbidden     Json? // string[]
  referenceUrls Json? // string[]
  llmoOptions   Json? // {tldr:boolean, faq:boolean, glossary:boolean, comparison:boolean, quotes:boolean, templates:boolean, objections:boolean}

  // 依頼テキスト・参考画像（新機能）
  requestText     String? @db.Text // ユーザーが入力した依頼内容・参考テキスト
  referenceImages Json? // [{name:string, dataUrl:string}] 参考画像のBase64
  autoBundle      Boolean @default(true) // 記事+図解+サムネを自動生成するか

  // 比較記事（調査型）
  mode                 String @default("standard") // standard | comparison_research
  comparisonConfig     Json? // 比較記事設定（対象数/地域/除外条件/参照方針/テンプレ種別など）
  comparisonCandidates Json? // 候補企業（確定リスト）
  referenceInputs      Json? // 参考記事入力（URL/ファイル/貼り付け）と抽出プレビュー

  // 途中成果物
  outline       String? @db.Text
  finalMarkdown String? @db.Text
  checkResults  Json?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  jobs           SeoJob[]
  sections       SeoSection[]
  references     SeoReference[]
  audits         SeoAuditReport[]
  memo           SeoUserMemo?
  images         SeoImage[]
  linkChecks     SeoLinkCheckResult[]
  knowledgeItems SeoKnowledgeItem[]

  @@index([userId, createdAt])
  @@index([guestId, createdAt])
  @@index([status, createdAt])

}
```

## SwipeSession

領域: ドヤ記事作成 / DBテーブル: SwipeSession / schema.prisma:468

```prisma
model SwipeSession {
  id        String  @id @default(cuid())
  sessionId String  @unique // UUID（フロント側で生成）
  userId    String?
  user      User?   @relation(fields: [userId], references: [id], onDelete: SetNull)
  guestId   String? // 未ログイン時の識別子

  mainKeyword        String // 最初に入力したキーワード
  swipes             Json // SwipeLog[]（スワイプログ配列）
  finalConditions    Json? // {targetChars: number, articleType: string}
  primaryInfo        Json? // {results: string, experience: string, opinion: string, fixedPhrase: string}
  generatedArticleId String? // 生成された記事のID

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([sessionId])
  @@index([userId, createdAt])
  @@index([guestId, createdAt])

}
```

## SwipeCelebrationImage

領域: ドヤ記事作成 / DBテーブル: SwipeCelebrationImage / schema.prisma:489

```prisma
model SwipeCelebrationImage {
  id          String @id @default(cuid())
  category    String // カテゴリ（例: "thanks", "completion", "article"など）
  prompt      String @db.Text // 生成時のプロンプト
  imageBase64 String @db.Text // base64エンコードされた画像データ
  mimeType    String @default("image/png")
  width       Int?
  height      Int?

  createdAt DateTime @default(now())

  @@index([category])

}
```

## SwipeQuestionImage

領域: ドヤ記事作成 / DBテーブル: SwipeQuestionImage / schema.prisma:503

```prisma
model SwipeQuestionImage {
  id          String @id @default(cuid())
  category    String // カテゴリ（例: "記事の方向性", "記事タイプ", "ターゲット読者"など）
  prompt      String @db.Text // 生成時のプロンプト
  imageBase64 String @db.Text // base64エンコードされた画像データ
  mimeType    String @default("image/png")
  width       Int?
  height      Int?

  createdAt DateTime @default(now())

  @@index([category])

}
```

## SeoJob

領域: ドヤ記事作成 / DBテーブル: SeoJob / schema.prisma:517

```prisma
model SeoJob {
  id        String     @id @default(cuid())
  articleId String
  article   SeoArticle @relation(fields: [articleId], references: [id], onDelete: Cascade)

  status   String  @default("queued") // queued | running | done | error
  progress Int     @default(0)
  step     String  @default("init") // init | outline | sections | integrate | audit | done
  error    String? @db.Text

  // 途中再開用
  cursor Int   @default(0) // 次に生成するセクションindex
  meta   Json? // 進捗ログ/各ステップのカーソル等（JSON）

  executionToken     String?
  executionExpiresAt DateTime?
  supersededAt       DateTime?

  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
  startedAt  DateTime?
  finishedAt DateTime?

  sections SeoSection[]
  audits   SeoAuditReport[]

  @@index([articleId, createdAt])
  @@index([status, updatedAt])

}
```

## SeoSection

領域: ドヤ記事作成 / DBテーブル: SeoSection / schema.prisma:547

```prisma
model SeoSection {
  id        String     @id @default(cuid())
  articleId String
  article   SeoArticle @relation(fields: [articleId], references: [id], onDelete: Cascade)

  jobId String?
  job   SeoJob? @relation(fields: [jobId], references: [id], onDelete: SetNull)

  index        Int
  headingPath  String? // "H2:... > H3:..."
  plannedChars Int     @default(2000)
  status       String  @default("pending") // pending | generated | reviewed | error

  prompt      String? @db.Text
  content     String? @db.Text
  consistency String? @db.Text
  error       String? @db.Text

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([articleId, index])
  @@index([articleId, index])
  @@index([status, updatedAt])

}
```

## SeoReference

領域: ドヤ記事作成 / DBテーブル: SeoReference / schema.prisma:573

```prisma
model SeoReference {
  id        String     @id @default(cuid())
  articleId String
  article   SeoArticle @relation(fields: [articleId], references: [id], onDelete: Cascade)

  url       String
  title     String?
  fetchedAt DateTime?

  extractedText String? @db.Text
  headings      Json? // {h2:string[], h3:string[], faq:string[]}
  summary       String? @db.Text
  insights      Json? // {claims:string[], structure:string[], internalLinks:string[], faq:string[]}

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([articleId, url])
  @@index([articleId, createdAt])

}
```

## SeoAuditReport

領域: ドヤ記事作成 / DBテーブル: SeoAuditReport / schema.prisma:594

```prisma
model SeoAuditReport {
  id        String     @id @default(cuid())
  articleId String
  article   SeoArticle @relation(fields: [articleId], references: [id], onDelete: Cascade)

  jobId String?
  job   SeoJob? @relation(fields: [jobId], references: [id], onDelete: SetNull)

  report    String   @db.Text
  createdAt DateTime @default(now())

  @@index([articleId, createdAt])

}
```

## SeoUserMemo

領域: ドヤ記事作成 / DBテーブル: SeoUserMemo / schema.prisma:608

```prisma
model SeoUserMemo {
  id        String     @id @default(cuid())
  articleId String     @unique
  article   SeoArticle @relation(fields: [articleId], references: [id], onDelete: Cascade)

  content   String   @db.Text
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

}
```

## SeoImage

領域: ドヤ記事作成 / DBテーブル: SeoImage / schema.prisma:618

```prisma
model SeoImage {
  id        String     @id @default(cuid())
  articleId String
  article   SeoArticle @relation(fields: [articleId], references: [id], onDelete: Cascade)

  kind        String // BANNER | DIAGRAM
  title       String?
  prompt      String  @db.Text
  description String? @db.Text

  filePath String
  mimeType String @default("image/png")
  width    Int?
  height   Int?

  createdAt DateTime @default(now())

  @@index([articleId, createdAt])

}
```

## SeoLinkCheckResult

領域: ドヤ記事作成 / DBテーブル: SeoLinkCheckResult / schema.prisma:638

```prisma
model SeoLinkCheckResult {
  id        String     @id @default(cuid())
  articleId String
  article   SeoArticle @relation(fields: [articleId], references: [id], onDelete: Cascade)

  url        String
  statusCode Int?
  ok         Boolean  @default(false)
  finalUrl   String?
  error      String?
  checkedAt  DateTime @default(now())

  createdAt DateTime @default(now())

  @@unique([articleId, url])
  @@index([articleId, checkedAt])

}
```

## SeoKnowledgeItem

領域: ドヤ記事作成 / DBテーブル: SeoKnowledgeItem / schema.prisma:656

```prisma
model SeoKnowledgeItem {
  id String @id @default(cuid())

  userId String?
  user   User?   @relation(fields: [userId], references: [id], onDelete: SetNull)

  articleId String?
  article   SeoArticle? @relation(fields: [articleId], references: [id], onDelete: SetNull)

  type       String // trend | insight | prompt | internalLink | note
  title      String?
  content    String  @db.Text
  sourceUrls Json? // string[]

  createdAt DateTime @default(now())

  @@index([userId, createdAt])
  @@index([type, createdAt])

}
```

## InterviewProject

領域: ドヤインタビュー / DBテーブル: interview_project / schema.prisma:680

```prisma
model InterviewProject {
  id String @id @default(cuid())

  userId  String?
  user    User?   @relation(fields: [userId], references: [id], onDelete: SetNull)
  guestId String? // 未ログイン（ゲスト）向けの識別子

  // 基本情報
  title  String
  status String @default("DRAFT") // DRAFT | PLANNING | RECORDING | TRANSCRIBING | EDITING | REVIEWING | COMPLETED

  thumbnailUrl String? @db.Text // 旧base64 data URL または private Storage のマーカー

  // インタビュー対象者情報
  intervieweeName    String?
  intervieweeRole    String?
  intervieweeCompany String?
  intervieweeBio     String? @db.Text

  // 企画情報
  genre          String? // CASE_STUDY | PRODUCT_INTERVIEW | PERSONA_INTERVIEW | OTHER
  theme          String? @db.Text // 取材テーマ
  purpose        String? @db.Text // 目的
  targetAudience String? @db.Text // 想定読者
  tone           String? @default("friendly") // friendly | professional | casual | formal
  mediaType      String? // blog | news | sns | pr | other

  // レシピ（企画案・質問リスト）
  recipeId String?
  recipe   InterviewRecipe? @relation(fields: [recipeId], references: [id], onDelete: SetNull)

  // 素材
  materials InterviewMaterial[]

  // 文字起こし
  transcriptions InterviewTranscription[]

  // 構成案・ドラフト
  outline String?          @db.Text
  drafts  InterviewDraft[]

  // 校閲
  reviews InterviewReview[]

  // 出力
  finalContent  String? @db.Text // 最終記事
  exportFormats Json? // {word: string, markdown: string, html: string}

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId, createdAt])
  @@index([guestId, createdAt])
  @@index([status, createdAt])
  @@map("interview_project")

}
```

## InterviewRecipe

領域: ドヤインタビュー / DBテーブル: interview_recipe / schema.prisma:737

```prisma
model InterviewRecipe {
  id String @id @default(cuid())

  userId String?
  user   User?   @relation(fields: [userId], references: [id], onDelete: SetNull)

  // レシピ情報
  name        String // レシピ名
  description String? @db.Text
  category    String? // formal | casual | panel | technical | pr

  // 企画案（複数パターン）
  proposals Json // [{title: string, summary: string, questions: string[], value: string}]

  // 質問リスト
  questions Json // string[]

  // 編集方針
  editingGuidelines String? @db.Text

  // 共有設定
  isPublic   Boolean @default(false)
  isTemplate Boolean @default(false) // テンプレートとして使用可能

  usageCount Int @default(0)

  projects InterviewProject[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId, createdAt])
  @@index([category, isTemplate])
  @@map("interview_recipe")

}
```

## InterviewMaterial

領域: ドヤインタビュー / DBテーブル: interview_material / schema.prisma:773

```prisma
model InterviewMaterial {
  id String @id @default(cuid())

  projectId String
  project   InterviewProject @relation(fields: [projectId], references: [id], onDelete: Cascade)

  // 素材タイプ
  type String // audio | video | text | pdf | image | url

  transcriptions InterviewTranscription[]

  // ファイル情報
  fileName String
  filePath String? // サーバー上のパス
  fileUrl  String? // 外部URL
  fileSize BigInt? // バイト数（10GBまで対応）
  mimeType String?
  duration Int? // 秒数（音声・動画の場合）

  // メタデータ
  metadata Json? // {width, height, bitrate, etc.}

  // 処理状態
  status String  @default("UPLOADED") // UPLOADED | PROCESSING | COMPLETED | ERROR
  error  String? @db.Text

  // 抽出テキスト（PDF等）
  extractedText String? @db.Text

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([projectId, createdAt])
  @@map("interview_material")

}
```

## InterviewTranscription

領域: ドヤインタビュー / DBテーブル: interview_transcription / schema.prisma:809

```prisma
model InterviewTranscription {
  id String @id @default(cuid())

  projectId String
  project   InterviewProject @relation(fields: [projectId], references: [id], onDelete: Cascade)

  materialId String?
  material   InterviewMaterial? @relation(fields: [materialId], references: [id], onDelete: SetNull)

  // 文字起こし内容
  text     String @db.Text
  segments Json? // [{start: number, end: number, text: string, speaker?: string}]

  // 要約・トピック分割
  summary String? @db.Text
  topics  Json? // [{topic: string, startTime: number, endTime: number, summary: string}]

  // 処理情報
  provider      String? // google | whisper | deepgram | manual
  externalJobId String? // AssemblyAI transcript ID (再接続用)
  confidence    Float? // 信頼度スコア
  status        String  @default("PENDING") // PENDING | PROCESSING | COMPLETED | ERROR

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([projectId, createdAt])
  @@index([materialId, status])
  @@map("interview_transcription")

}
```

## InterviewReview

領域: ドヤインタビュー / DBテーブル: interview_review / schema.prisma:840

```prisma
model InterviewReview {
  id String @id @default(cuid())

  projectId String
  project   InterviewProject @relation(fields: [projectId], references: [id], onDelete: Cascade)

  draftId String?
  draft   InterviewDraft? @relation(fields: [draftId], references: [id], onDelete: SetNull)

  // 校閲結果
  report String @db.Text // 校閲レポート

  // チェック項目
  checks Json? // {grammar: boolean, facts: boolean, consistency: boolean, readability: boolean}

  // スコア
  score            Float? // 0-100
  readabilityScore Float? // 読みやすさスコア

  // 修正提案
  suggestions Json? // [{type: string, position: number, original: string, suggested: string, reason: string}]

  createdAt DateTime @default(now())

  @@index([projectId, createdAt])
  @@map("interview_review")

}
```

## InterviewDraft

領域: ドヤインタビュー / DBテーブル: interview_draft / schema.prisma:868

```prisma
model InterviewDraft {
  id String @id @default(cuid())

  projectId String
  project   InterviewProject @relation(fields: [projectId], references: [id], onDelete: Cascade)

  // ドラフト情報
  version Int     @default(1)
  title   String?
  lead    String? @db.Text // リード文
  content String  @db.Text // 本文

  // 記事タイプと表示形式
  articleType   String? // INTERVIEW | BUSINESS_REPORT | INTERNAL_INTERVIEW | CASE_STUDY
  displayFormat String? // QA | MONOLOGUE (Q&A形式 or 一人で喋っている形式)

  // 構成
  structure Json? // [{heading: string, summary: string, quotes: string[], content: string}]

  // メタデータ
  wordCount   Int?
  readingTime Int? // 分

  // SEO用
  seoTitle          String?
  seoDescription    String? @db.Text
  socialTitle       String?
  socialDescription String? @db.Text

  // 状態
  status String @default("DRAFT") // DRAFT | REVIEWING | APPROVED | PUBLISHED

  reviews InterviewReview[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([projectId, createdAt])
  @@index([projectId, version])
  @@map("interview_draft")

}
```

## GuestSession

領域: 共通基盤・認証・課金 / DBテーブル: guest_session / schema.prisma:914

```prisma
model GuestSession {
  id      String @id @default(cuid())
  guestId String @unique // ゲストユーザーの識別子

  // 初回アクセス時刻（1時間使い放題の起点）
  firstAccessAt DateTime @default(now())

  // 最後のアクセス時刻
  lastAccessAt DateTime @default(now())

  // 使用状況
  transcriptionCount Int @default(0) // 文字起こし実行回数

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([guestId])
  @@index([firstAccessAt])
  @@map("guest_session")

}
```

## StrategyProject

領域: 関連定義：戦略プロジェクト / DBテーブル: strategy_project / schema.prisma:939

```prisma
model StrategyProject {
  id String @id @default(cuid())

  userId  String?
  user    User?   @relation(fields: [userId], references: [id], onDelete: SetNull)
  guestId String?

  // 入力情報
  serviceUrl     String? @db.Text
  businessModel  String? @db.Text
  averagePrice   String? // 平均単価
  targetCustomer String? @db.Text // 想定顧客
  budgetRange    String? @db.Text // 予算レンジ
  salesType      String? @db.Text // 営業体制

  // 戦略データ（多層構造）
  // Kernel（コア戦略）
  coreStrategy Json? // {core_strategy: string, main_levers: string[]}

  // Phase（フェーズ別戦略）
  phases Json? // [{phase_name: string, goal: string, actions: string[], kpi: string[], budget_ratio: number}]

  // Visualization（可視化データ）
  visualizationData Json? // {budget_chart: [], kpi_chart: [], phase_map: []}

  // ExternalResearch（外部調査結果）
  externalResearch Json? // {competitors: [], summary: string, patterns: []}

  // メタデータ
  title       String?
  description String? @db.Text
  status      String  @default("DRAFT") // DRAFT | GENERATED | COMPLETED

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId, createdAt])
  @@index([guestId, createdAt])
  @@index([status, createdAt])
  @@map("strategy_project")

}
```

## DoyamanaCategory

領域: 関連機能：ドヤマナ / DBテーブル: doyamana_category / schema.prisma:985

```prisma
model DoyamanaCategory {
  id          String  @id @default(cuid())
  name        String // カテゴリ名（例: SEO系、LP系、WP系）
  slug        String  @unique // URL用スラッグ
  description String? @db.Text
  order       Int     @default(0) // 表示順
  isActive    Boolean @default(true) // ON/OFF

  images DoyamanaImage[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([isActive, order])
  @@map("doyamana_category")

}
```

## DoyamanaImage

領域: 関連機能：ドヤマナ / DBテーブル: doyamana_image / schema.prisma:1002

```prisma
model DoyamanaImage {
  id String @id @default(cuid())

  // カテゴリ
  categoryId String
  category   DoyamanaCategory @relation(fields: [categoryId], references: [id])

  // 画像情報
  imageUrl     String  @db.Text // Supabase Storage URL or Base64
  thumbnailUrl String? @db.Text // サムネイル用（オプション）
  fileName     String? // 元ファイル名
  mimeType     String  @default("image/png")
  width        Int?
  height       Int?

  // プロンプト
  prompt        String  @db.Text // 生成プロンプト
  promptSummary String? // プロンプト冒頭（一覧表示用、50文字程度）

  // 表示設定
  order     Int     @default(0) // 表示順
  isActive  Boolean @default(true) // ON/OFF
  isDeleted Boolean @default(false) // 論理削除

  // 使用回数トラッキング
  usageCount Int @default(0)

  // 使用ログ
  usageLogs DoyamanaUsageLog[]

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime? // 論理削除日時

  @@index([categoryId, isActive, isDeleted])
  @@index([isActive, isDeleted, order])
  @@index([usageCount])
  @@map("doyamana_image")

}
```

## DoyamanaUsageLog

領域: 関連機能：ドヤマナ / DBテーブル: doyamana_usage_log / schema.prisma:1042

```prisma
model DoyamanaUsageLog {
  id String @id @default(cuid())

  imageId String
  image   DoyamanaImage @relation(fields: [imageId], references: [id], onDelete: Cascade)

  // 使用コンテキスト
  userId    String? // ログインユーザーの場合
  guestId   String? // ゲストの場合
  serviceId String? // どのサービスで使用されたか

  // メタデータ
  metadata Json? // 追加情報（生成パラメータ等）

  createdAt DateTime @default(now())

  @@index([imageId, createdAt])
  @@index([userId, createdAt])
  @@index([createdAt])
  @@map("doyamana_usage_log")

}
```

## BannerTemplate

領域: ドヤバナーAI / DBテーブル: banner_template / schema.prisma:1068

```prisma
model BannerTemplate {
  id         String @id @default(cuid())
  templateId String @unique // 'brand-001', 'ux-001' など（コード内のID）
  industry   String
  category   String // 'it', 'recruit', 'ec', 'beauty' など
  prompt     String @db.Text // デザイン要素のみのプロンプト
  size       String @default("1200x628")

  // 画像URL（生成済みの場合）
  imageUrl   String? // ヒーロー画像として表示するURL
  previewUrl String? // サムネイル用（オプション）

  // フラグ
  isFeatured Boolean @default(false) // 初期表示用のヒーロー画像として使用
  isActive   Boolean @default(true)

  /// ドヤ広告画像AIが「デザインの雰囲気」として流用するための解析結果。
  /// ⚠️ prompt からは取れない。構造化テンプレ150枚の Style は10種類の定型文の
  ///    使い回しで、実際のサムネイルと対応していない（写真の有無すら合わない）。
  ///    そのため**画像そのものをAIに見せて**読み取り、ここに保存する。
  ///    scripts/analyze-banner-templates.ts で一括生成する。
  derivedStyle       String? @db.Text
  /// 読み取った構図キー（photo-overlay / panel-side / editorial-vertical / type-hero / hero-center）
  derivedComposition String?
  /// 写真を使っているか。ここを外すと全く違う絵になるため単独で持つ
  derivedUsesPhoto   Boolean?
  derivedAt          DateTime?

  // 並び順（小さいほど先）。既定1000は「順序指定なし＝従来分」。
  // ⚠️ 一覧APIは take=30 の先読みなので、ここが未指定だと Postgres が
  //    どの30件を返すか不定になり「最初に見える4枚」が固定できない。
  sortOrder Int @default(1000)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([industry])
  @@index([category])
  @@index([isFeatured])
  @@index([isActive])
  @@index([isFeatured, sortOrder])
  @@map("banner_template")

}
```

## TenkaiProject

領域: ドヤ展開AI / DBテーブル: tenkai_projects / schema.prisma:1116

```prisma
model TenkaiProject {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  title         String
  inputType     String // "url" | "text" | "youtube" | "video"
  inputUrl      String?
  inputText     String?  @db.Text
  inputVideoUrl String? // Supabase Storage URL
  transcript    String?  @db.Text
  analysis      Json? // コンテンツ分析結果
  status        String   @default("draft") // draft | analyzing | ready | generating | completed
  wordCount     Int?
  language      String   @default("ja")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  outputs TenkaiOutput[]

  @@index([userId, createdAt])
  @@index([status, createdAt])
  @@map("tenkai_projects")

}
```

## TenkaiOutput

領域: ドヤ展開AI / DBテーブル: tenkai_outputs / schema.prisma:1140

```prisma
model TenkaiOutput {
  id           String            @id @default(cuid())
  projectId    String
  project      TenkaiProject     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  platform     String // "note" | "blog" | "x" | "instagram" | "line" | "facebook" | "linkedin" | "newsletter" | "press_release"
  content      Json // プラットフォーム固有のJSON構造
  charCount    Int?
  qualityScore Float? // 0.0-1.0
  isEdited     Boolean           @default(false)
  status       String            @default("pending") // pending | generating | completed | failed
  tokensUsed   Int?
  brandVoiceId String?
  brandVoice   TenkaiBrandVoice? @relation(fields: [brandVoiceId], references: [id], onDelete: SetNull)
  templateId   String?
  feedback     String?           @db.Text // 再生成時のフィードバック
  version      Int               @default(1)
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt

  @@unique([projectId, platform, version])
  @@index([projectId, status])
  @@index([projectId, platform])
  @@index([status, createdAt])
  @@map("tenkai_outputs")

}
```

## TenkaiBrandVoice

領域: ドヤ展開AI / DBテーブル: tenkai_brand_voices / schema.prisma:1166

```prisma
model TenkaiBrandVoice {
  id                   String   @id @default(cuid())
  userId               String
  user                 User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name                 String
  firstPerson          String   @default("私")
  formalityLevel       Int      @default(3) // 1-5
  enthusiasmLevel      Int      @default(3)
  technicalLevel       Int      @default(3)
  humorLevel           Int      @default(2)
  targetAudience       String?
  sampleText           String?  @db.Text
  preferredExpressions String[] // 好んで使う表現
  prohibitedWords      String[] // 禁止ワード
  isDefault            Boolean  @default(false)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  outputs TenkaiOutput[]

  @@index([userId])
  @@index([userId, isDefault])
  @@map("tenkai_brand_voices")

}
```

## TenkaiTemplate

領域: ドヤ展開AI / DBテーブル: tenkai_templates / schema.prisma:1191

```prisma
model TenkaiTemplate {
  id             String   @id @default(cuid())
  userId         String? // null = システムテンプレート
  user           User?    @relation(fields: [userId], references: [id], onDelete: Cascade)
  platform       String
  name           String
  description    String?
  promptOverride String?  @db.Text // プロンプト上書き
  structureHint  Json? // 構造指定
  isSystem       Boolean  @default(false)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([userId])
  @@index([platform])
  @@map("tenkai_templates")

}
```

## TenkaiUsage

領域: ドヤ展開AI / DBテーブル: tenkai_usage / schema.prisma:1209

```prisma
model TenkaiUsage {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  yearMonth       String // "2026-02" 形式
  creditsUsed     Int      @default(0)
  tokensTotal     Int      @default(0)
  projectsCreated Int      @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([userId, yearMonth])
  @@index([userId])
  @@map("tenkai_usage")

}
```

## TenkaiApiKey

領域: ドヤ展開AI / DBテーブル: tenkai_api_keys / schema.prisma:1225

```prisma
model TenkaiApiKey {
  id         String    @id @default(cuid())
  userId     String
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  keyPrefix  String // "sk-doya-xxxx" の先頭8文字（表示用）
  keyHash    String // SHA-256ハッシュ（認証用）
  lastUsedAt DateTime?
  isActive   Boolean   @default(true)
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  @@index([userId])
  @@index([keyHash])
  @@map("tenkai_api_keys")

}
```

## OpeningProject

領域: ドヤオープニングAI / DBテーブル: OpeningProject / schema.prisma:1245

```prisma
model OpeningProject {
  id      String  @id @default(cuid())
  userId  String?
  user    User?   @relation(fields: [userId], references: [id], onDelete: SetNull)
  guestId String?

  inputUrl     String
  siteAnalysis Json?
  status       String @default("ANALYZING") // ANALYZING | READY | COMPLETED | ERROR

  metadata Json?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  animations OpeningAnimation[]

  @@index([userId, createdAt])
  @@index([guestId, createdAt])
  @@index([status])

}
```

## OpeningAnimation

領域: ドヤオープニングAI / DBテーブル: OpeningAnimation / schema.prisma:1267

```prisma
model OpeningAnimation {
  id        String         @id @default(cuid())
  projectId String
  project   OpeningProject @relation(fields: [projectId], references: [id], onDelete: Cascade)

  templateId String
  config     Json
  reactCode  String? @db.Text

  isSelected Boolean @default(false)
  isFavorite Boolean @default(false)

  metadata Json?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([projectId])
  @@index([templateId])

}
```

## CopyBrandVoice

領域: ドヤコピーAI / DBテーブル: CopyBrandVoice / schema.prisma:1292

```prisma
model CopyBrandVoice {
  id     String @id @default(cuid())
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  name          String
  tone          String   @db.Text
  vocabulary    Json?
  examples      Json?
  ngWords       String[] @default([])
  requiredWords String[] @default([])

  projects CopyProject[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])

}
```

## CopyProject

領域: ドヤコピーAI / DBテーブル: CopyProject / schema.prisma:1312

```prisma
model CopyProject {
  id      String  @id @default(cuid())
  userId  String?
  user    User?   @relation(fields: [userId], references: [id], onDelete: Cascade)
  guestId String?

  name          String
  status        String  @default("draft")
  productUrl    String?
  productInfo   Json?
  persona       Json?
  personaSource String?

  regulations  Json?
  brandVoiceId String?
  brandVoice   CopyBrandVoice? @relation(fields: [brandVoiceId], references: [id])

  copies CopyItem[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId, createdAt])
  @@index([guestId])

}
```

## CopyItem

領域: ドヤコピーAI / DBテーブル: CopyItem / schema.prisma:1338

```prisma
model CopyItem {
  id        String      @id @default(cuid())
  projectId String
  project   CopyProject @relation(fields: [projectId], references: [id], onDelete: Cascade)

  type        String
  platform    String?
  writerType  String
  headline    String?
  description String?  @db.Text
  catchcopy   String?
  hashtags    String[] @default([])
  cta         String?

  appealAxis String?
  charCount  Int?
  score      Float?
  isFavorite Boolean @default(false)

  revisions Json[] @default([])

  createdAt DateTime @default(now())

  @@index([projectId])

}
```

## LpProject

領域: ドヤワイヤーフレーム AI / DBテーブル: lp_projects / schema.prisma:1368

```prisma
model LpProject {
  id      String  @id @default(cuid())
  userId  String
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  guestId String?

  // プロジェクト情報
  name        String
  status      String   @default("draft") // draft | generating | editing | completed
  purpose     String[] // LP目的（複数可）
  productUrl  String?
  productInfo Json?
  persona     Json?

  // 構成
  structures        Json? // AI生成された3案
  selectedStructure Int? // 選択された案（0-based）

  // デザイン
  themeId      String @default("minimal")
  customColors Json?
  customFonts  Json?

  // セクション
  sections LpSection[]

  // 出力
  htmlUrl    String?
  pdfUrl     String?
  previewUrl String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId, createdAt])
  @@index([guestId])
  @@map("lp_projects")

}
```

## LpSection

領域: ドヤワイヤーフレーム AI / DBテーブル: lp_sections / schema.prisma:1407

```prisma
model LpSection {
  id        String    @id @default(cuid())
  projectId String
  project   LpProject @relation(fields: [projectId], references: [id], onDelete: Cascade)

  order   Int
  type    String // "hero" | "problem" | "solution" | "features" | "testimonial" | "pricing" | "faq" | "cta" | "footer" 等
  name    String
  purpose String?

  // コピー
  headline    String?
  subheadline String?
  body        String? @db.Text
  ctaText     String?
  ctaUrl      String?

  // レイアウト
  layout  String  @default("center") // "center" | "left-right" | "right-left" | "grid" | "cards"
  bgColor String?
  bgImage String?

  // リスト型コンテンツ
  items Json? // [{ title, description, icon, image }]

  // リビジョン履歴
  revisions Json[] @default([])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([projectId, order])
  @@map("lp_sections")

}
```

## VoiceProject

領域: ドヤボイスAI / DBテーブル: VoiceProject / schema.prisma:1446

```prisma
model VoiceProject {
  id      String  @id @default(cuid())
  userId  String
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  guestId String?

  // プロジェクト情報
  name   String
  status String @default("draft") // draft, generating, completed, failed

  // 音声設定
  speakerId   String @default("akira")
  speed       Float  @default(1.0) // 0.5 ~ 2.0
  pitch       Float  @default(0.0) // -10 ~ +10
  volume      Float  @default(100.0) // 0 ~ 100
  pauseLength String @default("standard") // "short", "standard", "long"
  emotionTone String @default("neutral") // "neutral", "bright", "calm", "serious", "gentle"

  // テキスト
  inputText String  @db.Text
  ssml      String? @db.Text

  // 出力
  outputFormat String  @default("mp3") // "mp3", "wav", "ogg", "m4a"
  outputUrl    String?
  durationMs   Int?
  fileSize     Int?

  // 録音データ
  recordings VoiceRecording[]

  // メタ
  isFavorite Boolean @default(false)
  metadata   Json?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId, createdAt])
  @@index([guestId])

}
```

## VoiceRecording

領域: ドヤボイスAI / DBテーブル: VoiceRecording / schema.prisma:1488

```prisma
model VoiceRecording {
  id        String       @id @default(cuid())
  projectId String
  project   VoiceProject @relation(fields: [projectId], references: [id], onDelete: Cascade)

  originalUrl String
  trimmedUrl  String?
  durationMs  Int
  fileSize    Int
  format      String  @default("webm")

  label String?
  order Int     @default(0)

  createdAt DateTime @default(now())

  @@index([projectId])

}
```

## MovieProject

領域: ドヤムービーAI / DBテーブル: movie_projects / schema.prisma:1511

```prisma
model MovieProject {
  id      String  @id @default(cuid())
  userId  String?
  user    User?   @relation(fields: [userId], references: [id], onDelete: SetNull)
  guestId String?

  // プロジェクト情報
  name        String
  status      String @default("draft") // draft, planning, editing, rendering, completed, failed
  productInfo Json?
  persona     Json?

  // テンプレート・設定
  templateId  String?
  aspectRatio String  @default("16:9") // "16:9", "9:16", "1:1", "4:5"
  duration    Int     @default(15) // 秒
  resolution  String  @default("1080p") // "720p", "1080p"
  platform    String? // 配信先

  // 企画・シナリオ
  plans        Json? // AI生成された3案 [{ concept, storyline, scenes }]
  selectedPlan Int? // 選択された案のインデックス

  // シーンデータ
  scenes MovieScene[]

  // レンダリング
  renderJobs MovieRenderJob[]

  // 出力
  outputUrl    String? // 完成動画のURL
  thumbnailUrl String? // サムネイルURL

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId, createdAt])
  @@index([guestId])
  @@map("movie_projects")

}
```

## MovieScene

領域: ドヤムービーAI / DBテーブル: movie_scenes / schema.prisma:1552

```prisma
model MovieScene {
  id        String       @id @default(cuid())
  projectId String
  project   MovieProject @relation(fields: [projectId], references: [id], onDelete: Cascade)

  order       Int // シーン順序
  duration    Float // 秒数（小数対応）
  bgType      String  @default("image") // "image", "video", "color", "gradient"
  bgValue     String? // URL or カラーコード
  bgAnimation String? // "ken-burns", "zoom-in", "none"

  // テキストオーバーレイ
  texts Json? // [{ content, x, y, fontSize, fontFamily, color, animation, delay }]

  // ナレーション
  narrationText String?
  narrationUrl  String? // ドヤボイスAI 生成音声のURL

  // トランジション
  transition String @default("fade") // "fade", "slide", "wipe", "zoom", "none"

  // メタ
  metadata Json?

  @@index([projectId, order])
  @@map("movie_scenes")

}
```

## MovieRenderJob

領域: ドヤムービーAI / DBテーブル: movie_render_jobs / schema.prisma:1580

```prisma
model MovieRenderJob {
  id        String       @id @default(cuid())
  projectId String
  project   MovieProject @relation(fields: [projectId], references: [id], onDelete: Cascade)

  status    String  @default("queued") // queued, rendering, completed, failed
  progress  Int     @default(0) // 0-100
  outputUrl String?
  format    String  @default("mp4") // "mp4", "gif"
  error     String?

  startedAt   DateTime?
  completedAt DateTime?
  createdAt   DateTime  @default(now())

  @@index([projectId])
  @@map("movie_render_jobs")

}
```

## InterviewXProject

領域: ドヤヒヤリングAI / DBテーブル: interviewx_projects / schema.prisma:1603

```prisma
model InterviewXProject {
  id     String @id @default(cuid())
  userId String
  user   User   @relation(fields: [userId], references: [id])

  // 基本設定
  title      String
  templateId String?
  template   InterviewXTemplate? @relation(fields: [templateId], references: [id])

  // 対象情報
  companyName String?
  companyUrl  String?
  companyLogo String?
  brandColor  String? @default("#3B82F6")

  // コンテンツ設定
  purpose            String?
  targetAudience     String?
  tone               String? @default("professional")
  articleType        String? @default("CASE_STUDY")
  hearingType        String? @default("BUSINESS_MEETING")
  wordCountTarget    Int?    @default(3000)
  customInstructions String? @db.Text

  // URL調査結果
  companyAnalysis Json?

  // インタビューモード
  interviewMode String @default("chat") // 'chat' fixed

  // ステータス
  status String @default("DRAFT")

  // 共有
  shareToken      String  @unique @default(cuid())
  shareUrl        String?
  respondentEmail String?
  respondentName  String?

  // 関連
  questions InterviewXQuestion[]
  responses InterviewXResponse[]
  drafts    InterviewXDraft[]
  feedbacks InterviewXFeedback[]
  checks    InterviewXCheck[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([shareToken])
  @@index([status])
  @@map("interviewx_projects")

}
```

## InterviewXTemplate

領域: ドヤヒヤリングAI / DBテーブル: interviewx_templates / schema.prisma:1659

```prisma
model InterviewXTemplate {
  id String @id @default(cuid())

  name        String
  description String? @db.Text
  category    String
  icon        String? @default("📋")

  defaultQuestions Json?
  promptTemplate   String? @db.Text
  sampleArticle    String? @db.Text

  isPreset   Boolean @default(false)
  isPublic   Boolean @default(false)
  usageCount Int     @default(0)

  userId String?

  projects InterviewXProject[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([category])
  @@map("interviewx_templates")

}
```

## InterviewXQuestion

領域: ドヤヒヤリングAI / DBテーブル: interviewx_questions / schema.prisma:1686

```prisma
model InterviewXQuestion {
  id        String            @id @default(cuid())
  projectId String
  project   InterviewXProject @relation(fields: [projectId], references: [id], onDelete: Cascade)

  text        String
  description String?
  type        String  @default("TEXTAREA")
  options     Json?
  required    Boolean @default(true)
  order       Int
  aiGenerated Boolean @default(true)

  answers InterviewXAnswer[]

  createdAt DateTime @default(now())

  @@unique([projectId, order])
  @@index([projectId])
  @@map("interviewx_questions")

}
```

## InterviewXResponse

領域: ドヤヒヤリングAI / DBテーブル: interviewx_responses / schema.prisma:1708

```prisma
model InterviewXResponse {
  id        String            @id @default(cuid())
  projectId String
  project   InterviewXProject @relation(fields: [projectId], references: [id], onDelete: Cascade)

  respondentName    String?
  respondentEmail   String?
  respondentRole    String?
  respondentCompany String?

  status      String    @default("IN_PROGRESS")
  completedAt DateTime?

  ipAddress String?
  userAgent String?

  answers      InterviewXAnswer[]
  chatMessages InterviewXChatMessage[]

  startedAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([projectId])
  @@map("interviewx_responses")

}
```

## InterviewXAnswer

領域: ドヤヒヤリングAI / DBテーブル: interviewx_answers / schema.prisma:1734

```prisma
model InterviewXAnswer {
  id         String             @id @default(cuid())
  responseId String
  response   InterviewXResponse @relation(fields: [responseId], references: [id], onDelete: Cascade)
  questionId String
  question   InterviewXQuestion @relation(fields: [questionId], references: [id])

  answerText  String? @db.Text
  answerValue Json?

  createdAt DateTime @default(now())

  @@unique([responseId, questionId])
  @@index([responseId])
  @@index([questionId])
  @@map("interviewx_answers")

}
```

## InterviewXDraft

領域: ドヤヒヤリングAI / DBテーブル: interviewx_drafts / schema.prisma:1752

```prisma
model InterviewXDraft {
  id        String            @id @default(cuid())
  projectId String
  project   InterviewXProject @relation(fields: [projectId], references: [id], onDelete: Cascade)

  version   Int     @default(1)
  title     String?
  lead      String? @db.Text
  content   String  @db.Text
  structure Json?

  wordCount   Int?
  readingTime Int?

  appliedFeedbacks Json?

  status String @default("DRAFT")

  feedbacks InterviewXFeedback[]
  checks    InterviewXCheck[]

  createdAt DateTime @default(now())

  @@unique([projectId, version])
  @@index([projectId])
  @@map("interviewx_drafts")

}
```

## InterviewXFeedback

領域: ドヤヒヤリングAI / DBテーブル: interviewx_feedbacks / schema.prisma:1780

```prisma
model InterviewXFeedback {
  id        String            @id @default(cuid())
  projectId String
  project   InterviewXProject @relation(fields: [projectId], references: [id], onDelete: Cascade)
  draftId   String?
  draft     InterviewXDraft?  @relation(fields: [draftId], references: [id])

  authorType String
  authorName String?

  content  String  @db.Text
  section  String?
  category String?

  applied   Boolean   @default(false)
  appliedAt DateTime?

  createdAt DateTime @default(now())

  @@index([projectId])
  @@index([draftId])
  @@map("interviewx_feedbacks")

}
```

## InterviewXCheck

領域: ドヤヒヤリングAI / DBテーブル: interviewx_checks / schema.prisma:1804

```prisma
model InterviewXCheck {
  id        String            @id @default(cuid())
  projectId String
  project   InterviewXProject @relation(fields: [projectId], references: [id], onDelete: Cascade)
  draftId   String
  draft     InterviewXDraft   @relation(fields: [draftId], references: [id])

  checkType   String
  score       Float?
  passed      Boolean @default(false)
  report      String? @db.Text
  suggestions Json?

  createdAt DateTime @default(now())

  @@index([projectId])
  @@index([draftId])
  @@map("interviewx_checks")

}
```

## InterviewXChatMessage

領域: ドヤヒヤリングAI / DBテーブル: interviewx_chat_messages / schema.prisma:1824

```prisma
model InterviewXChatMessage {
  id         String             @id @default(cuid())
  responseId String
  response   InterviewXResponse @relation(fields: [responseId], references: [id], onDelete: Cascade)

  role    String // 'interviewer' | 'respondent' | 'system'
  content String @db.Text

  topicIndex  Int? // 対応する質問インデックス(0始まり)
  messageType String? // 'greeting'|'question'|'follow_up'|'transition'|'closing'|'answer'

  createdAt DateTime @default(now())

  @@index([responseId])
  @@index([responseId, createdAt])
  @@map("interviewx_chat_messages")

}
```

## DripSegment

領域: 運営・メール配信 / DBテーブル: drip_segments / schema.prisma:1847

```prisma
model DripSegment {
  id         String   @id @default(cuid())
  name       String
  key        String   @unique
  conditions Json // {"type": "last_login_over", "days": 7} etc.
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  sequences DripSequence[]

  @@map("drip_segments")

}
```

## DripTemplate

領域: 運営・メール配信 / DBテーブル: drip_templates / schema.prisma:1861

```prisma
model DripTemplate {
  id        String   @id @default(cuid())
  name      String
  subject   String
  bodyHtml  String   @db.Text
  bodyText  String?  @db.Text
  variables Json? // 使用する差し込み変数一覧
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  steps DripStep[]

  @@map("drip_templates")

}
```

## DripSequence

領域: 運営・メール配信 / DBテーブル: drip_sequences / schema.prisma:1877

```prisma
model DripSequence {
  id        String       @id @default(cuid())
  name      String
  status    String       @default("draft") // draft | active | paused
  segmentId String?
  segment   DripSegment? @relation(fields: [segmentId], references: [id], onDelete: SetNull)
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  steps       DripStep[]
  enrollments DripEnrollment[]

  @@map("drip_sequences")

}
```

## DripStep

領域: 運営・メール配信 / DBテーブル: drip_steps / schema.prisma:1893

```prisma
model DripStep {
  id            String        @id @default(cuid())
  sequenceId    String
  sequence      DripSequence  @relation(fields: [sequenceId], references: [id], onDelete: Cascade)
  sortOrder     Int
  dayOffset     Int // Day 0, Day 1, Day 3...
  sendTime      String        @default("09:00") // 配信時刻 HH:mm
  templateId    String?
  template      DripTemplate? @relation(fields: [templateId], references: [id], onDelete: SetNull)
  conditionType String? // null | not_opened | opened | not_clicked | clicked | opened_not_clicked
  label         String
  createdAt     DateTime      @default(now())

  emailLogs DripEmailLog[]

  @@index([sequenceId])
  @@map("drip_steps")

}
```

## DripEnrollment

領域: 運営・メール配信 / DBテーブル: drip_enrollments / schema.prisma:1913

```prisma
model DripEnrollment {
  id          String       @id @default(cuid())
  userId      String
  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  sequenceId  String
  sequence    DripSequence @relation(fields: [sequenceId], references: [id], onDelete: Cascade)
  enrolledAt  DateTime     @default(now())
  currentStep Int          @default(0)
  status      String       @default("active") // active | completed | cancelled
  completedAt DateTime?
  createdAt   DateTime     @default(now())

  emailLogs DripEmailLog[]

  @@unique([userId, sequenceId])
  @@index([status])
  @@map("drip_enrollments")

}
```

## DripEmailLog

領域: 運営・メール配信 / DBテーブル: drip_email_logs / schema.prisma:1933

```prisma
model DripEmailLog {
  id           String         @id @default(cuid())
  enrollmentId String
  enrollment   DripEnrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)
  stepId       String
  step         DripStep       @relation(fields: [stepId], references: [id], onDelete: Cascade)
  userId       String
  user         User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  sequenceId   String
  sentAt       DateTime       @default(now())
  status       String         @default("queued") // queued | sent | delivered | opened | clicked | bounced | failed
  openedAt     DateTime?
  clickedAt    DateTime?
  bouncedAt    DateTime?
  trackingId   String?        @unique
  createdAt    DateTime       @default(now())

  @@index([enrollmentId])
  @@index([userId])
  @@index([sequenceId])
  @@index([status])
  @@map("drip_email_logs")

}
```

## DripUnsubscribe

領域: 運営・メール配信 / DBテーブル: drip_unsubscribes / schema.prisma:1958

```prisma
model DripUnsubscribe {
  id             String   @id @default(cuid())
  userId         String
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  reason         String?
  unsubscribedAt DateTime @default(now())

  @@index([userId])
  @@map("drip_unsubscribes")

}
```

## DripSetting

領域: 運営・メール配信 / DBテーブル: drip_settings / schema.prisma:1970

```prisma
model DripSetting {
  key   String @id
  value Json

  @@map("drip_settings")

}
```

## AdSimProject

領域: ドヤ広告シミュレーションAI / DBテーブル: ad_sim_projects / schema.prisma:1981

```prisma
model AdSimProject {
  id      String  @id @default(cuid())
  userId  String?
  user    User?   @relation(fields: [userId], references: [id], onDelete: Cascade)
  guestId String?

  // プロジェクト情報
  name   String
  status String @default("draft") // draft | generating | completed | error

  // Step 1: クライアント情報
  clientName     String
  industry       String
  productName    String
  lpUrl          String?
  targetAudience Json? // { age, gender, region, interests }

  // Step 2: 提案目的
  goals        String[] @default([])
  periodMonths Int      @default(3)
  startMonth   String? // YYYY-MM

  // Step 3: 予算・KPI
  monthlyBudget Int // 円
  targetCv      Int?
  targetCpa     Int?
  targetRoas    Float?

  // Step 4: 媒体配分
  mediaAllocation Json // { google: 40, meta: 30, line: 30 }

  // Step 5: 体裁
  proposerName  String?
  proposerEmail String?
  templateId    String  @default("simple")

  // 生成結果
  simulationData Json? // 媒体別×月次の数値
  proposalText   Json? // セクション別のテキスト
  chartData      Json? // グラフ用整形済みデータ

  // 出力ファイル
  pptxUrl  String?
  pdfUrl   String?
  excelUrl String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId, createdAt])
  @@index([guestId])
  @@map("ad_sim_projects")

}
```

## MitsuboshiNagusamePost

領域: 別事業：三ツ星ナグサメ / DBテーブル: mitsuboshi_nagusame_posts / schema.prisma:2042

```prisma
model MitsuboshiNagusamePost {
  id            String                    @id @default(cuid())
  userId        String?
  user          User?                     @relation(fields: [userId], references: [id], onDelete: Cascade)
  guestId       String? // 匿名ユーザー識別（cookie）
  segment       String                    @default("default") // default | business | student | ...
  content       String                    @db.Text // ユーザー投稿（愚痴）
  starsLit      Int                       @default(0) // 灯った星数 = 返信されたキャラ数
  safetyFlagged Boolean                   @default(false) // 危機ワード検知フラグ
  createdAt     DateTime                  @default(now())
  replies       MitsuboshiNagusameReply[]

  @@index([userId, segment, createdAt])
  @@index([guestId, createdAt])
  @@map("mitsuboshi_nagusame_posts")

}
```

## MitsuboshiNagusameReply

領域: 別事業：三ツ星ナグサメ / DBテーブル: mitsuboshi_nagusame_replies / schema.prisma:2059

```prisma
model MitsuboshiNagusameReply {
  id          String                 @id @default(cuid())
  postId      String
  post        MitsuboshiNagusamePost @relation(fields: [postId], references: [id], onDelete: Cascade)
  personaId   String // personas/*.ts の id
  personaName String
  content     String                 @db.Text
  createdAt   DateTime               @default(now())

  @@index([postId])
  @@map("mitsuboshi_nagusame_replies")

}
```

## MitsuboshiNagusameSubscription

領域: 別事業：三ツ星ナグサメ / DBテーブル: mitsuboshi_nagusame_subscriptions / schema.prisma:2072

```prisma
model MitsuboshiNagusameSubscription {
  id               String    @id @default(cuid())
  userId           String    @unique
  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  plan             String    @default("free") // free | pro
  stripeCustomerId String?
  stripeSubId      String?   @unique
  currentPeriodEnd DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  @@map("mitsuboshi_nagusame_subscriptions")

}
```

## HrOrganization

領域: ドヤHR / DBテーブル: hr_organizations / schema.prisma:2090

```prisma
model HrOrganization {
  id          String  @id @default(cuid())
  name        String
  slug        String  @unique
  logoUrl     String? @db.Text
  industry    String?
  size        String?
  address     String? @db.Text
  website     String?
  fiscalMonth Int     @default(4)

  evaluationType  String @default("MBO")
  evaluationCycle String @default("SEMI")

  customFields Json?

  // Stripe（組織レベル課金）
  stripeCustomerId       String?   @unique
  stripeSubscriptionId   String?   @unique
  stripePriceId          String?
  stripeCurrentPeriodEnd DateTime?
  plan                   String    @default("FREE")

  // AI使用量（月次）
  aiUsageCount   Int      @default(0)
  aiUsageResetAt DateTime @default(now())

  members           HrOrganizationMember[]
  departments       HrDepartment[]
  employees         HrEmployee[]
  evaluationPeriods HrEvaluationPeriod[]
  oneOnOnes         HrOneOnOne[]
  invitations       HrInvitation[]
  auditLogs         HrAuditLog[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([slug])
  @@map("hr_organizations")

}
```

## HrOrganizationMember

領域: ドヤHR / DBテーブル: hr_organization_members / schema.prisma:2132

```prisma
model HrOrganizationMember {
  id             String         @id @default(cuid())
  organizationId String
  organization   HrOrganization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  role   String @default("MEMBER")

  invitedEmail String?
  invitedAt    DateTime?
  acceptedAt   DateTime?
  status       String    @default("ACTIVE")

  employeeId String? @unique

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([organizationId, userId])
  @@index([userId])
  @@index([organizationId, role])
  @@map("hr_organization_members")

}
```

## HrDepartment

領域: ドヤHR / DBテーブル: hr_departments / schema.prisma:2157

```prisma
model HrDepartment {
  id             String         @id @default(cuid())
  organizationId String
  organization   HrOrganization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  name      String
  code      String?
  parentId  String?
  parent    HrDepartment?  @relation("DepartmentTree", fields: [parentId], references: [id])
  children  HrDepartment[] @relation("DepartmentTree")
  managerId String?
  sortOrder Int            @default(0)
  isActive  Boolean        @default(true)

  employees HrEmployee[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([organizationId, code])
  @@index([organizationId, parentId])
  @@index([organizationId, isActive])
  @@map("hr_departments")

}
```

## HrEmployee

領域: ドヤHR / DBテーブル: hr_employees / schema.prisma:2182

```prisma
model HrEmployee {
  id             String         @id @default(cuid())
  organizationId String
  organization   HrOrganization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  employeeNumber String?
  lastName       String
  firstName      String
  lastNameKana   String?
  firstNameKana  String?
  email          String?
  phone          String?

  photoUrl     String? @db.Text
  thumbnailUrl String? @db.Text

  departmentId   String?
  department     HrDepartment? @relation(fields: [departmentId], references: [id], onDelete: SetNull)
  position       String?
  grade          String?
  employmentType String        @default("FULL_TIME")

  hireDate   DateTime?
  resignDate DateTime?
  status     String    @default("ACTIVE")

  birthDate DateTime?
  gender    String?

  customFieldValues Json?
  notes             String? @db.Text

  evaluations         HrEvaluation[]      @relation("EmployeeEvaluations")
  evaluationsGiven    HrEvaluation[]      @relation("EvaluatorRelation")
  oneOnOnesAsEmployee HrOneOnOne[]        @relation("EmployeeOneOnOne")
  oneOnOnesAsManager  HrOneOnOne[]        @relation("ManagerOneOnOne")
  histories           HrEmployeeHistory[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([organizationId, employeeNumber])
  @@index([organizationId, status])
  @@index([organizationId, departmentId])
  @@index([organizationId, lastName, firstName])
  @@map("hr_employees")

}
```

## HrEmployeeHistory

領域: ドヤHR / DBテーブル: hr_employee_histories / schema.prisma:2230

```prisma
model HrEmployeeHistory {
  id         String     @id @default(cuid())
  employeeId String
  employee   HrEmployee @relation(fields: [employeeId], references: [id], onDelete: Cascade)

  changeType         String
  previousDepartment String?
  newDepartment      String?
  previousPosition   String?
  newPosition        String?
  previousGrade      String?
  newGrade           String?

  effectiveDate DateTime
  endDate       DateTime?
  reason        String?   @db.Text

  createdAt DateTime @default(now())

  @@index([employeeId, effectiveDate])
  @@index([employeeId, changeType])
  @@map("hr_employee_histories")

}
```

## HrEvaluationPeriod

領域: ドヤHR / DBテーブル: hr_evaluation_periods / schema.prisma:2254

```prisma
model HrEvaluationPeriod {
  id             String         @id @default(cuid())
  organizationId String
  organization   HrOrganization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  name      String
  startDate DateTime
  endDate   DateTime
  status    String   @default("DRAFT")

  evaluationTemplate Json?

  evaluations HrEvaluation[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([organizationId, status])
  @@index([organizationId, startDate])
  @@map("hr_evaluation_periods")

}
```

## HrEvaluation

領域: ドヤHR / DBテーブル: hr_evaluations / schema.prisma:2276

```prisma
model HrEvaluation {
  id String @id @default(cuid())

  periodId String
  period   HrEvaluationPeriod @relation(fields: [periodId], references: [id], onDelete: Cascade)

  employeeId String
  employee   HrEmployee @relation("EmployeeEvaluations", fields: [employeeId], references: [id], onDelete: Cascade)

  evaluatorId String?
  evaluator   HrEmployee? @relation("EvaluatorRelation", fields: [evaluatorId], references: [id], onDelete: SetNull)

  goals        Json?
  competencies Json?

  selfRating    Int?
  managerRating Int?
  finalRating   Int?

  selfComment    String? @db.Text
  managerComment String? @db.Text
  aiComment      String? @db.Text

  status      String    @default("DRAFT")
  submittedAt DateTime?
  reviewedAt  DateTime?
  finalizedAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([periodId, employeeId])
  @@index([employeeId, status])
  @@index([periodId, status])
  @@map("hr_evaluations")

}
```

## HrOneOnOne

領域: ドヤHR / DBテーブル: hr_one_on_ones / schema.prisma:2313

```prisma
model HrOneOnOne {
  id             String         @id @default(cuid())
  organizationId String
  organization   HrOrganization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  employeeId String
  employee   HrEmployee @relation("EmployeeOneOnOne", fields: [employeeId], references: [id], onDelete: Cascade)

  managerId String
  manager   HrEmployee @relation("ManagerOneOnOne", fields: [managerId], references: [id], onDelete: Cascade)

  scheduledAt DateTime?
  conductedAt DateTime?
  duration    Int?

  agenda        Json?
  managerNotes  String? @db.Text
  employeeNotes String? @db.Text
  privateNotes  String? @db.Text

  aiSummary     String? @db.Text
  aiActionItems Json?
  aiInsights    Json?

  status String @default("SCHEDULED")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([organizationId, scheduledAt])
  @@index([employeeId, scheduledAt])
  @@index([managerId, scheduledAt])
  @@map("hr_one_on_ones")

}
```

## HrInvitation

領域: ドヤHR / DBテーブル: hr_invitations / schema.prisma:2348

```prisma
model HrInvitation {
  id             String @id @default(cuid())
  organizationId String

  email     String
  role      String @default("MEMBER")
  token     String @unique
  invitedBy String

  status     String    @default("PENDING")
  expiresAt  DateTime
  acceptedAt DateTime?

  organization HrOrganization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@index([organizationId])
  @@index([email, status])
  @@index([token])
  @@map("hr_invitations")

}
```

## HrAuditLog

領域: ドヤHR / DBテーブル: hr_audit_logs / schema.prisma:2371

```prisma
model HrAuditLog {
  id             String         @id @default(cuid())
  organizationId String
  organization   HrOrganization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  userId    String
  userName  String?
  action    String
  target    String
  targetId  String?
  details   Json?
  ipAddress String?

  createdAt DateTime @default(now())

  @@index([organizationId, createdAt])
  @@index([organizationId, action])
  @@index([userId])
  @@map("hr_audit_logs")

}
```

## KintaiOrganization

領域: ドヤ勤怠 / DBテーブル: kintai_organizations / schema.prisma:2396

```prisma
model KintaiOrganization {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  members     KintaiMember[]
  departments KintaiDepartment[]
  workRules   KintaiWorkRule[]

  @@map("kintai_organizations")

}
```

## KintaiMember

領域: ドヤ勤怠 / DBテーブル: kintai_members / schema.prisma:2410

```prisma
model KintaiMember {
  id             String             @id @default(cuid())
  organizationId String
  organization   KintaiOrganization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  userId         String
  role           String             @default("employee") // system_admin, hr_admin, manager, employee
  status         String             @default("ACTIVE") // ACTIVE, PENDING, INACTIVE
  inviteToken    String?            @unique
  inviteEmail    String?
  acceptedAt     DateTime?
  createdAt      DateTime           @default(now())

  employee KintaiEmployee?

  @@unique([organizationId, userId])
  @@map("kintai_members")

}
```

## KintaiDepartment

領域: ドヤ勤怠 / DBテーブル: kintai_departments / schema.prisma:2428

```prisma
model KintaiDepartment {
  id             String             @id @default(cuid())
  organizationId String
  organization   KintaiOrganization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name           String
  parentId       String?
  parent         KintaiDepartment?  @relation("DeptHierarchy", fields: [parentId], references: [id])
  children       KintaiDepartment[] @relation("DeptHierarchy")
  managerId      String?
  createdAt      DateTime           @default(now())

  employees KintaiEmployee[]

  @@map("kintai_departments")

}
```

## KintaiWorkRule

領域: ドヤ勤怠 / DBテーブル: kintai_work_rules / schema.prisma:2444

```prisma
model KintaiWorkRule {
  id                 String             @id @default(cuid())
  organizationId     String
  organization       KintaiOrganization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name               String
  workStart          String             @default("09:00")
  workEnd            String             @default("18:00")
  breakMinutes       Int                @default(60)
  overtimeCalcMethod String             @default("daily") // daily, weekly, monthly
  flexEnabled        Boolean            @default(false)
  coreStart          String?
  coreEnd            String?
  createdAt          DateTime           @default(now())

  employees KintaiEmployee[]

  @@map("kintai_work_rules")

}
```

## KintaiEmployee

領域: ドヤ勤怠 / DBテーブル: kintai_employees / schema.prisma:2463

```prisma
model KintaiEmployee {
  id             String            @id @default(cuid())
  organizationId String
  memberId       String            @unique
  member         KintaiMember      @relation(fields: [memberId], references: [id], onDelete: Cascade)
  departmentId   String?
  department     KintaiDepartment? @relation(fields: [departmentId], references: [id])
  workRuleId     String?
  workRule       KintaiWorkRule?   @relation(fields: [workRuleId], references: [id])
  name           String
  nameKana       String?
  email          String
  employmentType String            @default("full_time") // full_time, part_time, contract
  hireDate       DateTime?
  isActive       Boolean           @default(true)
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  clockRecords KintaiClockRecord[]
  attendances  KintaiAttendance[]
  requests     KintaiRequest[]     @relation("EmployeeRequests")
  reviewed     KintaiRequest[]     @relation("ReviewerRequests")

  @@map("kintai_employees")

}
```

## KintaiClockRecord

領域: ドヤ勤怠 / DBテーブル: kintai_clock_records / schema.prisma:2489

```prisma
model KintaiClockRecord {
  id                String         @id @default(cuid())
  employeeId        String
  employee          KintaiEmployee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  type              String // clock_in, clock_out, break_start, break_end
  timestamp         DateTime
  source            String         @default("pc") // pc, mobile, manual
  latitude          Float?
  longitude         Float?
  ipAddress         String?
  note              String?        @db.Text
  isModified        Boolean        @default(false)
  originalTimestamp DateTime?
  createdAt         DateTime       @default(now())

  @@index([employeeId, timestamp])
  @@map("kintai_clock_records")

}
```

## KintaiAttendance

領域: ドヤ勤怠 / DBテーブル: kintai_attendances / schema.prisma:2508

```prisma
model KintaiAttendance {
  id                String         @id @default(cuid())
  employeeId        String
  employee          KintaiEmployee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  date              DateTime       @db.Date
  clockIn           DateTime?
  clockOut          DateTime?
  breakMinutes      Int            @default(0)
  workMinutes       Int            @default(0)
  overtimeMinutes   Int            @default(0)
  lateMinutes       Int            @default(0)
  earlyLeaveMinutes Int            @default(0)
  nightMinutes      Int            @default(0)
  holidayWork       Boolean        @default(false)
  status            String         @default("normal") // normal, absent, holiday, paid_leave, special_leave
  note              String?        @db.Text
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt

  @@unique([employeeId, date])
  @@index([employeeId, date])
  @@map("kintai_attendances")

}
```

## KintaiRequest

領域: ドヤ勤怠 / DBテーブル: kintai_requests / schema.prisma:2532

```prisma
model KintaiRequest {
  id              String          @id @default(cuid())
  employeeId      String
  employee        KintaiEmployee  @relation("EmployeeRequests", fields: [employeeId], references: [id], onDelete: Cascade)
  type            String // clock_fix, leave, overtime, holiday_work
  status          String          @default("pending") // pending, approved, rejected, withdrawn
  details         Json            @default("{}")
  reason          String?         @db.Text
  submittedAt     DateTime        @default(now())
  reviewedAt      DateTime?
  reviewerId      String?
  reviewer        KintaiEmployee? @relation("ReviewerRequests", fields: [reviewerId], references: [id])
  reviewerComment String?         @db.Text
  createdAt       DateTime        @default(now())

  @@index([employeeId, status])
  @@map("kintai_requests")

}
```

## PromaneWorkspace

領域: ドヤプロマネ / DBテーブル: promane_workspaces / schema.prisma:2555

```prisma
model PromaneWorkspace {
  id          String              @id @default(cuid())
  userId      String
  user        User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  name        String
  slug        String              @unique
  members     PromaneMember[]
  clients     PromaneClient[]
  projects    PromaneProject[]
  invitations PromaneInvitation[]
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt

  @@index([userId])
  @@map("promane_workspaces")

}
```

## PromaneMember

領域: ドヤプロマネ / DBテーブル: promane_members / schema.prisma:2572

```prisma
model PromaneMember {
  id          String             @id @default(cuid())
  workspaceId String
  userId      String
  role        String             @default("member")
  displayName String
  hourlyRate  Int                @default(0)
  isActive    Boolean            @default(true)
  workspace   PromaneWorkspace   @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  user        User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  tasks       PromaneTask[]      @relation("PromaneTaskAssignee")
  timeEntries PromaneTimeEntry[]
  comments    PromaneComment[]
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt

  @@unique([workspaceId, userId])
  @@index([userId])
  @@map("promane_members")

}
```

## PromaneClient

領域: ドヤプロマネ / DBテーブル: promane_clients / schema.prisma:2593

```prisma
model PromaneClient {
  id          String           @id @default(cuid())
  workspaceId String
  name        String
  contactName String?
  email       String?
  phone       String?
  address     String?
  note        String?          @db.Text
  workspace   PromaneWorkspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  projects    PromaneProject[]
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  @@index([workspaceId])
  @@map("promane_clients")

}
```

## PromaneProject

領域: ドヤプロマネ / DBテーブル: promane_projects / schema.prisma:2611

```prisma
model PromaneProject {
  id             String           @id @default(cuid())
  workspaceId    String
  clientId       String?
  name           String
  description    String?          @db.Text
  status         String           @default("draft")
  billingType    String           @default("fixed")
  contractAmount Int              @default(0)
  monthlyAmount  Int?
  hourlyRate     Int?
  estimatedHours Int?
  startDate      DateTime?
  endDate        DateTime?
  tags           String?
  workspace      PromaneWorkspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  client         PromaneClient?   @relation(fields: [clientId], references: [id], onDelete: SetNull)
  tasks          PromaneTask[]
  expenses       PromaneExpense[]
  timeEntries    PromaneTimeEntry[]
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  @@index([workspaceId])
  @@map("promane_projects")

}
```

## PromaneTask

領域: ドヤプロマネ / DBテーブル: promane_tasks / schema.prisma:2638

```prisma
model PromaneTask {
  id          String             @id @default(cuid())
  projectId   String
  parentId    String?
  assigneeId  String?
  title       String
  description String?            @db.Text
  status      String             @default("todo")
  priority    String             @default("medium")
  startDate   DateTime?
  dueDate     DateTime?
  order       Int                @default(0)
  project     PromaneProject     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  parent      PromaneTask?       @relation("PromaneSubTasks", fields: [parentId], references: [id])
  children    PromaneTask[]      @relation("PromaneSubTasks")
  assignee    PromaneMember?     @relation("PromaneTaskAssignee", fields: [assigneeId], references: [id], onDelete: SetNull)
  timeEntries PromaneTimeEntry[]
  comments    PromaneComment[]
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt

  @@index([projectId])
  @@map("promane_tasks")

}
```

## PromaneTimeEntry

領域: ドヤプロマネ / DBテーブル: promane_time_entries / schema.prisma:2663

```prisma
model PromaneTimeEntry {
  id        String        @id @default(cuid())
  taskId    String?
  projectId String?
  project   PromaneProject? @relation(fields: [projectId], references: [id], onDelete: SetNull)
  memberId  String
  duration  Int
  hourlyRateSnapshot Int?          // 工数登録時の時給。移行前の記録は当時値が不明なため移行時点の時給で補完する
  date      DateTime
  note      String?
  task      PromaneTask?  @relation(fields: [taskId], references: [id], onDelete: SetNull)
  member    PromaneMember @relation(fields: [memberId], references: [id], onDelete: Cascade)
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt

  @@index([memberId])
  @@index([projectId])
  @@map("promane_time_entries")

}
```

## PromaneExpense

領域: ドヤプロマネ / DBテーブル: promane_expenses / schema.prisma:2683

```prisma
model PromaneExpense {
  id          String         @id @default(cuid())
  projectId   String
  category    String
  amount      Int
  description String
  date        DateTime
  project     PromaneProject @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  @@index([projectId])
  @@map("promane_expenses")

}
```

## PromaneComment

領域: ドヤプロマネ / DBテーブル: promane_comments / schema.prisma:2698

```prisma
model PromaneComment {
  id        String        @id @default(cuid())
  taskId    String
  memberId  String
  content   String        @db.Text
  task      PromaneTask   @relation(fields: [taskId], references: [id], onDelete: Cascade)
  member    PromaneMember @relation(fields: [memberId], references: [id], onDelete: Cascade)
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt

  @@index([taskId])
  @@map("promane_comments")

}
```

## PromaneInvitation

領域: ドヤプロマネ / DBテーブル: promane_invitations / schema.prisma:2716

```prisma
model PromaneInvitation {
  id          String    @id @default(cuid())
  workspaceId String
  email       String
  role        String    @default("member") // owner / admin / member / guest
  token       String    @unique
  invitedById String
  acceptedAt  DateTime?
  expiresAt   DateTime
  createdAt   DateTime  @default(now())

  workspace PromaneWorkspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  invitedBy User             @relation("PromaneInvitationInvitedBy", fields: [invitedById], references: [id], onDelete: Cascade)

  @@index([workspaceId])
  @@index([token])
  @@map("promane_invitations")

}
```

## DoyalistProject

領域: ドヤリスト / DBテーブル: doyalist_projects / schema.prisma:2739

```prisma
model DoyalistProject {
  id          String   @id @default(cuid())
  userId      String
  name        String
  description String?  @db.Text
  industry    String?
  region      String?
  targetSize  String? // 大企業、中小、スタートアップ等
  keywords    String?  @db.Text
  status      String   @default("active") // active, archived
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  companies  DoyalistCompany[]
  approaches DoyalistApproach[]

  @@index([userId])
  @@index([userId, status])
  @@index([userId, createdAt])
  @@map("doyalist_projects")

}
```

## DoyalistCompany

領域: ドヤリスト / DBテーブル: doyalist_companies / schema.prisma:2761

```prisma
model DoyalistCompany {
  id            String          @id @default(cuid())
  projectId     String
  project       DoyalistProject @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name          String
  website       String?
  industry      String?
  region        String?
  size          String? // 従業員数規模
  description   String?         @db.Text
  contactEmail  String?
  contactPhone  String?
  contactPerson String?
  notes         String?         @db.Text
  enrichedData  Json? // AI分析詳細データ
  score         Int? // 営業優先度スコア（0-100）
  status        String          @default("new") // new, contacted, replied, won, lost
  source        String? // collected, manual, imported
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  approaches DoyalistApproach[]

  @@index([projectId])
  @@index([status])
  @@index([projectId, status])
  @@index([projectId, createdAt])
  @@map("doyalist_companies")

}
```

## DoyalistApproach

領域: ドヤリスト / DBテーブル: doyalist_approaches / schema.prisma:2791

```prisma
model DoyalistApproach {
  id         String           @id @default(cuid())
  projectId  String
  project    DoyalistProject  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  companyId  String?
  company    DoyalistCompany? @relation(fields: [companyId], references: [id], onDelete: SetNull)
  type       String // email, dm, phone, letter
  subject    String?
  body       String           @db.Text
  templateId String?
  status     String           @default("draft") // draft, sent, replied
  createdAt  DateTime         @default(now())
  updatedAt  DateTime         @updatedAt

  @@index([projectId])
  @@index([companyId])
  @@index([projectId, createdAt])
  @@map("doyalist_approaches")

}
```

## DoyalistTemplate

領域: ドヤリスト / DBテーブル: doyalist_templates / schema.prisma:2811

```prisma
model DoyalistTemplate {
  id        String   @id @default(cuid())
  userId    String
  name      String
  type      String // email, dm, phone, letter
  subject   String?
  body      String   @db.Text
  isDefault Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@map("doyalist_templates")

}
```

## DoyaSlideProject

領域: ドヤスライド / DBテーブル: doyaslide_projects / schema.prisma:2829

```prisma
model DoyaSlideProject {
  id          String  @id @default(cuid())
  userId      String
  title       String
  docType     String  @default("proposal") // sales/proposal/sns/seminar/recruit/pitch/internal/custom
  customBrief String? @db.Text // docType=custom 時の自由入力
  slideCount  Int     @default(8)
  aspectRatio String  @default("wide") // wide(1536x1024) / square(1024x1024) / vertical(1024x1536)
  themeColor  String  @default("#7f19e6")
  stylePreset String  @default("flashy") // flashy/luxury/pop/minimal/cyber/handwritten
  status      String  @default("draft") // draft/structuring/generating/completed/error

  // ロゴ設定（右上に枠を空けて最後に合成）
  logoUrl         String?
  logoPosition    String  @default("top-right")
  logoSize        String  @default("M") // S/M/L
  logoBackingChip Boolean @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  slides DoyaSlideSlide[]
  assets DoyaSlideAsset[]

  @@index([userId])
  @@index([userId, status])
  @@index([userId, createdAt])
  @@map("doyaslide_projects")

}
```

## DoyaSlideSlide

領域: ドヤスライド / DBテーブル: doyaslide_slides / schema.prisma:2859

```prisma
model DoyaSlideSlide {
  id           String           @id @default(cuid())
  projectId    String
  project      DoyaSlideProject @relation(fields: [projectId], references: [id], onDelete: Cascade)
  index        Int
  role         String? // 表紙/課題/解決/実績/CTA など
  headline     String?
  subText      String?          @db.Text
  visualPrompt String           @db.Text // 画像生成用のビジュアル指示
  basePrompt   String?          @db.Text // 累積プロンプト（チャット修正を蓄積）
  rawImageUrl  String? // ロゴ合成前
  imageUrl     String? // ロゴ合成後（表示用）
  version      Int              @default(1)
  status       String           @default("pending") // pending/generating/done/error
  model        String? // 実際に生成に使われたモデル（gpt-image-2 / nano-banana-pro-preview）

  versions     DoyaSlideVersion[]
  chatMessages DoyaSlideChatMessage[]

  @@unique([projectId, index])
  @@index([projectId])
  @@map("doyaslide_slides")

}
```

## DoyaSlideAsset

領域: ドヤスライド / DBテーブル: doyaslide_assets / schema.prisma:2883

```prisma
model DoyaSlideAsset {
  id        String           @id @default(cuid())
  projectId String
  project   DoyaSlideProject @relation(fields: [projectId], references: [id], onDelete: Cascade)
  type      String           @default("logo")
  fileUrl   String
  createdAt DateTime         @default(now())

  @@index([projectId])
  @@map("doyaslide_assets")

}
```

## DoyaSlideChatMessage

領域: ドヤスライド / DBテーブル: doyaslide_chat_messages / schema.prisma:2895

```prisma
model DoyaSlideChatMessage {
  id             String         @id @default(cuid())
  slideId        String
  slide          DoyaSlideSlide @relation(fields: [slideId], references: [id], onDelete: Cascade)
  role           String // user / assistant
  content        String         @db.Text
  appliedChanges Json?
  createdAt      DateTime       @default(now())

  @@index([slideId])
  @@map("doyaslide_chat_messages")

}
```

## DoyaSlideVersion

領域: ドヤスライド / DBテーブル: doyaslide_versions / schema.prisma:2908

```prisma
model DoyaSlideVersion {
  id          String         @id @default(cuid())
  slideId     String
  slide       DoyaSlideSlide @relation(fields: [slideId], references: [id], onDelete: Cascade)
  version     Int
  imageUrl    String
  rawImageUrl String?
  prompt      String?        @db.Text
  createdAt   DateTime       @default(now())

  @@index([slideId])
  @@map("doyaslide_versions")

}
```

## CunningSession

領域: ドヤカンニング / DBテーブル: cunning_sessions / schema.prisma:2925

```prisma
model CunningSession {
  id                 String    @id @default(cuid())
  userId             String
  mode               String    @default("sales") // sales（商談）/ interview（面接）
  title              String    @default("無題のセッション")
  knowledgeBaseId    String? // sales: 参照ナレッジ
  companyProfileId   String? // interview: 参照企業
  applicantProfileId String? // interview: 応募者プロフィール
  personaNote        String?   @db.Text // 任意の前提/キャラ設定（エンタメ:口調・世界観 / ビジネス:補足）
  report             Json? // 終了時に生成する議事録＋評価（summary/decisions/todos/score/feedback/good/improve）
  status             String    @default("active") // active / ended
  durationSec        Int       @default(0) // 文字起こし時間（使用量計上の単位）
  recordingVersion   Int       @default(1) // 1: legacy cumulative client; 2: server lease protocol
  startedAt          DateTime  @default(now())
  endedAt            DateTime?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  transcripts CunningTranscript[]
  answers     CunningAnswer[]
  recordingLease CunningRecordingLease?
  usageAllocations CunningUsageAllocation[]
  audioWindows CunningAudioWindow[]

  @@index([userId])
  @@index([userId, createdAt])
  @@map("cunning_sessions")

}
```

## CunningRecordingLease

領域: ドヤカンニング / DBテーブル: cunning_recording_leases / schema.prisma:2955

```prisma
model CunningRecordingLease {
  sessionId String @id
  session CunningSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  userId String
  token String @unique @default(uuid())
  requestKey String
  startedAt DateTime
  audioProtocol String? // Selected atomically by the first audio admission/reservation.
  settledThrough DateTime
  expiresAt DateTime
  stoppedAt DateTime?
  finalRemoteAcceptedAt DateTime?
  finalSelfAcceptedAt DateTime?
  finalAnswerClaimedAt DateTime?
  finalAnswerInputHash String?
  finalAnswerAttempts Int @default(0)
  finalRemoteInputHash String?
  finalSelfInputHash String?
  finalRemoteClaimedAt DateTime?
  finalSelfClaimedAt DateTime?
  finalRemoteAttempts Int @default(0)
  finalSelfAttempts Int @default(0)
  @@index([userId, stoppedAt])
  @@map("cunning_recording_leases")

}
```

## CunningUsageAllocation

領域: ドヤカンニング / DBテーブル: cunning_usage_allocations / schema.prisma:2981

```prisma
model CunningUsageAllocation {
  sessionId String
  session CunningSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  userId String
  monthStart DateTime
  usedMs BigInt @default(0)
  reservedMs BigInt @default(0)
  @@id([sessionId, monthStart])
  @@index([userId, monthStart])
  @@map("cunning_usage_allocations")

}
```

## CunningTranscript

領域: ドヤカンニング / DBテーブル: cunning_transcripts / schema.prisma:2993

```prisma
model CunningTranscript {
  id        String         @id @default(cuid())
  sessionId String
  session   CunningSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  speaker   String? // remote（相手）/ self（自分）
  text      String         @db.Text
  isFinal   Boolean        @default(true)
  audioReceivedAt DateTime?
  recordingFinal Boolean  @default(false)
  finalAnswer CunningAnswer? @relation("CunningFinalAnswer")
  audioWindow CunningAudioWindow?
  startMs   Int?
  endMs     Int?
  createdAt DateTime       @default(now())

  @@index([sessionId])
  @@map("cunning_transcripts")

}
```

## CunningAudioWindow

領域: ドヤカンニング / DBテーブル: cunning_audio_windows / schema.prisma:3013

```prisma
model CunningAudioWindow {
  id String @id @default(uuid())
  sessionId String
  session CunningSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  recordingToken String
  speaker String
  sequence Int
  requestKey String
  reservedAt DateTime
  inputHash String?
  claimToken String?
  claimedAt DateTime?
  attempts Int @default(0)
  transcriptId String? @unique
  transcript CunningTranscript? @relation(fields: [transcriptId], references: [id], onDelete: Restrict)

  @@unique([sessionId, recordingToken, speaker, sequence], map: "cunning_audio_window_sequence_key")
  @@unique([sessionId, recordingToken, speaker, requestKey], map: "cunning_audio_window_request_key")
  @@map("cunning_audio_windows")

}
```

## CunningAnswer

領域: ドヤカンニング / DBテーブル: cunning_answers / schema.prisma:3034

```prisma
model CunningAnswer {
  id           String         @id @default(cuid())
  sessionId    String
  session      CunningSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  questionText String         @db.Text
  finalTranscriptId String? @unique
  finalTranscript CunningTranscript? @relation("CunningFinalAnswer", fields: [finalTranscriptId], references: [id], onDelete: Cascade)
  summary      String         @db.Text // 要点（一言回答）
  script       String         @db.Text // 話すスクリプト
  sources      Json? // 参照した根拠チップ
  model        String?
  latencyMs    Int?
  createdAt    DateTime       @default(now())

  @@index([sessionId])
  @@map("cunning_answers")

}
```

## CunningKnowledgeBase

領域: ドヤカンニング / DBテーブル: cunning_knowledge_bases / schema.prisma:3052

```prisma
model CunningKnowledgeBase {
  id          String   @id @default(cuid())
  userId      String
  name        String
  description String?  @db.Text
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  chunks CunningKnowledgeChunk[]

  @@index([userId])
  @@map("cunning_knowledge_bases")

}
```

## CunningKnowledgeChunk

領域: ドヤカンニング / DBテーブル: cunning_knowledge_chunks / schema.prisma:3066

```prisma
model CunningKnowledgeChunk {
  id              String               @id @default(cuid())
  knowledgeBaseId String
  knowledgeBase   CunningKnowledgeBase @relation(fields: [knowledgeBaseId], references: [id], onDelete: Cascade)
  content         String               @db.Text
  sourceUrl       String?
  sourceLabel     String?
  embedding       Json? // pgvector未導入のためJSON保存（MVP）
  createdAt       DateTime             @default(now())

  @@index([knowledgeBaseId])
  @@map("cunning_knowledge_chunks")

}
```

## CunningCompanyProfile

領域: ドヤカンニング / DBテーブル: cunning_company_profiles / schema.prisma:3080

```prisma
model CunningCompanyProfile {
  id              String   @id @default(cuid())
  userId          String
  url             String
  companyName     String?
  businessSummary String?  @db.Text
  requirements    Json? // 求める人物像・職務内容・バリュー等
  rawText         String?  @db.Text
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([userId])
  @@map("cunning_company_profiles")

}
```

## CunningApplicantProfile

領域: ドヤカンニング / DBテーブル: cunning_applicant_profiles / schema.prisma:3095

```prisma
model CunningApplicantProfile {
  id         String   @id @default(cuid())
  userId     String
  name       String   @default("マイプロフィール")
  resume     String?  @db.Text
  motivation String?  @db.Text
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([userId])
  @@map("cunning_applicant_profiles")

}
```

## SfaOrganization

領域: ドヤ営業管理 / DBテーブル: sfa_organizations / schema.prisma:3111

```prisma
model SfaOrganization {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  members SfaMember[]

  @@map("sfa_organizations")

}
```

## SfaMember

領域: ドヤ営業管理 / DBテーブル: sfa_members / schema.prisma:3123

```prisma
model SfaMember {
  id             String          @id @default(cuid())
  organizationId String
  organization   SfaOrganization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  userId         String?
  role           String          @default("member") // owner / admin / manager / member
  status         String          @default("ACTIVE") // ACTIVE / PENDING / INACTIVE
  name           String?
  inviteEmail    String?
  inviteToken    String?         @unique
  acceptedAt     DateTime?
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  @@unique([organizationId, userId])
  @@index([organizationId])
  @@index([userId])
  @@map("sfa_members")

}
```

## SfaAccount

領域: ドヤ営業管理 / DBテーブル: sfa_accounts / schema.prisma:3143

```prisma
model SfaAccount {
  id              String   @id @default(cuid())
  organizationId  String
  name            String
  corporateNumber String?
  industry        String?
  prefecture      String?
  address         String?  @db.Text
  url             String?
  employeeCount   Int?
  capital         BigInt?
  creditRank      String?
  ownerMemberId   String? // 自社担当
  tags            Json?
  note            String?  @db.Text
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([organizationId])
  @@index([organizationId, name])
  @@map("sfa_accounts")

}
```

## SfaContact

領域: ドヤ営業管理 / DBテーブル: sfa_contacts / schema.prisma:3167

```prisma
model SfaContact {
  id             String   @id @default(cuid())
  organizationId String
  accountId      String?
  name           String
  nameKana       String?
  title          String?
  department     String?
  email          String?
  phone          String?
  isKeyPerson    Boolean  @default(false)
  note           String?  @db.Text
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([organizationId])
  @@index([organizationId, accountId])
  @@map("sfa_contacts")

}
```

## SfaLead

領域: ドヤ営業管理 / DBテーブル: sfa_leads / schema.prisma:3188

```prisma
model SfaLead {
  id                 String   @id @default(cuid())
  organizationId     String
  name               String // 企業名 or 個人
  corporateNumber    String?
  contactName        String?
  email              String?
  phone              String?
  status             String   @default("new") // new/working/nurturing/qualified/converted/disqualified
  score              Int?
  source             String   @default("manual") // doyalist/csv/manual
  assigneeMemberId   String?
  convertedAccountId String?
  note               String?  @db.Text
  raw                Json?
  isActive           Boolean  @default(true)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@index([organizationId, status])
  @@map("sfa_leads")

}
```

## SfaPipeline

領域: ドヤ営業管理 / DBテーブル: sfa_pipelines / schema.prisma:3211

```prisma
model SfaPipeline {
  id             String   @id @default(cuid())
  organizationId String
  name           String   @default("標準パイプライン")
  isDefault      Boolean  @default(true)
  createdAt      DateTime @default(now())

  stages SfaStage[]

  @@index([organizationId])
  @@map("sfa_pipelines")

}
```

## SfaStage

領域: ドヤ営業管理 / DBテーブル: sfa_stages / schema.prisma:3224

```prisma
model SfaStage {
  id          String      @id @default(cuid())
  pipelineId  String
  pipeline    SfaPipeline @relation(fields: [pipelineId], references: [id], onDelete: Cascade)
  name        String
  order       Int
  probability Int         @default(0)
  color       String      @default("#22c55e")
  isWon       Boolean     @default(false)
  isLost      Boolean     @default(false)

  @@index([pipelineId])
  @@map("sfa_stages")

}
```

## SfaDeal

領域: ドヤ営業管理 / DBテーブル: sfa_deals / schema.prisma:3239

```prisma
model SfaDeal {
  id                String    @id @default(cuid())
  organizationId    String
  accountId         String?
  contactId         String?
  name              String
  amount            BigInt    @default(0)
  currency          String    @default("JPY")
  stageId           String?
  probability       Int       @default(0)
  startDate         DateTime? // 商談日（開始日）。経過期間の起点に使う
  expectedCloseDate DateTime?
  contactName       String? // 先方担当者名（フリーテキスト。担当者マスタを使わない運用向け）
  note              String?   @db.Text // 商談メモ
  status            String    @default("open") // open/won/lost
  wonAt             DateTime?
  lostAt            DateTime?
  lostReason        String?
  assigneeMemberId  String?
  lastActivityAt    DateTime?
  isActive          Boolean   @default(true)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  lineItems SfaLineItem[]

  @@index([organizationId, stageId])
  @@index([organizationId, status])
  @@map("sfa_deals")

}
```

## SfaLineItem

領域: ドヤ営業管理 / DBテーブル: sfa_line_items / schema.prisma:3270

```prisma
model SfaLineItem {
  id          String  @id @default(cuid())
  dealId      String
  deal        SfaDeal @relation(fields: [dealId], references: [id], onDelete: Cascade)
  productName String
  quantity    Int     @default(1)
  unitPrice   BigInt  @default(0)
  amount      BigInt  @default(0)

  @@index([dealId])
  @@map("sfa_line_items")

}
```

## SfaActivity

領域: ドヤ営業管理 / DBテーブル: sfa_activities / schema.prisma:3283

```prisma
model SfaActivity {
  id             String   @id @default(cuid())
  organizationId String
  type           String // call/meeting/email/note
  accountId      String?
  contactId      String?
  dealId         String?
  subject        String?
  body           String?  @db.Text
  occurredAt     DateTime @default(now())
  durationMin    Int?
  memberId       String?
  aiSummary      String?  @db.Text
  transcriptId   String?
  createdAt      DateTime @default(now())

  @@index([organizationId, occurredAt])
  @@index([organizationId, dealId])
  @@map("sfa_activities")

}
```

## SfaTask

領域: ドヤ営業管理 / DBテーブル: sfa_tasks / schema.prisma:3304

```prisma
model SfaTask {
  id               String    @id @default(cuid())
  organizationId   String
  title            String
  dueDate          DateTime?
  status           String    @default("open") // open/done
  priority         String    @default("normal")
  accountId        String?
  dealId           String?
  assigneeMemberId String?
  completedAt      DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  @@index([organizationId, assigneeMemberId, status])
  @@map("sfa_tasks")

}
```

## ShodanOrganization

領域: ドヤ商談準備 / DBテーブル: shodan_organizations / schema.prisma:3327

```prisma
model ShodanOrganization {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  members      ShodanMember[]
  profile      ShodanCompanyProfile?
  preparations ShodanPreparation[]

  @@map("shodan_organizations")

}
```

## ShodanMember

領域: ドヤ商談準備 / DBテーブル: shodan_members / schema.prisma:3341

```prisma
model ShodanMember {
  id             String             @id @default(cuid())
  organizationId String
  organization   ShodanOrganization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  userId         String?
  role           String             @default("member") // owner / admin / manager / member
  status         String             @default("ACTIVE") // ACTIVE / PENDING / INACTIVE
  name           String?
  inviteEmail    String?
  inviteToken    String?            @unique
  acceptedAt     DateTime?
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt

  @@unique([organizationId, userId])
  @@index([organizationId])
  @@index([userId])
  @@map("shodan_members")

}
```

## ShodanCompanyProfile

領域: ドヤ商談準備 / DBテーブル: shodan_company_profiles / schema.prisma:3362

```prisma
model ShodanCompanyProfile {
  id             String             @id @default(cuid())
  organizationId String             @unique
  organization   ShodanOrganization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  companyName    String? // 自社名
  url            String? // 自社URL
  description    String?            @db.Text // 事業内容
  valueProp      String?            @db.Text // 提供価値・強み・USP
  products       String?            @db.Text // 主な商材・サービス
  targetCustomer String?            @db.Text // ターゲット顧客像
  pricingNote    String?            @db.Text // 価格帯・導入条件など
  caseStudies    String?            @db.Text // 導入事例・実績
  logoPath       String? // 自社ロゴ（shodan非公開バケットのパス。スライドに合成）
  brandColors    Json? // ブランドカラー ["#RRGGBB", ...]（スライドのテーマ色に反映）
  research       Json? // 自社URLを解析した結果（任意）
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt

  @@map("shodan_company_profiles")

}
```

## ShodanPreparation

領域: ドヤ商談準備 / DBテーブル: shodan_preparations / schema.prisma:3384

```prisma
model ShodanPreparation {
  id                String             @id @default(cuid())
  organizationId    String
  organization      ShodanOrganization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  createdByMemberId String?
  // 入力
  targetUrl         String
  targetName        String? // 解析で判明した相手企業名
  // 進行状態
  status            String             @default("processing") // processing / done / failed
  errorMessage      String?            @db.Text
  // 成果物
  research          Json? // 深掘り調査（公開従業員数/マーケ実施状況/オウンドメディアの有無・所在 等）
  analysis          Json? // 現状分析・課題仮説・解決策
  proposalMarkdown  String?            @db.Text // 提案資料（Markdown）
  slidesJson        Json? // 提案スライド構成（ProposalSlide[]）
  slideImages       Json? // 画像スライド（[{ title, imageUrl, role }]・ドヤスライド方式でgpt-image-2生成）
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt

  @@index([organizationId, createdAt])
  @@map("shodan_preparations")

}
```

## AdBannerCampaign

領域: ドヤ広告バナーAI / DBテーブル: adbanner_campaign / schema.prisma:3412

```prisma
model AdBannerCampaign {
  id          String   @id @default(cuid())
  userId      String? // 未ログインゲストは null + guestId
  guestId     String?
  name        String
  sourceUrl   String?
  serviceName String?
  appeal      String?  @db.Text
  brandColors Json? // ["#7f19e6", ...]
  logoPath    String? // Supabase Storage のロゴパス
  media       String? // meta / google / line / x ...
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  banners AdBannerCreative[]

  @@index([userId, createdAt])
  @@index([guestId, createdAt])
  @@map("adbanner_campaign")

}
```

## AdBannerCreative

領域: ドヤ広告バナーAI / DBテーブル: adbanner_creative / schema.prisma:3433

```prisma
model AdBannerCreative {
  id           String           @id @default(cuid())
  campaignId   String
  campaign     AdBannerCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  imagePath    String // 生成画像 (Supabase Storage)
  size         String // 1080x1080 等
  prompt       String           @db.Text
  variantLabel String? // 訴求/トーンのバリエーション
  generation   Int              @default(1) // 改善世代 (Phase2)
  parentId     String? // 元バナー (Phase2)
  model        String? // 使用モデル / fallbackUsed
  feedback     Json? // { visibility, appeal, cta, fit, brand, total, advice }
  metrics      Json? // Phase2: { imp, click, ctr, spend, cv, cpa }
  createdAt    DateTime         @default(now())

  @@index([campaignId, createdAt])
  @@map("adbanner_creative")

}
```

## AioOrganization

領域: ドヤAIO / DBテーブル: aio_organizations / schema.prisma:3458

```prisma
model AioOrganization {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  members AioMember[]
  profile AioBrandProfile?
  prompts AioPrompt[]
  scans   AioScan[]
  results AioResult[]

  @@map("aio_organizations")

}
```

## AioMember

領域: ドヤAIO / DBテーブル: aio_members / schema.prisma:3474

```prisma
model AioMember {
  id             String          @id @default(cuid())
  organizationId String
  organization   AioOrganization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  userId         String?
  role           String          @default("member") // owner / admin / manager / member
  status         String          @default("ACTIVE") // ACTIVE / PENDING / INACTIVE
  name           String?
  inviteEmail    String?
  inviteToken    String?         @unique
  acceptedAt     DateTime?
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  @@unique([organizationId, userId])
  @@index([organizationId])
  @@index([userId])
  @@map("aio_members")

}
```

## AioBrandProfile

領域: ドヤAIO / DBテーブル: aio_brand_profiles / schema.prisma:3495

```prisma
model AioBrandProfile {
  id             String          @id @default(cuid())
  organizationId String          @unique
  organization   AioOrganization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  brandName      String? // 追跡する自社ブランド名
  brandUrl       String? // 自社サイトURL（自社ドメイン引用率の判定に使う）
  aliases        Json? // 別名・表記ゆれ ["キャリーミー","CARRY ME"]
  competitors    Json? // 競合ブランド名 ["HiPro","lotsful", ...]
  category       String? // カテゴリ（例: プロ人材 業務委託マッチング）
  market         String? // 市場・地域（例: 日本）
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  @@map("aio_brand_profiles")

}
```

## AioPrompt

領域: ドヤAIO / DBテーブル: aio_prompts / schema.prisma:3512

```prisma
model AioPrompt {
  id             String          @id @default(cuid())
  organizationId String
  organization   AioOrganization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  text           String          @db.Text
  category       String? // 任意の分類タグ
  isActive       Boolean         @default(true)
  archivedAt     DateTime?
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  results AioResult[]

  @@index([organizationId])
  @@map("aio_prompts")

}
```

## AioScan

領域: ドヤAIO / DBテーブル: aio_scans / schema.prisma:3530

```prisma
model AioScan {
  id             String          @id @default(cuid())
  organizationId String
  organization   AioOrganization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  status         String          @default("processing") // processing / done / failed / deleted (content removed, usage retained)
  engines        Json? // 実行したエンジン ["chatgpt","gemini","claude","perplexity"]
  repetitions    Int             @default(3) // 1プロンプト×1エンジンあたりの反復回数
  errorMessage   String?         @db.Text
  // 集計サマリ（このスキャン時点のスナップショット）
  awarenessPct   Float? // ブランド認知度（言及した割合 0-100）
  shareOfVoice   Float? // SoV（追跡ブランド中の自社シェア 0-100）
  sentimentPos   Float? // ポジ割合
  sentimentNeu   Float?
  sentimentNeg   Float?
  ownCitationPct Float? // 自社ドメイン引用率
  summary        Json? // { perEngine, sov[], citations[], promptBreakdown[] } 全文
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  results AioResult[]

  @@index([organizationId, createdAt])
  @@map("aio_scans")

}
```

## AioResult

領域: ドヤAIO / DBテーブル: aio_results / schema.prisma:3556

```prisma
model AioResult {
  id             String          @id @default(cuid())
  organizationId String
  organization   AioOrganization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  scanId         String
  scan           AioScan         @relation(fields: [scanId], references: [id], onDelete: Cascade)
  promptId       String
  prompt         AioPrompt       @relation(fields: [promptId], references: [id], onDelete: Cascade)
  engine         String // chatgpt / gemini / claude / perplexity
  iteration      Int             @default(0)
  brandMentioned Boolean         @default(false)
  brandRank      Int? // リスト内の自社の位置（1始まり、無ければ null）
  sentiment      String? // positive / neutral / negative
  competitors    Json? // この回答に出た競合名[]
  citations      Json? // 引用URL[]（Perplexity等の検索エンジン）
  answerText     String?         @db.Text // 回答本文（短縮保存）
  createdAt      DateTime        @default(now())

  @@index([scanId])
  @@index([organizationId, createdAt])
  @@map("aio_results")

}
```

## MensetsuOrganization

領域: ドヤ面接官 / DBテーブル: mensetsu_organizations / schema.prisma:3585

```prisma
model MensetsuOrganization {
  id                  String   @id @default(cuid())
  name                String
  slug                String   @unique
  // 組織設定
  recordVideo         Boolean  @default(false) // 映像収録（既定OFF。音声のみでも評価は成立する）
  // 音声ファイルそのものの保存。既定OFF。
  // ⚠️ 文字起こしの保存と、音声そのものの保存は別の同意事項。
  //    ONにすると同意画面の文面も「音声を録音して保存する」に変わる。
  recordAudio         Boolean  @default(false)
  retentionDays       Int      @default(180) // 逐語ログ・録音の保持日数
  discloseToCandidate Boolean  @default(false) // 応募者本人へのスコア開示
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  members   MensetsuMember[]
  profiles  MensetsuCompanyProfile[]
  templates MensetsuTemplate[]
  sessions  MensetsuSession[]
  samples   MensetsuAnswerSample[]

  @@map("mensetsu_organizations")

}
```

## MensetsuMember

領域: ドヤ面接官 / DBテーブル: mensetsu_members / schema.prisma:3609

```prisma
model MensetsuMember {
  id             String               @id @default(cuid())
  organizationId String
  organization   MensetsuOrganization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  userId         String?
  role           String               @default("member") // owner / admin / manager / member
  status         String               @default("ACTIVE") // ACTIVE / PENDING / INACTIVE
  name           String?
  inviteEmail    String?
  inviteToken    String?              @unique
  acceptedAt     DateTime?
  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt

  @@unique([organizationId, userId])
  @@index([organizationId])
  @@index([userId])
  @@map("mensetsu_members")

}
```

## MensetsuCompanyProfile

領域: ドヤ面接官 / DBテーブル: mensetsu_company_profiles / schema.prisma:3630

```prisma
model MensetsuCompanyProfile {
  id             String               @id @default(cuid())
  organizationId String
  organization   MensetsuOrganization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  sourceUrl      String
  companyName    String?
  business       String?              @db.Text // 事業内容
  valueProp      String?              @db.Text // 提供価値
  culture        String?              @db.Text // カルチャー・行動指針
  idealProfile   String?              @db.Text // 求める人物像
  raw            Json? // スクレイプ原文・gBizINFO等の生データ
  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt

  templates MensetsuTemplate[]

  @@index([organizationId])
  @@map("mensetsu_company_profiles")

}
```

## MensetsuTemplate

領域: ドヤ面接官 / DBテーブル: mensetsu_templates / schema.prisma:3651

```prisma
model MensetsuTemplate {
  id             String                  @id @default(cuid())
  organizationId String
  organization   MensetsuOrganization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  profileId      String?
  profile        MensetsuCompanyProfile? @relation(fields: [profileId], references: [id], onDelete: SetNull)
  name           String
  jobTitle       String // 職種
  level          String                  @default("mid") // newgrad / mid / manager
  durationMin    Int                     @default(10) // 10 / 20 / 30（既定は10分。20分は長すぎるという声を受け 2026-08-31 に変更）
  intro          String?                 @db.Text // 冒頭の挨拶・進め方
  closing        String?                 @db.Text
  status         String                  @default("draft") // draft / active / archived
  createdAt      DateTime                @default(now())
  updatedAt      DateTime                @updatedAt

  questions MensetsuQuestion[]
  criteria  MensetsuCriterion[]
  sessions  MensetsuSession[]

  @@index([organizationId])
  @@map("mensetsu_templates")

}
```

## MensetsuQuestion

領域: ドヤ面接官 / DBテーブル: mensetsu_questions / schema.prisma:3675

```prisma
model MensetsuQuestion {
  id            String           @id @default(cuid())
  templateId    String
  template      MensetsuTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  ord           Int
  text          String           @db.Text // 主質問（全応募者に共通）
  followUpHint  String?          @db.Text // 深掘りの方針（最大2回まで）
  targetMin     Int              @default(3) // 想定所要分
  criterionKeys String[]         @default([]) // 紐づく評価軸のkey
  branches      MensetsuBranch[]
  createdAt     DateTime         @default(now())

  @@index([templateId])
  @@map("mensetsu_questions")

}
```

## MensetsuBranch

領域: ドヤ面接官 / DBテーブル: mensetsu_branches / schema.prisma:3698

```prisma
model MensetsuBranch {
  id         String           @id @default(cuid())
  questionId String
  question   MensetsuQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)
  ord        Int
  /// 枝の名前（例: 「マネジメント経験あり」）。フロー図に出す
  label      String
  /// どんな回答ならこの枝か（回答の分類に使う手がかり）
  matchHint  String           @db.Text
  /// この枝で尋ねる深掘り質問。空なら質問せず次へ進む
  text       String?          @db.Text
  /// 指定があればこの主質問(ord)まで飛ばす。null なら次の主質問へ
  skipToOrd  Int?
  createdAt  DateTime         @default(now())

  @@index([questionId, ord])
  @@map("mensetsu_branches")

}
```

## MensetsuCriterion

領域: ドヤ面接官 / DBテーブル: mensetsu_criteria / schema.prisma:3717

```prisma
model MensetsuCriterion {
  id          String           @id @default(cuid())
  templateId  String
  template    MensetsuTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  key         String // 英数キー（question との紐付けに使う）
  name        String // 評価軸名
  description String?          @db.Text
  rubric      Json // { "1": "...", "2": "...", ... "5": "..." }
  weight      Int              @default(1)
  ord         Int              @default(0)
  createdAt   DateTime         @default(now())

  scores MensetsuScore[]

  @@unique([templateId, key])
  @@index([templateId])
  @@map("mensetsu_criteria")

}
```

## MensetsuSession

領域: ドヤ面接官 / DBテーブル: mensetsu_sessions / schema.prisma:3737

```prisma
model MensetsuSession {
  id             String               @id @default(cuid())
  organizationId String
  organization   MensetsuOrganization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  templateId     String
  template       MensetsuTemplate     @relation(fields: [templateId], references: [id], onDelete: Cascade)

  token          String   @unique // ワンタイム面接URL
  candidateName  String?
  candidateEmail String?
  expiresAt      DateTime

  status      String    @default("pending") // pending / consented / live / completed / evaluated / expired / aborted
  // 同意ログ（C1）
  consentedAt DateTime?
  consentIp   String?
  consentUa   String?   @db.Text

  startedAt       DateTime?
  endedAt         DateTime?
  // Realtime の ephemeral token 発行回数。
  // 未認証で叩ける口なので、1つの面接URLから無制限に資格情報を作られると
  // 共有APIキーへの従量課金とレート制限の枯渇に直結する。上限判定に使う。
  tokenIssueCount Int       @default(0)
  currentIndex    Int       @default(0) // 進行中の質問index
  followUpCount   Int       @default(0) // 現質問での深掘り回数
  recordingPath   String? // Supabase Storage のパス
  purgeAfter      DateTime? // 保持期限（C5のcronが削除する）

  // 評価結果（面接後バッチ）
  verdict           String? // recommend / conditional / hold / reject
  overallComment    String?   @db.Text
  candidateFeedback String?   @db.Text // 応募者向け（別文面）
  recruiterReport   String?   @db.Text // 採用担当者向け（別文面）
  evaluatedAt       DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  turns           MensetsuTurn[]
  scores          MensetsuScore[]
  /// ドヤHRへ引き渡した従業員ID。
  /// ⚠️ 二重登録を防ぐために持つ。面接AIの判定ではなく、担当者が採用を決めて
  ///    明示的に押したときだけ入る（自動同期はしない）。
  hrEmployeeId    String?
  /// 同意画面でのメール照合の失敗回数。
  /// ⚠️ ワンタイムURLは本人以外の手に渡りうる。総当たりで本人になりすませないよう上限を設ける。
  consentAttempts Int             @default(0)

  @@index([organizationId, status])
  @@index([templateId])
  @@map("mensetsu_sessions")

}
```

## MensetsuTurn

領域: ドヤ面接官 / DBテーブル: mensetsu_turns / schema.prisma:3791

```prisma
model MensetsuTurn {
  id          String          @id @default(cuid())
  sessionId   String
  session     MensetsuSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  ord         Int
  speaker     String // interviewer / candidate
  text        String          @db.Text
  questionOrd Int? // どの主質問に紐づく発話か
  startMs     Int?
  endMs       Int?
  createdAt   DateTime        @default(now())

  @@index([sessionId, ord])
  @@map("mensetsu_turns")

}
```

## MensetsuScore

領域: ドヤ面接官 / DBテーブル: mensetsu_scores / schema.prisma:3807

```prisma
model MensetsuScore {
  id           String            @id @default(cuid())
  sessionId    String
  session      MensetsuSession   @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  criterionId  String
  criterion    MensetsuCriterion @relation(fields: [criterionId], references: [id], onDelete: Cascade)
  score        Int? // 1-5。判定不能なら null（F2-4: 推測で埋めない）
  insufficient Boolean           @default(false) // 情報不足
  rationale    String?           @db.Text
  quotes       String[]          @default([]) // 根拠となる応募者の発言の引用
  createdAt    DateTime          @default(now())

  @@unique([sessionId, criterionId])
  @@index([sessionId])
  @@map("mensetsu_scores")

}
```

## MensetsuAnswerSample

領域: ドヤ面接官 / DBテーブル: mensetsu_answer_samples / schema.prisma:3825

```prisma
model MensetsuAnswerSample {
  id             String               @id @default(cuid())
  organizationId String
  organization   MensetsuOrganization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  criterionKey   String
  questionText   String               @db.Text
  answerText     String               @db.Text
  label          String // good / bad
  note           String?              @db.Text
  createdAt      DateTime             @default(now())

  @@index([organizationId, criterionKey])
  @@map("mensetsu_answer_samples")

}
```

## QuoteOrganization

領域: ドヤ見積もりAI / DBテーブル: quote_organizations / schema.prisma:3846

```prisma
model QuoteOrganization {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  members   QuoteMember[]
  issuer    QuoteIssuer?
  products  QuoteProduct[]
  documents QuoteDocument[]

  @@map("quote_organizations")

}
```

## QuoteMember

領域: ドヤ見積もりAI / DBテーブル: quote_members / schema.prisma:3861

```prisma
model QuoteMember {
  id             String            @id @default(cuid())
  organizationId String
  organization   QuoteOrganization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  userId         String?
  role           String            @default("member") // owner / admin / manager / member
  status         String            @default("ACTIVE")
  name           String?
  inviteEmail    String?
  inviteToken    String?           @unique
  acceptedAt     DateTime?
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  @@unique([organizationId, userId])
  @@index([organizationId])
  @@index([userId])
  @@map("quote_members")

}
```

## QuoteIssuer

領域: ドヤ見積もりAI / DBテーブル: quote_issuers / schema.prisma:3882

```prisma
model QuoteIssuer {
  id             String            @id @default(cuid())
  organizationId String            @unique
  organization   QuoteOrganization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  companyName    String
  postalCode     String?
  address        String?
  tel            String?
  personName     String?
  /// 適格請求書発行事業者の登録番号（T+13桁）。見積書は適格請求書ではないが記載が一般的
  invoiceNo      String?
  logoPath       String?
  sealPath       String?
  /// 既定の支払条件・納期・備考
  paymentTerms   String?           @db.Text
  deliveryTerms  String?           @db.Text
  notes          String?           @db.Text
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  @@map("quote_issuers")

}
```

## QuoteProduct

領域: ドヤ見積もりAI / DBテーブル: quote_products / schema.prisma:3906

```prisma
model QuoteProduct {
  id             String            @id @default(cuid())
  organizationId String
  organization   QuoteOrganization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name           String
  sourceUrl      String?
  /// 提供形態・課金軸・想定顧客・公開価格など
  profile        Json?
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  documents QuoteDocument[]

  @@index([organizationId])
  @@map("quote_products")

}
```

## QuoteDocument

領域: ドヤ見積もりAI / DBテーブル: quote_documents / schema.prisma:3923

```prisma
model QuoteDocument {
  id             String            @id @default(cuid())
  organizationId String
  organization   QuoteOrganization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  productId      String?
  product        QuoteProduct?     @relation(fields: [productId], references: [id], onDelete: SetNull)

  /// 見積書番号（自動採番）
  quoteNo       String
  title         String
  clientCompany String?
  clientDept    String?
  clientPerson  String?
  issueDate     DateTime @default(now())
  expiryDate    DateTime
  paymentTerms  String?  @db.Text
  deliveryTerms String?  @db.Text
  notes         String?  @db.Text

  /// 値引き（rate=率 / amount=額）
  discountType  String?
  discountValue Int     @default(0)

  /// draft / confirmed / sent
  /// ⚠️ AIが出した金額をそのまま客先に出させないため、確定は人の明示操作にする
  status      String    @default("draft")
  confirmedBy String?
  confirmedAt DateTime?
  sentAt      DateTime?

  /// 金額は整数（円）で保持する。浮動小数だと丸め誤差が実害になる
  totalExclTax Int @default(0)
  taxAmount    Int @default(0)
  totalInclTax Int @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  lineItems QuoteLineItem[]

  @@unique([organizationId, quoteNo])
  @@index([organizationId, status])
  @@map("quote_documents")

}
```

## QuoteLineItem

領域: ドヤ見積もりAI / DBテーブル: quote_line_items / schema.prisma:3968

```prisma
model QuoteLineItem {
  id          String        @id @default(cuid())
  documentId  String
  document    QuoteDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)
  ord         Int
  itemName    String
  spec        String?       @db.Text
  qty         Int           @default(1)
  unit        String        @default("式")
  /// 単価（円・整数）
  unitPrice   Int           @default(0)
  /// 税率（10 / 8）
  taxRate     Int           @default(10)
  /// 金額の出所。own_price / market / competitor / manual / unknown
  /// ⚠️ 根拠のない金額を出さないための記録。unknown は「要見積」として空欄表示する
  priceSource String        @default("manual")
  sourceRef   String?       @db.Text
  /// 相場の下限・上限（参考表示用）
  rangeMin    Int?
  rangeMax    Int?
  createdAt   DateTime      @default(now())

  @@index([documentId, ord])
  @@map("quote_line_items")

}
```

## AishodanOrganization

領域: ドヤAI商談 / DBテーブル: aishodan_organizations / schema.prisma:4004

```prisma
model AishodanOrganization {
  id            String   @id @default(cuid())
  name          String
  slug          String   @unique
  /// 商談ログの保持日数
  retentionDays Int      @default(180)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  members  AishodanMember[]
  products AishodanProduct[]
  rooms    AishodanRoom[]
  sessions AishodanSession[]

  @@map("aishodan_organizations")

}
```

## AishodanMember

領域: ドヤAI商談 / DBテーブル: aishodan_members / schema.prisma:4021

```prisma
model AishodanMember {
  id             String               @id @default(cuid())
  organizationId String
  organization   AishodanOrganization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  userId         String?
  role           String               @default("member")
  status         String               @default("ACTIVE")
  name           String?
  inviteEmail    String?
  inviteToken    String?              @unique
  acceptedAt     DateTime?
  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt

  @@unique([organizationId, userId])
  @@index([organizationId])
  @@index([userId])
  @@map("aishodan_members")

}
```

## AishodanProduct

領域: ドヤAI商談 / DBテーブル: aishodan_products / schema.prisma:4042

```prisma
model AishodanProduct {
  id             String               @id @default(cuid())
  organizationId String
  organization   AishodanOrganization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name           String
  sourceUrl      String?
  /// 一言説明・提供価値・ICP・料金・FAQ・話してはいけないこと
  profile        Json?
  archivedAt     DateTime?
  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt

  sources   AishodanSource[]
  chunks    AishodanChunk[]
  scenarios AishodanScenario[]

  @@index([organizationId])
  @@map("aishodan_products")

}
```

## AishodanSource

領域: ドヤAI商談 / DBテーブル: aishodan_sources / schema.prisma:4062

```prisma
model AishodanSource {
  id        String          @id @default(cuid())
  productId String
  product   AishodanProduct @relation(fields: [productId], references: [id], onDelete: Cascade)
  /// url / manual
  type      String          @default("url")
  url       String?
  title     String?
  rawText   String          @db.Text
  createdAt DateTime        @default(now())

  chunks AishodanChunk[]

  @@index([productId])
  @@map("aishodan_sources")

}
```

## AishodanChunk

領域: ドヤAI商談 / DBテーブル: aishodan_chunks / schema.prisma:4080

```prisma
model AishodanChunk {
  id        String          @id @default(cuid())
  productId String
  product   AishodanProduct @relation(fields: [productId], references: [id], onDelete: Cascade)
  sourceId  String
  source    AishodanSource  @relation(fields: [sourceId], references: [id], onDelete: Cascade)
  ord       Int
  text      String          @db.Text
  createdAt DateTime        @default(now())

  @@index([productId])
  @@index([sourceId, ord])
  @@map("aishodan_chunks")

}
```

## AishodanScenario

領域: ドヤAI商談 / DBテーブル: aishodan_scenarios / schema.prisma:4096

```prisma
model AishodanScenario {
  id          String          @id @default(cuid())
  productId   String
  product     AishodanProduct @relation(fields: [productId], references: [id], onDelete: Cascade)
  name        String
  /// [{ key, name, goal, exitCondition, maxTurns }]
  phases      Json
  /// [{ key, label, type, required, questionHint }]
  slots       Json
  /// { conditions: [{ key, label, weight, match }] }
  icp         Json
  /// { pricePolicy, competitorPolicy, prohibitedTopics[], noEvidenceBehavior }
  guardrails  Json
  /// { tone, firstPerson, maxCharsPerUtterance }
  persona     Json?
  durationMin Int             @default(10)

  /// 日程調整ページのURL（Calendly / TimeRex / Googleカレンダー予約 など）
  /// ⚠️ 一次商談の出口は「次アポの確定」。ここが空だと商談が終わっても次につながらない。
  /// ⚠️ 見込み客の画面にボタンとして出るため、保存時に https のみ許可する。
  schedulingUrl   String?
  /// ボタンの文言。空なら既定文言を使う
  schedulingLabel String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  rooms AishodanRoom[]

  @@index([productId])
  @@map("aishodan_scenarios")

}
```

## AishodanRoom

領域: ドヤAI商談 / DBテーブル: aishodan_rooms / schema.prisma:4130

```prisma
model AishodanRoom {
  id             String               @id @default(cuid())
  organizationId String
  organization   AishodanOrganization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  scenarioId     String
  scenario       AishodanScenario     @relation(fields: [scenarioId], references: [id], onDelete: Cascade)
  name           String
  token          String               @unique
  /// 空なら無期限
  expiresAt      DateTime?
  isActive       Boolean              @default(true)
  /// この部屋で開始できる商談の総数。乱用を止める最後の砦
  maxSessions    Int                  @default(500)

  /// ホストの練習用ルーム。
  /// ⚠️ 練習は**本番と同じコードパス**を通さないと品質調整の意味がないため、
  ///    専用の仕組みを作らず通常のルームに印を付ける方式にした。
  /// ⚠️ 練習の商談は指標・無料枠の数え上げ・Slack通知から除外する。
  ///    ログは残す（何を話したかを見るのが練習の目的そのもの）。
  isPreview    Boolean  @default(false)
  sessionCount Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  sessions AishodanSession[]

  @@index([organizationId])
  @@map("aishodan_rooms")

}
```

## AishodanSession

領域: ドヤAI商談 / DBテーブル: aishodan_sessions / schema.prisma:4160

```prisma
model AishodanSession {
  id             String               @id @default(cuid())
  organizationId String
  organization   AishodanOrganization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  roomId         String
  room           AishodanRoom         @relation(fields: [roomId], references: [id], onDelete: Cascade)

  /// 未ログインの見込み客を識別するCookie値
  guestId      String
  guestName    String?
  guestCompany String?
  guestEmail   String?

  /// pending / live / completed / evaluated / aborted / expired
  status       String    @default("pending")
  /// 現在のフェーズのキー
  currentPhase String    @default("opening")
  consentedAt  DateTime?
  startedAt    DateTime?
  endedAt      DateTime?

  /// ⚠️ Realtime の ephemeral token 発行回数。未認証で叩ける口なので上限を持つ
  tokenIssueCount Int @default(0)

  referrer String?
  utm      Json?

  /// 日程調整ボタンを押した時刻。
  /// ⚠️ 一次商談の成果はここ。押されたかどうかが分からないと、
  ///    商談が次につながったのかを誰も判断できない。
  schedulingClickedAt DateTime?

  purgeAfter DateTime?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  turns      AishodanTurn[]
  slotValues AishodanSlotValue[]
  questions  AishodanQuestion[]
  outcome    AishodanOutcome?

  @@index([organizationId, status])
  @@index([roomId])
  @@index([guestId])
  @@map("aishodan_sessions")

}
```

## AishodanTurn

領域: ドヤAI商談 / DBテーブル: aishodan_turns / schema.prisma:4207

```prisma
model AishodanTurn {
  id        String          @id @default(cuid())
  sessionId String
  session   AishodanSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  ord       Int
  /// ai / guest
  speaker   String
  text      String          @db.Text
  phase     String?
  /// 発話の開始時刻（ms）。⚠️ 終了時刻で並べると長い発話が後ろにずれる（mensetsuで踏んだ）
  startMs   Int             @default(0)
  createdAt DateTime        @default(now())

  questions AishodanQuestion[]

  @@index([sessionId, ord])
  @@map("aishodan_turns")

}
```

## AishodanQuestion

領域: ドヤAI商談 / DBテーブル: aishodan_questions / schema.prisma:4227

```prisma
model AishodanQuestion {
  id            String          @id @default(cuid())
  sessionId     String
  session       AishodanSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  turnId        String?
  turn          AishodanTurn?   @relation(fields: [turnId], references: [id], onDelete: SetNull)
  text          String          @db.Text
  answerText    String?         @db.Text
  citedChunkIds String[]        @default([])
  /// ⚠️ 根拠が無いのに答えを作らせない。答えられなかったことを記録する側に倒す
  unanswered    Boolean         @default(false)
  createdAt     DateTime        @default(now())

  @@index([sessionId])
  @@map("aishodan_questions")

}
```

## AishodanSlotValue

領域: ドヤAI商談 / DBテーブル: aishodan_slot_values / schema.prisma:4244

```prisma
model AishodanSlotValue {
  id           String          @id @default(cuid())
  sessionId    String
  session      AishodanSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  key          String
  value        String          @db.Text
  confidence   Float           @default(0.5)
  sourceTurnId String?
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  @@unique([sessionId, key])
  @@index([sessionId])
  @@map("aishodan_slot_values")

}
```

## AishodanOutcome

領域: ドヤAI商談 / DBテーブル: aishodan_outcomes / schema.prisma:4260

```prisma
model AishodanOutcome {
  id           String          @id @default(cuid())
  sessionId    String          @unique
  session      AishodanSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  /// 0-100。⚠️ 参考値であり、最終判断は人が行う
  fitScore     Int
  /// hot / warm / cold / unfit
  verdict      String
  reason       String          @db.Text
  summary      Json?
  nextAction   String?         @db.Text
  /// 人が上書きしたら記録する（上書きは改善の材料になる）
  overriddenBy String?
  overriddenAt DateTime?
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  @@map("aishodan_outcomes")

}
```

## AdImageBrand

領域: ドヤ広告画像AI / DBテーブル: adimage_brand / schema.prisma:4289

```prisma
model AdImageBrand {
  id          String   @id @default(cuid())
  userId      String?
  guestId     String?
  name        String
  sourceUrl   String?
  description String?  @db.Text
  valueProps  Json?
  colors      Json?
  logoPath    String?
  logoConfig  Json?
  industry    String?
  tone        String?
  ngWords     Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  campaigns AdImageCampaign[]

  @@index([userId, createdAt])
  @@index([guestId, createdAt])
  @@map("adimage_brand")

}
```

## AdImageCampaign

領域: ドヤ広告画像AI / DBテーブル: adimage_campaign / schema.prisma:4313

```prisma
model AdImageCampaign {
  id         String       @id @default(cuid())
  brandId    String
  brand      AdImageBrand @relation(fields: [brandId], references: [id], onDelete: Cascade)
  userId     String?
  guestId    String?
  name       String
  objective  String?
  appeal     String?      @db.Text
  /// 選択した配置キー ["meta.story", ...]
  placements Json
  createdAt  DateTime     @default(now())
  updatedAt  DateTime     @updatedAt

  concepts AdImageConcept[]

  @@index([userId, createdAt])
  @@index([guestId, createdAt])
  @@map("adimage_campaign")

}
```

## AdImageConcept

領域: ドヤ広告画像AI / DBテーブル: adimage_concept / schema.prisma:4334

```prisma
model AdImageConcept {
  id             String          @id @default(cuid())
  campaignId     String
  campaign       AdImageCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  label          String
  appealAxis     String
  tone           String
  /// { headline, sub, cta } ＝焼き込む文字列。OCR照合の正解データでもある
  copy           Json
  compositionKey String
  /// 生成サイズごとの原本 { "1152x2048": "path" }
  genPaths       Json
  /// ⚠️ 完全なプロンプト全文。refine の差分適用の土台になるため必ず保存する
  visualPrompt   String          @db.Text
  /// 選ばれたデザイン参考（banner_template.templateId）と、そこから読み取った作風。
  /// ⚠️ 保存しないと「改善」で作風と構図が失われ、まったく別の絵になる。
  ///    実際に改善のたびに別物が出ていた（2026-09-02）。
  designRefId    String?
  designRefStyle String?         @db.Text
  model          String?
  generation     Int             @default(1)
  /// 改善元コンセプト
  parentId       String?
  createdAt      DateTime        @default(now())

  creatives AdImageCreative[]
  feedbacks AdImageFeedback[]

  @@index([campaignId, createdAt])
  @@map("adimage_concept")

}
```

## AdImageCreative

領域: ドヤ広告画像AI / DBテーブル: adimage_creative / schema.prisma:4366

```prisma
model AdImageCreative {
  id             String         @id @default(cuid())
  conceptId      String
  concept        AdImageConcept @relation(fields: [conceptId], references: [id], onDelete: Cascade)
  placementKey   String
  /// 目標サイズ "1080x1920"
  size           String
  /// 生成サイズ "1152x2048"（縮小のみで書き出したことの記録）
  genSize        String
  compositionKey String
  imagePath      String
  /// { ocrMatch, extraText, safeAreaOk, retries }
  verify         Json?
  /// { textAreaPct, contrast }
  inspect        Json?
  createdAt      DateTime       @default(now())

  feedbacks AdImageFeedback[]

  @@index([conceptId])
  @@index([placementKey])
  @@map("adimage_creative")

}
```

## AdImageFeedback

領域: ドヤ広告画像AI / DBテーブル: adimage_feedback / schema.prisma:4390

```prisma
model AdImageFeedback {
  id         String           @id @default(cuid())
  conceptId  String
  concept    AdImageConcept   @relation(fields: [conceptId], references: [id], onDelete: Cascade)
  creativeId String?
  creative   AdImageCreative? @relation(fields: [creativeId], references: [id], onDelete: SetNull)
  /// ai_vision / ai_inspect / user_chip / user_text
  source     String
  scores     Json?
  advice     String?          @db.Text
  /// ⚠️ 構造化された改善指示。文字列連結だと何を指示したか後から追えない（adbannerの欠陥4）
  directive  Json?
  applied    Boolean          @default(false)
  resultId   String?
  createdAt  DateTime         @default(now())

  @@index([conceptId, createdAt])
  @@map("adimage_feedback")

}
```

## ServiceFeedback

領域: 共通基盤・認証・課金 / DBテーブル: service_feedback / schema.prisma:4417

```prisma
model ServiceFeedback {
  id        String @id @default(cuid())
  userId    String
  user      User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  /// services.ts の id（'quote' / 'aishodan' 等）
  serviceId String

  /// 満足度 1〜5。⚠️ 任意。必須にすると書いてもらえる数が減る
  rating Int?
  /// 改善点・要望の本文
  text   String @db.Text

  /// 何回目の利用で表示したか（どのタイミングの声かを後から見るため）
  usageCount Int @default(0)

  createdAt DateTime @default(now())

  @@index([serviceId, createdAt])
  @@index([userId])
  @@map("service_feedback")

}
```

## FeedbackPromptState

領域: 共通基盤・認証・課金 / DBテーブル: feedback_prompt_state / schema.prisma:4440

```prisma
model FeedbackPromptState {
  id     String @id @default(cuid())
  userId String @unique
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  /// 「あとで」を押されたら、この時刻まで出さない
  snoozeUntil DateTime?
  /// 直近に表示した時刻。⚠️ サービスを続けて使っても連続で出さないために見る
  lastShownAt DateTime?
  /// 「今後は表示しない」を選ばれた。以後は一切出さない
  optedOut    Boolean   @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("feedback_prompt_state")

}
```

## CaseStudyApplication

領域: 共通基盤・認証・課金 / DBテーブル: case_study_application / schema.prisma:4461

```prisma
model CaseStudyApplication {
  id           String  @id @default(cuid())
  companyName  String
  contactName  String
  email        String
  serviceUrl   String?
  // 利用中のドヤAIサービス（複数）
  usingService String?
  // 掲載可否の内訳
  allowLogo    Boolean @default(true)
  allowName    Boolean @default(true)
  // 取材の希望（日程感・オンライン可否など自由記述）
  preferredAt  String?
  note         String? @db.Text

  // 申込時にログインしていれば紐づける（未ログインでも申し込める）
  userId String?

  // 運営側の進行状況: new / contacted / scheduled / done / declined
  status String @default("new")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status])
  @@index([createdAt])
  @@map("case_study_application")

}
```

## PersonaImagePurgeTask

領域: ドヤペルソナAI / DBテーブル: persona_image_purge_tasks / schema.prisma:4492

```prisma
model PersonaImagePurgeTask {
  projectId String @id
  readyAt DateTime
  attemptedAt DateTime?
  @@index([readyAt])
  @@map("persona_image_purge_tasks")

}
```

## PersonaProject

領域: ドヤペルソナAI / DBテーブル: persona_projects / schema.prisma:4500

```prisma
model PersonaProject {
  id String @id @default(uuid())
  userId String
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  requestKey String
  inputHash String
  sourceUrl String?
  status String @default("pending")
  data Json?
  includedImages Json?
  usageDay DateTime
  leaseToken String
  leaseExpiresAt DateTime
  failureCode String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  images PersonaImageJob[]
  deletedAt DateTime?
  imagesPurgedAt DateTime?
  imagesPurgeAttemptedAt DateTime?
  @@unique([userId, requestKey])
  @@index([userId, usageDay, status], map: "persona_projects_user_day_status")
  @@map("persona_projects")

}
```

## PersonaImageJob

領域: ドヤペルソナAI / DBテーブル: persona_image_jobs / schema.prisma:4525

```prisma
model PersonaImageJob {
  id String @id @default(uuid())
  projectId String
  project PersonaProject @relation(fields: [projectId], references: [id], onDelete: Cascade)
  requestKey String
  inputHash String
  slotKey String
  kind String
  intent String
  status String @default("pending")
  usageDay DateTime
  leaseToken String
  leaseExpiresAt DateTime
  outputRef String?
  failureCode String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([projectId, requestKey])
  @@index([projectId, usageDay, intent, status], map: "persona_image_jobs_project_day_intent_status")
  @@map("persona_image_jobs")

}
```

## PersonaImageUsageDay

領域: ドヤペルソナAI / DBテーブル: persona_image_usage_days / schema.prisma:4547

```prisma
model PersonaImageUsageDay {
  userId String
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  day DateTime
  reserved Int @default(0)
  used Int @default(0)
  @@id([userId, day])
  @@map("persona_image_usage_days")

}
```

## PersonaUsageDay

領域: ドヤペルソナAI / DBテーブル: persona_usage_days / schema.prisma:4557

```prisma
model PersonaUsageDay {
  userId String
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  day DateTime
  reserved Int @default(0)
  used Int @default(0)
  @@id([userId, day])
  @@map("persona_usage_days")

}
```
