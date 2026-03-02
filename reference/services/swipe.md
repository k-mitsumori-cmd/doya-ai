# ドヤSwipe

## 概要
- **パス**: `/swipe`
- **サービスID**: (SEOサービスの一部)
- **説明**: Tinder風UIでスワイプ → 質問に答えるだけでSEO記事を自動生成
- **ステータス**: active
- **カテゴリ**: text

## 機能
- キーワード入力 → 質問カードを左右スワイプ (Yes/No/Hold)
- スワイプ結果から記事条件を自動構築
- 一次情報 (実績, 体験, 意見, 固定文言) 入力対応
- 完了 → SEO記事生成パイプラインに接続
- お祝い画像表示 (セレブレーション)

## APIエンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/swipe/start` | セッション開始 (UUID発行 + 質問ツリー返却) |
| POST | `/api/swipe/generate` | スワイプ結果 → SEO記事生成開始 |
| POST | `/api/swipe/log` | スワイプログ保存 |
| * | `/api/swipe/test/*` | テスト (祝賀画像, 質問画像) |
| * | `/api/swipe/celebration-images/*` | 祝賀画像生成 |
| * | `/api/swipe/question-images/*` | 質問カード画像生成 |

## スワイプ → 記事条件マッピング

```typescript
// スワイプ結果から自動決定される項目:
q3: 'yes' → searchIntent = 'BtoB'
q4: 'yes' → persona = '初心者'
q5: 'yes' → tone = '営業色強め'
q6: 'yes' → 料金比較表を含める
q7: 'yes' → 機能比較表を含める
q8: 'yes' → 選び方チェックリスト
q9: 'yes' → FAQ付き
q10: 'yes' → 用語集付き
q11: 'yes' → 導入事例・実績
q12: 'yes' → メリット・デメリット
q13: 'yes' → 手順・ステップ
q14: 'yes' → ランキング形式
q15: 'yes' → まとめを先頭に (TLDR)
q16: 'yes' → 引用付き
q17: 'yes' → 反論対策
q18: 'yes' → テンプレート付き
```

## DB テーブル

| モデル | 説明 |
|--------|------|
| SwipeSession | セッション (mainKeyword, swipes[], finalConditions, generatedArticleId) |
| SwipeCelebrationImage | お祝い画像 (category, base64) |
| SwipeQuestionImage | 質問カード画像 (category, base64) |

## ファイル構成
```
src/app/swipe/
  └── page.tsx              # スワイプUI

src/app/api/swipe/
  ├── start/route.ts        # セッション開始
  ├── generate/route.ts     # 記事生成
  ├── log/route.ts          # ログ保存
  ├── celebration-images/   # 祝賀画像API
  ├── question-images/      # 質問画像API
  └── test/                 # テスト用

prisma/ (SEOと同じ質問定義)
  └── SwipeSession テーブル
```

## 補足
- 質問定義は `@seo/lib/swipe-questions` に格納
- SEO記事生成と料金制限を共有 (seoPlan / seoAccess)
- ゲスト/ログインの回数制限はSEOと同一
