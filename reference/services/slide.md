# ドヤスライド + SlashSlide

## 概要

2つのブランドで同一機能を提供するスライド生成サービス。

| 項目 | ドヤスライド | SlashSlide |
|------|-----------|------------|
| **パス** | `/slide` | `/slashslide` |
| **説明** | AIスライド生成 | AIスライド生成 (別ブランド) |
| **ステータス** | active | active |

## 機能
- テーマ・目的・スライド数を入力
- Gemini AI がJSON構成を生成
- UIでプレビュー・編集
- Google Slides API で実際のスライド作成・共有

## 生成フロー
```
1. ユーザーがテーマ・目的・スライド数・テーマカラーを入力
2. POST /api/slide/generate → Gemini がJSON構成を生成
3. UI にスライド構成をプレビュー表示
4. ユーザーが確認後、POST /api/slide/publish/google-slides
5. Google Slides API で実際のプレゼンテーション作成
6. 共有URLをユーザーに返す
```

## APIエンドポイント

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

## リクエスト仕様

### `/generate` (Zod検証)
```typescript
{
  topic: string              // スライドテーマ (必須)
  slidePurpose: enum         // 'proposal' | 'meeting' | 'sales' | 'recruit' | 'seminar' | 'other'
                             // default: 'proposal'
  slideCount: number         // 3〜30枚, default: 8
  themeColor: string         // HEXカラー #RRGGBB, default: '#1E40AF'
  referenceText?: string     // 参考テキスト (任意)
}
```

### `/publish/google-slides`
```typescript
{
  title: string              // プレゼンテーションタイトル (必須)
  themeColor: string         // HEXカラー #RRGGBB, default: '#1E40AF'
  recipientEmail: string     // 共有先メールアドレス (必須)
  slides: Array<{
    title: string
    elements: Array<{
      type: 'text' | 'bullets' | 'image'
      content?: string       // text用
      items?: string[]       // bullets用
      placeholder?: string   // image用
    }>
  }>
}
```

## 用途 (slidePurpose)
| 値 | 日本語 |
|----|--------|
| `proposal` | 提案資料 |
| `meeting` | 会議資料 |
| `sales` | 営業資料 |
| `recruit` | 採用資料 |
| `seminar` | セミナー資料 |
| `other` | その他 |

## ファイル構成
```
src/app/slide/
  ├── layout.tsx              # レイアウト
  ├── page.tsx                # ランディングページ
  └── create/page.tsx         # スライド作成ページ

src/app/slashslide/
  ├── layout.tsx              # レイアウト
  ├── page.tsx                # ランディングページ
  └── create/page.tsx         # スライド作成ページ

src/app/api/slide/
  ├── generate/route.ts       # JSON構成生成 (Gemini)
  └── publish/google-slides/route.ts  # Google Slides 変換

src/app/api/slashslide/
  ├── generate/route.ts       # JSON構成生成 (Gemini)
  └── publish/google-slides/route.ts  # Google Slides 変換

src/lib/slide/
  ├── gemini.ts               # Gemini API呼び出し (JSON生成)
  ├── googleSlides.ts         # Google Slides API連携
  └── types.ts                # 型定義 (SlideGenerateRequest, SlideSpec)

src/lib/slashslide/
  ├── gemini.ts               # SlashSlide用 Gemini
  ├── googleSlides.ts         # SlashSlide用 Slides API
  └── types.ts                # SlashSlide型定義
```

## ミドルウェア連携
`middleware.ts` で `SLIDE_HOSTS` 環境変数に指定されたドメインからのアクセスを `/slide` パスにリライト。
これにより、スライド専用ドメインでのアクセスが可能。

## デザイン
- ランディングページ: 3セクション + CTA
  1. Hero (タイトル, 説明, CTA)
  2. Use Cases (4つのユースケース)
  3. How it works (3ステップ)
  4. CTA (最終呼び出し)
- アイコン: Lucide React (Presentation, Sparkles, Zap等)
- アニメーション: Framer Motion (fadeUp)

## 環境変数
| 変数名 | 説明 |
|--------|------|
| `GOOGLE_SLIDES_CLIENT_EMAIL` | Google Slides API サービスアカウント |
| `GOOGLE_SLIDES_PRIVATE_KEY` | Google Slides API 秘密鍵 |
| `SLIDE_HOSTS` | スライド専用ドメイン (カンマ区切り) |
