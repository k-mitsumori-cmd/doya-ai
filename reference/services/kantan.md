# カンタンマーケAI

## 概要
- **パス**: `/kantan`
- **サービスID**: `kantan`
- **説明**: マーケティング業務をAIエージェントで劇的効率化
- **ステータス**: active
- **カテゴリ**: text

## 機能
- LP構成案を10分で作成
- バナーコピー40案を1分で生成
- 広告データ分析
- メルマガ・記事作成
- ペルソナ・競合分析
- チャット形式でブラッシュアップ
- 15種類のマーケAIエージェント

## 料金

| プラン | 日次上限 | 月額 |
|--------|---------|------|
| ゲスト | 3回/日 | ¥0 |
| 無料会員 | 10回/日 | ¥0 |
| PRO | 100回/日 | ¥4,980 |
| 法人 | 要相談 | 要相談 |

## ファイル構成
```
src/app/kantan/          # フロントエンド
  ├── layout.tsx         # レイアウト
  ├── dashboard/         # ダッシュボード
  ├── pricing/           # 料金ページ
  └── guide/             # ガイド

src/lib/pricing.ts       # KANTAN_PRICING 定義
src/lib/services.ts      # SERVICES 配列内の kantan エントリ
```

## デザイン
- **カラー**: emerald
- **グラデーション**: `from-emerald-500 to-teal-500`
- **アイコン**: `🚀`

## 補足
- `/kantan` は現在 `/seo` にリダイレクト設定あり (next.config.js)
- テンプレート + カテゴリでマーケ業務をカバー
- DB: `Category` + `Template` + `Generation` テーブル
