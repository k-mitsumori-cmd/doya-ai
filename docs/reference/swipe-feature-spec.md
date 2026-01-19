# 🎴 スワイプ機能仕様書

カードをスワイプして質問に答えるインタラクティブなUIパターンの実装仕様です。他サービスでも活用できる汎用的な設計になっています。

---

## 📋 目次

1. [機能概要](#機能概要)
2. [アーキテクチャ](#アーキテクチャ)
3. [データベーススキーマ](#データベーススキーマ)
4. [API設計](#api設計)
5. [コンポーネント構成](#コンポーネント構成)
6. [UI/UXパターン](#uiuxパターン)
7. [アニメーション仕様](#アニメーション仕様)
8. [レスポンシブデザイン](#レスポンシブデザイン)
9. [他サービスへの適用方法](#他サービスへの適用方法)
10. [実装チェックリスト](#実装チェックリスト)

---

## 機能概要

### 基本コンセプト

ユーザーがカードをスワイプ（またはボタンクリック）して質問に回答することで、段階的に情報を収集し、最終的にAIが最適なコンテンツを生成するインタラクティブなUIパターンです。

### 主な特徴

- **直感的な操作**: カードをスワイプまたはボタンクリックで回答
- **段階的な情報収集**: 前の回答に基づいて次の質問を動的に生成
- **視覚的フィードバック**: スワイプ時にYES/NOオーバーレイ表示
- **スムーズなアニメーション**: Framer Motionによる滑らかなカード遷移
- **レスポンシブ対応**: モバイル・タブレット・デスクトップに対応

### 使用例

- 記事作成: キーワードから記事の方向性を段階的に決定
- アンケート: ユーザーの好みや要件を収集
- 診断ツール: 質問に答えて結果を生成

---

## アーキテクチャ

### 全体フロー

```
[キーワード入力]
    ↓
[セッション開始 API]
    ↓
[初期質問生成]
    ↓
[カード表示] ←→ [スワイプ/回答]
    ↓
[次の質問生成 API] (残り2枚以下で自動実行)
    ↓
[最終確認画面]
    ↓
[コンテンツ生成 API]
```

### 状態管理

```typescript
type Step = 'keyword' | 'swipe' | 'confirm' | 'generating'

interface Question {
  id: string
  question: string
  category: string
  description?: string
}

interface Answer {
  questionId: string
  question: string
  answer: 'yes' | 'no'
}
```

### セッション管理

- **セッションID**: UUIDで一意に識別
- **ゲスト対応**: 未ログインユーザーも利用可能（guestIdで識別）
- **状態保持**: 回答履歴はDBに保存され、途中から再開可能

---

## データベーススキーマ

### SwipeSession

```prisma
model SwipeSession {
  id          String   @id @default(cuid())
  sessionId   String   @unique // UUID（フロント側で生成）
  userId      String?
  user        User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  guestId     String?  // 未ログイン時の識別子

  mainKeyword String   // 最初に入力したキーワード
  swipes      Json     // SwipeLog[]（スワイプログ配列）
  finalConditions Json? // {targetChars: number, articleType: string}
  primaryInfo Json?     // 一次情報（経験・訴求ポイントなど）
  generatedArticleId String? // 生成されたコンテンツのID

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([sessionId])
  @@index([userId, createdAt])
  @@index([guestId, createdAt])
}
```

### SwipeQuestionImage

```prisma
model SwipeQuestionImage {
  id        String   @id @default(cuid())
  category  String   // カテゴリ（例: "記事の方向性", "記事タイプ"など）
  prompt    String   @db.Text // 生成時のプロンプト
  imageBase64 String @db.Text // base64エンコードされた画像データ
  mimeType  String   @default("image/png")
  width     Int?
  height    Int?
  
  createdAt DateTime @default(now())

  @@index([category])
}
```

### SwipeCelebrationImage

```prisma
model SwipeCelebrationImage {
  id        String   @id @default(cuid())
  category  String   // カテゴリ（例: "thanks", "completion"など）
  prompt    String   @db.Text
  imageBase64 String @db.Text
  mimeType  String   @default("image/png")
  width     Int?
  height    Int?
  
  createdAt DateTime @default(now())

  @@index([category])
}
```

---

## API設計

### 1. セッション開始 API

**エンドポイント**: `POST /api/swipe/test/start`

**リクエスト**:
```typescript
{
  keywords: string[] // キーワード配列
}
```

**レスポンス**:
```typescript
{
  sessionId: string
  questions: Question[] // 初期質問配列
}
```

**処理フロー**:
1. セッションIDを生成（UUID）
2. キーワードの関連キーワードをAIで分析
3. 初期質問をAIで生成（3-5個）
4. セッションをDBに保存
5. 質問を返却

### 2. 次の質問生成 API

**エンドポイント**: `POST /api/swipe/test/question`

**リクエスト**:
```typescript
{
  sessionId: string
  answers: Answer[] // これまでの回答履歴
}
```

**レスポンス**:
```typescript
{
  done: boolean // 質問が完了したか
  questions?: Question[] // 新しい質問配列
  finalData?: {
    title: string
    targetChars: number
    summary: string
  }
}
```

**処理フロー**:
1. セッションを取得
2. 回答履歴を分析
3. 次の質問をAIで生成（3-5個）
4. 質問が十分な場合は `done: true` を返す
5. 完了時は最終データ（タイトル、文字数、要約）を返す

### 3. 最終化 API

**エンドポイント**: `POST /api/swipe/test/finalize`

**リクエスト**:
```typescript
{
  sessionId: string
  finalData: {
    title: string
    targetChars: number
  }
  answers: Answer[]
  primaryInfoText?: string // 一次情報（経験・訴求ポイントなど）
}
```

**レスポンス**:
```typescript
{
  jobId: string // 生成ジョブのID
}
```

**処理フロー**:
1. セッションを取得・更新
2. 回答履歴と一次情報を統合
3. コンテンツ生成ジョブを作成
4. ジョブIDを返却

### 4. 画像取得 API

**エンドポイント**: `GET /api/swipe/question-images?category={category}&count={count}`

**レスポンス**:
```typescript
{
  success: boolean
  images: Array<{
    imageBase64?: string
    mimeType?: string
    url?: string
  }>
}
```

---

## コンポーネント構成

### TinderSwipeCard

**パス**: `src/components/seo/TinderSwipeCard.tsx`

**役割**: 個別のスワイプ可能なカードコンポーネント

**主な機能**:
- ドラッグ&ドロップによるスワイプ
- YES/NOボタンクリック
- スワイプ時のアニメーション
- カテゴリに応じたアイコン表示
- 音響効果（Web Audio API）

**Props**:
```typescript
interface TinderSwipeCardProps {
  question: {
    id: string
    category: string
    question: string
  }
  onSwipe: (decision: SwipeDecision) => void
  index: number
  total: number
  questionImage?: {
    imageBase64?: string
    mimeType?: string
    url?: string
  }
}
```

**主要な実装パターン**:

```typescript
// ドラッグ処理
const x = useMotionValue(0)
const y = useMotionValue(0)
const rotate = useTransform(x, [-300, 300], [-25, 25])

// YES/NOオーバーレイの透明度
const likeOpacity = useTransform(x, [0, 150], [0, 1])
const nopeOpacity = useTransform(x, [-150, 0], [1, 0])

// スワイプアニメーション
const performSwipeAnimation = (decision: 'yes' | 'no') => {
  const direction = decision === 'yes' ? 1 : -1
  controls.start({
    x: direction * 700,
    y: -100,
    rotate: direction * 15,
    opacity: 0,
    scale: 0.85,
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
  })
}
```

### メインページコンポーネント

**パス**: `src/app/seo/swipe/page.tsx`

**役割**: スワイプ機能の全体フローを管理

**主な状態**:
- `step`: 現在のステップ（keyword/swipe/confirm）
- `questionQueue`: 質問キュー
- `answers`: 回答履歴
- `isGeneratingQuestion`: 質問生成中フラグ
- `progress`: 進捗（0-100%）

**主要な処理**:

```typescript
// セッション開始
const handleStart = async () => {
  // 1. キーワード検証
  // 2. セッション開始API呼び出し
  // 3. 初期質問をキューに追加
  // 4. 画像を並列取得
}

// スワイプ処理
const handleSwipe = async (decision: SwipeDecision, question: Question) => {
  // 1. 回答を履歴に追加
  // 2. 質問をキューから削除
  // 3. 残り2枚以下なら次の質問を生成
  // 4. 進捗を更新
}

// 次の質問生成
const loadNextQuestions = useCallback(async () => {
  // 1. 質問生成API呼び出し
  // 2. 新しい質問をキューに追加
  // 3. 完了時は最終確認画面へ
})
```

---

## UI/UXパターン

### カードデザイン

**基本構造**:
```
┌─────────────────────────┐
│ [アクセントライン]      │
│                         │
│ [カテゴリタグ]          │
│                         │
│ [アイコンエリア]        │
│  ┌─────┐               │
│  │ 🎯  │ カテゴリ名    │
│  └─────┘               │
│                         │
│ [質問テキスト]          │
│  "質問内容..."          │
│                         │
│ [YES] [NO] ボタン       │
└─────────────────────────┘
```

**カテゴリ別アイコン**:
- 記事タイプ: `FileText` (青)
- 方向性: `Compass` (エメラルド)
- キーワード: `Search` (バイオレット)
- ターゲット読者: `Users` (オレンジ)
- 記事の長さ: `BarChart3` (シアン)
- 確認: `CheckCircle` (緑)
- コンテンツ内容: `Lightbulb` (アンバー)
- 記事構成: `Layout` (インディゴ)
- トーン・文体: `MessageSquare` (ピンク)

### スワイプ時のオーバーレイ

**YES時**:
- 背景: 青系グラデーション
- アイコン: ハート（青）
- テキスト: "YES!"

**NO時**:
- 背景: 赤系グラデーション
- アイコン: X（赤）
- テキスト: "NO!"

### ローディング画面

**「考え中」オーバーレイ**:
- 背景: 半透明のダークオーバーレイ
- カード: 白背景のカード
- メッセージ: ローテーション表示
- プログレスバー: アニメーション付き

**メッセージ例**:
- "回答ありがとう。次に聞くべき質問を選んでいます…"
- "いまの回答を要約して、記事の方向性を整えています…"
- "読者が迷いやすいポイントを洗い出しています…"

### 最終確認画面

**構成要素**:
1. 完了メッセージ
2. 記事タイトル入力
3. 文字数選択（カード形式）
4. 質問回答の要約（Markdownプレビュー）
5. 一次情報入力欄
6. 生成ボタン

---

## アニメーション仕様

### カードスワイプアニメーション

**パラメータ**:
```typescript
{
  x: direction * 700,      // 横方向の移動距離
  y: -100,                 // 上方向への移動
  rotate: direction * 15,  // 回転角度
  opacity: 0,              // フェードアウト
  scale: 0.85,              // 縮小
  duration: 0.4,            // アニメーション時間
  ease: [0.4, 0, 0.2, 1]   // イージング関数
}
```

**タイミング**:
- アニメーション開始後250msで次のカードを表示
- これにより、アニメーションを見せつつラグを最小化

### カード表示アニメーション

**初期表示**:
```typescript
{
  opacity: 1,
  scale: 1,
  duration: 0.15
}
```

### 音響効果

**Web Audio API使用**:
- **Whoosh音**: ノイズベースの効果音
- **Sparkle音**: オシレーターによる装飾音
- YES時: 高音（880Hz）
- NO時: 低音（330Hz）

---

## レスポンシブデザイン

### ブレークポイント

- **モバイル**: `< 640px`
- **タブレット**: `640px - 1024px`
- **デスクトップ**: `> 1024px`

### カードサイズ

```typescript
// 最大幅
max-w-md      // モバイル
sm:max-w-xl   // タブレット
md:max-w-2xl  // デスクトップ

// パディング
p-4           // モバイル
sm:p-6        // タブレット
md:p-8        // デスクトップ
```

### アイコンサイズ

```typescript
w-7 h-7       // モバイル
sm:w-10 sm:h-10 // タブレット以上
```

### テキストサイズ

```typescript
text-base     // モバイル
sm:text-lg    // タブレット
md:text-xl    // デスクトップ
```

### ボタンサイズ

```typescript
w-14 h-14     // モバイル
sm:w-18 sm:h-18 // タブレット
md:w-20 md:h-20 // デスクトップ
```

### カード領域の高さ

```typescript
h-[520px]     // モバイル
sm:h-[600px]  // タブレット
md:h-[680px]  // デスクトップ
```

---

## 他サービスへの適用方法

### Step 1: データベーススキーマの追加

```prisma
// prisma/schema.prisma に追加
model SwipeSession {
  id          String   @id @default(cuid())
  sessionId   String   @unique
  userId      String?
  user        User?    @relation(fields: [userId], references: [id])
  guestId     String?
  mainKeyword String
  swipes      Json
  finalConditions Json?
  primaryInfo Json?
  generatedContentId String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([sessionId])
}
```

### Step 2: APIルートの作成

**ディレクトリ構造**:
```
src/app/api/{service}/swipe/
  ├── start/route.ts      # セッション開始
  ├── question/route.ts  # 次の質問生成
  └── finalize/route.ts  # 最終化
```

**実装例** (`start/route.ts`):
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { geminiGenerateText } from '@/lib/gemini'
import { v4 as uuidv4 } from 'uuid'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const body = await req.json()
    const { keywords } = body

    // セッションID生成
    const sessionId = uuidv4()

    // セッション保存
    await prisma.swipeSession.create({
      data: {
        sessionId,
        userId: session?.user?.id || null,
        mainKeyword: keywords.join(', '),
        swipes: [],
      },
    })

    // 初期質問生成（AI）
    const questions = await generateInitialQuestions(keywords)

    return NextResponse.json({
      sessionId,
      questions,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'エラーが発生しました' },
      { status: 500 }
    )
  }
}
```

### Step 3: コンポーネントのコピー

```bash
# TinderSwipeCardをコピー
cp src/components/seo/TinderSwipeCard.tsx \
   src/components/{service}/SwipeCard.tsx

# メインページをコピー
cp src/app/seo/swipe/page.tsx \
   src/app/{service}/swipe/page.tsx
```

### Step 4: カスタマイズ

**質問生成プロンプトの調整**:
```typescript
// サービス固有の質問生成ロジック
const generateQuestions = async (answers: Answer[]) => {
  const prompt = `
あなたは{サービス名}の専門家です。
以下の回答履歴に基づいて、次の質問を3-5個生成してください。

回答履歴:
${answers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n')}

要件:
- 前の回答を踏まえた深掘り質問
- ユーザーの意図を明確にする質問
- 具体的で回答しやすい質問

出力形式:
{
  "questions": [
    {
      "id": "q1",
      "category": "カテゴリ名",
      "question": "質問内容"
    }
  ]
}
`
  // AI生成処理...
}
```

**カテゴリビジュアルの調整**:
```typescript
// TinderSwipeCard.tsx の getCategoryVisual 関数をカスタマイズ
function getCategoryVisual(category: string) {
  // サービス固有のカテゴリマッピング
  if (cat.includes('カスタムカテゴリ1')) {
    return {
      icon: <CustomIcon1 />,
      gradient: 'from-custom-50 to-custom-100',
      label: 'カスタムラベル1',
    }
  }
  // ...
}
```

### Step 5: ルーティング設定

**サイドバーに追加**:
```typescript
// src/components/{Service}Sidebar.tsx
const NAV_ITEMS = [
  { href: '/{service}/swipe', label: 'スワイプ作成', icon: Sparkles },
  // ...
]
```

### Step 6: プラン管理の統合

```typescript
// プラン別制限
const LIMITS = {
  GUEST: { maxQuestions: 10, maxChars: 5000 },
  FREE: { maxQuestions: 20, maxChars: 10000 },
  PRO: { maxQuestions: 50, maxChars: 20000 },
  ENTERPRISE: { maxQuestions: 999, maxChars: 50000 },
}

// 使用量チェック
const checkUsage = async (userId: string) => {
  const subscription = await getSubscription(userId, 'myservice')
  const plan = subscription?.plan || 'FREE'
  const limit = LIMITS[plan]
  
  // 使用量チェック処理...
}
```

---

## 実装チェックリスト

### データベース

- [ ] `SwipeSession` モデルを追加
- [ ] `SwipeQuestionImage` モデルを追加（画像使用時）
- [ ] `SwipeCelebrationImage` モデルを追加（完了画像使用時）
- [ ] インデックスを適切に設定
- [ ] マイグレーションを実行

### API

- [ ] `/api/{service}/swipe/start` を実装
- [ ] `/api/{service}/swipe/question` を実装
- [ ] `/api/{service}/swipe/finalize` を実装
- [ ] エラーハンドリングを実装
- [ ] リトライロジックを実装（質問生成時）
- [ ] 認証・ゲスト対応を実装

### フロントエンド

- [ ] `TinderSwipeCard` コンポーネントをコピー・カスタマイズ
- [ ] メインページコンポーネントを実装
- [ ] ステップ管理（keyword/swipe/confirm）を実装
- [ ] 質問キュー管理を実装
- [ ] 回答履歴管理を実装
- [ ] 進捗バーを実装
- [ ] ローディングオーバーレイを実装

### UI/UX

- [ ] カードデザインをカスタマイズ
- [ ] カテゴリ別アイコンを設定
- [ ] スワイプアニメーションを調整
- [ ] YES/NOオーバーレイを実装
- [ ] 音響効果を実装（オプション）
- [ ] レスポンシブデザインを実装
- [ ] 最終確認画面を実装

### 統合

- [ ] サイドバーにメニューを追加
- [ ] プラン管理を統合
- [ ] 使用量チェックを実装
- [ ] エラーメッセージを実装
- [ ] 完了後のリダイレクトを実装

### テスト

- [ ] モバイルでの動作確認
- [ ] タブレットでの動作確認
- [ ] デスクトップでの動作確認
- [ ] スワイプ操作のテスト
- [ ] ボタンクリックのテスト
- [ ] エラーケースのテスト
- [ ] ゲストユーザーのテスト

---

## ベストプラクティス

### パフォーマンス

1. **質問のプリフェッチ**: 残り2枚以下で次の質問を生成
2. **画像の並列取得**: `Promise.all` でカテゴリごとに並列取得
3. **アニメーション最適化**: `will-change` プロパティの使用
4. **状態管理**: 不要な再レンダリングを避ける

### ユーザー体験

1. **ラグの最小化**: アニメーション中に次のカードを準備
2. **視覚的フィードバック**: スワイプ時にYES/NOオーバーレイ表示
3. **進捗表示**: 進捗バーで全体の進捗を表示
4. **エラーハンドリング**: 分かりやすいエラーメッセージ

### コード品質

1. **型安全性**: TypeScriptの型定義を徹底
2. **エラーハンドリング**: try-catch とリトライロジック
3. **コード分割**: コンポーネントの適切な分割
4. **コメント**: 複雑なロジックにはコメントを追加

---

## 参考実装

### 実装例

- **SEOサービス**: `src/app/seo/swipe/page.tsx`
- **コンポーネント**: `src/components/seo/TinderSwipeCard.tsx`
- **API**: `src/app/api/swipe/test/start/route.ts`

### 関連ドキュメント

- [実装パターン集](./implementation-patterns.md)
- [アニメーション仕様](./animation-spec.md)
- [デザインシステム](./design-system.md)

---

*最終更新: 2026年1月*
