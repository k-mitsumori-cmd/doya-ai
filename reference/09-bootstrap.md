# 09. バナーテンプレート一括生成 (Bootstrap)

## 概要

Netflix風UIで常にヒーロー画像を表示するため、全テンプレートの代表画像を事前に生成してデータベースに保存する。

## 前提条件

1. PostgreSQLデータベースへの接続URL (`DATABASE_URL`)
2. Google AI Studio APIキー (`GOOGLE_GENAI_API_KEY`)

## セットアップ

### 1. 環境変数ファイルの作成

```bash
cd doya-ai
cp env.example.txt .env.local
```

`.env.local` を編集:
```bash
DATABASE_URL=postgresql://user:password@host:port/database?schema=public
GOOGLE_GENAI_API_KEY=your-google-ai-studio-api-key
```

### 2. データベースマイグレーション

```bash
npx prisma generate
npx prisma db push
```

---

## 一括生成の実行方法

### 方法A: ローカル環境で実行 (推奨・長時間実行可能)

全テンプレート (約330個) を一括生成。Vercelのタイムアウト制限を回避。

```bash
cd doya-ai

# ローカルサーバーを起動 (別ターミナル)
npm run dev

# スクリプトを実行
node scripts/local-bootstrap.mjs
```

### 方法B: 50件ずつバッチ生成 (推奨)

途中で止まっても `scripts/.bootstrap-progress.json` により **続きから再開** 可能。

```bash
cd doya-ai

# 1) ローカルサーバーを起動 (別ターミナル)
npm run dev

# 2) 50件ずつバッチ実行
node scripts/batch-bootstrap-50.mjs
```

### 方法C: API経由で実行 (小規模向け)

Vercelタイムアウト (最大600秒) があるため、約20個以下に適用。

```bash
curl -X POST https://doya-ai.surisuta.jp/api/banner/test/templates/bootstrap \
  -H "Content-Type: application/json" \
  -d '{
    "generateAll": true,
    "skipExisting": true,
    "setFirstAsFeatured": true
  }'
```

### 方法D: 特定のテンプレートのみ生成

```bash
curl -X POST https://doya-ai.surisuta.jp/api/banner/test/templates/bootstrap \
  -H "Content-Type: application/json" \
  -d '{
    "generateAll": false,
    "templateIds": ["brand-001", "brand-002", "ux-001"],
    "skipExisting": true,
    "setFirstAsFeatured": true
  }'
```

### 方法E: ブラウザから実行

開発者ツールのコンソールで:
```javascript
fetch('/api/banner/test/templates/bootstrap', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    generateAll: true,
    skipExisting: true,
    setFirstAsFeatured: true
  })
})
.then(r => r.json())
.then(console.log)
```

---

## パラメータ

| パラメータ | 型 | 説明 |
|-----------|------|------|
| `generateAll` | boolean | `true` で全テンプレートを生成 |
| `templateIds` | string[] | 特定のテンプレートIDの配列 (`generateAll: false` の場合) |
| `skipExisting` | boolean | `true` で既に画像があるテンプレートをスキップ |
| `setFirstAsFeatured` | boolean | `true` で最初のテンプレートを `isFeatured: true` に設定 |

## 生成時間の目安

| 対象 | 所要時間 |
|------|---------|
| 全テンプレート (約330個) | 約2.75時間 |
| 50件バッチ | 約25分 |
| 1テンプレート | 約30秒 (レート制限対策) |
| 小規模 (約20個以下) | API経由でも実行可能 |

## 確認方法

```bash
curl https://doya-ai.surisuta.jp/api/banner/test/templates
```

レスポンスに `generatedCount` が含まれ、生成済みのテンプレート数が確認できる。

## 注意事項

- 既に画像があるテンプレートは自動的にスキップされる
- 最初のテンプレートが自動的に `isFeatured: true` に設定される
- エラーが発生したテンプレートはスキップして続行される
- 大量のAPIリクエストが発生するため、レート制限に注意

## トラブルシューティング

| エラー | 対策 |
|--------|------|
| `Invalid value undefined for datasource` | `.env.local` に `DATABASE_URL` が正しく設定されているか確認 |
| `バナーが生成されませんでした` | `GOOGLE_GENAI_API_KEY` が正しく設定されているか確認。APIキーのレート制限を確認 |
| 一部のテンプレートが生成されない | `skipExisting: false` で再実行。エラーログで失敗したテンプレートIDを特定 |
| データベース接続エラー | `DATABASE_URL` とPrismaマイグレーション完了を確認 |
| ローカルサーバーが起動しない | ポート3000が使用中でないか確認。`npm install` を実行 |