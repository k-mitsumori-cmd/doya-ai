# ドヤ診断AI

## 概要
- **パス**: `/shindan`
- **サービスID**: `shindan`
- **説明**: Webサイト競合分析 — Web7軸スコアリング + 競合サイト深掘り + 辛口AI診断
- **ステータス**: active
- **カテゴリ**: text

## 機能
- WebサイトURL入力 → HTML自動取得・解析 → 7軸スコアリング
- 競合サイト深掘り分析
- 業界ベンチマーク比較
- ボトルネック分析パネル
- 改善提案 (優先度付き)
- PDF書き出し
- スコアカード表示
- 6軸レーダーチャート

## 7軸分析エンジン (`generate/route.ts` 1442行)

### Webサイト自動解析
APIは入力されたURLのHTMLを自動的に取得し、以下を抽出:
1. **テキスト抽出**: `<script>`, `<style>`, `<nav>`, `<footer>` を除去、最大12,000文字
2. **メタタグ抽出**: `<title>`, `<meta name/property>` タグを全て解析
3. **見出し構造**: `<h1>`〜`<h3>` を最大30個抽出
4. **内部リンク**: 同一ドメインの内部パスを最大30個検出
5. **画像分析**: `<img>` タグの総数とalt属性付きの数をカウント
6. **CTA検出**: フォーム要素、「お問い合わせ」「資料請求」「無料」等のキーワード検知
7. **ブログ有無**: `blog`, `news`, `column` 等のパスパターン検出
8. **SNSリンク**: X, Facebook, Instagram, YouTube, LinkedIn, LINE, TikTok を検出

### 拡張分析フィールド
```typescript
interface WebsiteAnalysis {
  // 基本スコア
  seoScore: number
  contentScore: number
  technicalScore: number
  totalScore: number
  issues: string[]
  positives: string[]

  // トラッキングツール検出
  tracking?: {
    hasGA4: boolean; hasGTM: boolean; hasGoogleAds: boolean
    hasFBPixel: boolean; hasLinkedInInsight: boolean
    hasHotjar: boolean; hasClarityMs: boolean
    hasHubspot: boolean; hasPardot: boolean; hasMarketo: boolean
    maturityLevel: 'none' | 'basic' | 'intermediate' | 'advanced'
    trackingScore: number
  }

  // 訴求軸分析
  appealAxis?: {
    heroType: 'benefit' | 'feature' | 'emotional' | 'social-proof' | 'unclear'
    valueProposition: string
    uspKeywords: string[]
    appealScore: number
  }

  // 社会的証明分析
  socialProof?: {
    hasTestimonials: boolean; hasClientLogos: boolean
    hasCaseStudies: boolean; hasCertifications: boolean
    hasUserCount: boolean; hasMediaMentions: boolean
    socialProofScore: number
  }

  // CTA分析
  ctaAnalysis?: {
    ctaTexts: string[]; ctaCount: number
    hasLeadMagnet: boolean; hasLiveChat: boolean
    ctaPlacement: 'hero-only' | 'distributed' | 'footer-only' | 'none'
    ctaEffectivenessScore: number
  }

  // 料金シグナル分析
  pricingSignals?: {
    hasPricingPage: boolean; hasFreeTrial: boolean
    hasFreeplan: boolean
  }
}
```

## 料金

| プラン | 日次上限 | 月額 |
|--------|---------|------|
| ゲスト | 1回/日 | ¥0 |
| 無料会員 | 3回/日 | ¥0 |
| PRO | 20回/日 | ¥9,980 |

## APIエンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/shindan/generate` | 診断実行 (Gemini 2.0 Flash) — 1442行 |
| POST | `/api/shindan/log` | 診断ログ保存 |

### `/api/shindan/generate` リクエスト
```typescript
{
  url?: string       // WebサイトURL (自動解析)
  text?: string      // 手動テキスト入力
  industry?: string  // 業種 (ベンチマーク用)
}
```

### レスポンス概要
- 7軸スコア (0-100)
- 競合分析サマリー
- ボトルネック一覧
- 優先度付き改善提案
- レーダーチャートデータ

## ファイル構成
```
src/app/shindan/
  ├── layout.tsx              # ShindanAppLayout
  └── page.tsx                # 診断ページ

src/app/api/shindan/
  ├── generate/route.ts       # 診断生成API (1442行, 7軸エンジン)
  └── log/route.ts            # ログ保存API

src/components/
  ├── ShindanAppLayout.tsx    # レイアウト
  └── ShindanSidebar.tsx      # サイドバー

src/components/shindan/
  ├── BenchmarkChart.tsx      # ベンチマーク比較チャート
  ├── BottleneckPanel.tsx     # ボトルネック分析パネル
  ├── PdfExportButton.tsx     # PDF書き出しボタン
  ├── RecommendationPanel.tsx # 改善提案パネル
  ├── ScoreCard.tsx           # スコアカード
  └── ShindanRadarChart.tsx   # 6軸レーダーチャート (Recharts)
```

## デザイン
- **カラー**: teal
- **アイコン**: `📊`
- レーダーチャート: Recharts ライブラリ使用
