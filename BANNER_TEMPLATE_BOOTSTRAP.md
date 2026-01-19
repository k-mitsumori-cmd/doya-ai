# バナーテンプレート一括生成ガイド

## 概要

Netflix風UIで常にヒーロー画像を表示するため、全テンプレートの代表画像を事前に生成してデータベースに保存します。

## セットアップ

### 1. データベースマイグレーション

```bash
cd doya-ai
npx prisma migrate dev --name add_banner_template
```

または、既存のDBに直接適用する場合：

```bash
npx prisma db push
```

### 2. 一括生成の実行

#### 方法A: 全テンプレートを一括生成（推奨）

```bash
curl -X POST https://doya-ai.surisuta.jp/api/banner/test/templates/bootstrap \
  -H "Content-Type: application/json" \
  -d '{
    "generateAll": true,
    "skipExisting": true,
    "setFirstAsFeatured": true
  }'
```

#### 方法B: 特定のテンプレートのみ生成

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

#### 方法C: ブラウザから実行

開発環境で実行する場合：

1. ブラウザの開発者ツールを開く
2. コンソールで以下を実行：

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

## パラメータ説明

- `generateAll` (boolean): `true` の場合、全テンプレートを生成
- `templateIds` (string[]): 特定のテンプレートIDの配列（`generateAll: false` の場合）
- `skipExisting` (boolean): `true` の場合、既に画像があるテンプレートをスキップ
- `setFirstAsFeatured` (boolean): `true` の場合、最初のテンプレートを `isFeatured: true` に設定

## 生成時間の目安

- 全テンプレート（約330個）: 約10-15分
- 1テンプレートあたり: 約2-3秒（レート制限のため2秒待機）

## 確認方法

生成後、以下のエンドポイントで確認できます：

```bash
curl https://doya-ai.surisuta.jp/api/banner/test/templates
```

レスポンスに `generatedCount` が含まれ、生成済みのテンプレート数が確認できます。

## トラブルシューティング

### エラー: "生成に失敗しました"

- APIキー（`GOOGLE_GENAI_API_KEY`）が正しく設定されているか確認
- レート制限に達していないか確認
- ログを確認して詳細なエラー内容を確認

### 一部のテンプレートが生成されない

- `skipExisting: false` にして再実行
- エラーログを確認して、失敗したテンプレートIDを特定
- 失敗したテンプレートのみ再生成

### データベース接続エラー

- `DATABASE_URL` が正しく設定されているか確認
- Prismaマイグレーションが完了しているか確認

## 注意事項

- 一括生成は時間がかかるため、本番環境で実行する場合は適切なタイムアウト設定が必要
- 大量のAPIリクエストが発生するため、レート制限に注意
- 生成された画像URLは永続化されていることを確認（一時URLの場合はGCS等に保存が必要）
