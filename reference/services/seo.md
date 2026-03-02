# ドヤライティングAI (SEO記事生成)

## 概要
- **パス**: `/seo`
- **サービスID**: `seo` (DB上は `writing` も後方互換で参照)
- **説明**: SEO + LLMO 対応の長文記事を自動生成
- **ステータス**: active
- **カテゴリ**: text

## 機能
- キーワード入力 → アウトライン → セクション分割生成 → 統合
- LLMO オプション (FAQ, 用語集, 比較表, テンプレート, 引用, TLDR)
- 比較記事モード (`comparison_research`)
- 参考URL/画像/テキスト入力対応
- 図解画像・サムネイル自動生成 (Gemini 3 Pro)
- リンクチェック・監査レポート
- チャット形式で記事編集
- タイトル提案 (5案)

## 料金

| プラン | 日次上限 | 文字数上限 | 月額 |
|--------|---------|-----------|------|
| ゲスト | 合計1回 | 5,000字 | ¥0 |
| 無料会員 | 1回/日 | 10,000字 | ¥0 |
| PRO | 3回/日 | 20,000字 | ¥9,980 |
| Enterprise | 30回/日 | 50,000字 | ¥49,980 |

## APIエンドポイント (50+)

### 記事CRUD
| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/seo/articles` | 記事作成 |
| GET | `/api/seo/articles` | 記事一覧取得 |
| GET | `/api/seo/articles/[id]` | 記事詳細取得 |
| PUT | `/api/seo/articles/[id]` | 記事更新 |
| DELETE | `/api/seo/articles/[id]` | 記事削除 |

### 生成パイプライン
| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/seo/articles/[id]/outline` | アウトライン生成 |
| POST | `/api/seo/articles/[id]/research` | 競合調査 |
| POST | `/api/seo/articles/[id]/content` | セクション生成 (SSE) |
| POST | `/api/seo/articles/[id]/check` | 監査・二重チェック |
| POST | `/api/seo/articles/[id]/chat-edit` | チャット形式編集 |

### 画像生成
| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/seo/articles/[id]/images/banner` | サムネイル生成 |
| POST | `/api/seo/articles/[id]/images/diagram` | 図解生成 |
| POST | `/api/seo/articles/[id]/images/batch` | 一括画像生成 |
| POST | `/api/seo/articles/[id]/images/suggest` | 画像提案 |
| POST | `/api/seo/articles/[id]/images/ensure` | 画像確保 |

### ジョブ管理
| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/seo/jobs/[id]` | ジョブ状態取得 |
| POST | `/api/seo/jobs/[id]/pause` | 一時停止 |
| POST | `/api/seo/jobs/[id]/resume` | 再開 |
| POST | `/api/seo/jobs/[id]/cancel` | キャンセル |
| POST | `/api/seo/jobs/[id]/reset` | リセット |
| POST | `/api/seo/jobs/[id]/advance` | 次ステップへ |

### その他
| メソッド | パス | 説明 |
|---------|------|------|
| PUT | `/api/seo/sections/[id]` | セクション直接編集 |
| POST | `/api/seo/articles/[id]/title-suggestions` | タイトル提案 |
| POST | `/api/seo/articles/[id]/link-check` | リンクチェック |
| GET/POST | `/api/seo/articles/[id]/knowledge` | ナレッジ管理 |
| GET/POST | `/api/seo/articles/[id]/memo` | メモ |

## 記事生成パイプライン

```
1. init    → ジョブ作成
2. outline → Gemini でアウトライン生成
3. sections → セクション分割 → 各セクション順次生成
4. integrate → 全セクション統合 → finalMarkdown
5. audit   → 二重チェック・監査レポート
6. done    → 完了
```

## DB テーブル
- `SeoArticle` — 記事本体 (入力 + 成果物)
- `SeoJob` — 生成ジョブ (status / progress / step / cursor)
- `SeoSection` — セクション (index / heading / content)
- `SeoReference` — 参考URL (抽出テキスト / 見出し / インサイト)
- `SeoAuditReport` — 監査レポート
- `SeoImage` — 画像 (BANNER / DIAGRAM)
- `SeoLinkCheckResult` — リンクチェック結果
- `SeoKnowledgeItem` — ナレッジ (trend / insight / prompt / note)
- `SeoUserMemo` — ユーザーメモ

## ファイル構成
```
src/app/seo/
  ├── layout.tsx              # SeoAppLayout
  ├── page.tsx                # 記事一覧
  ├── create/page.tsx         # 新規作成
  └── test/                   # テスト環境

src/app/api/seo/             # 50+ APIルート
src/components/SeoAppLayout.tsx
src/components/SeoSidebar.tsx
src/lib/seo.ts               # SEOユーティリティ
src/lib/seoAccess.ts         # アクセス制御
src/lib/pricing.ts           # SEO_PRICING
```

## デザイン
- **サイドバー**: `DashboardSidebar` (Banner/SEO共有)
- サイドバーナビ: 「新規記事作成」「生成記事一覧」
- **カラー**: slate / blue
