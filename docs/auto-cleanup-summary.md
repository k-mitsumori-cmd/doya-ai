# 自動削除機能の概要

## ✅ 実装済み機能

### 1. 3ヶ月自動削除

**スケジュール**: 毎日午前2時（JST）に自動実行

**対象**: 作成から3ヶ月以上経過したプロジェクト

**削除内容**:
- ✅ Google Cloud Storage（GCS）バケット内のファイル
- ✅ データベースのプロジェクトと関連データ（Cascade削除）

**実装場所**:
- API: `/api/interview/projects/cleanup`
- Cron設定: `vercel.json`

**コード**:
```typescript
// 3ヶ月前の日時を計算
const threeMonthsAgo = new Date()
threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

// 3ヶ月経過したプロジェクトを取得して削除
const oldProjects = await prisma.interviewProject.findMany({
  where: {
    createdAt: {
      lt: threeMonthsAgo,
    },
  },
})
```

### 2. 容量不足時の自動削除

**トリガー**: ストレージ容量が不足した場合（手動または自動）

**動作**: 古いプロジェクトから順に削除

**API**: `/api/interview/storage/cleanup`

**設定**:
- デフォルトの空き容量目標: 100MB
- カスタマイズ可能（リクエストボディで指定）

### 3. ストレージ使用状況の確認

**API**: `/api/interview/storage/check`

**取得情報**:
- 総使用量
- 残り容量
- 使用率
- 警告レベル（1TB超過）
- 危険レベル（4TB超過）
- 3ヶ月経過したプロジェクト数
- 月額コスト見積もり

## 🔄 動作フロー

### 3ヶ月自動削除のフロー

```
1. Vercel Cron Jobsが毎日午前2時に実行
   ↓
2. /api/interview/projects/cleanup を呼び出し
   ↓
3. 3ヶ月前の日時を計算
   ↓
4. 3ヶ月経過したプロジェクトを取得
   ↓
5. 各プロジェクトについて:
   - GCSからファイルを削除
   - データベースからプロジェクトを削除
   ↓
6. 削除結果をログに記録
```

### 容量不足時の自動削除のフロー

```
1. ストレージ容量が不足
   ↓
2. /api/interview/storage/cleanup を呼び出し
   ↓
3. 現在の使用状況を取得
   ↓
4. 必要な空き容量を計算
   ↓
5. 古いプロジェクトから順に削除
   ↓
6. 目標の空き容量に達するまで削除を継続
```

## 📊 監視とアラート

### 推奨される監視項目

1. **削除実行の確認**
   - Vercelのログで削除が正常に実行されているか確認
   - エラーが発生していないか確認

2. **ストレージ使用量**
   - 定期的に `/api/interview/storage/check` を確認
   - 1TB超過で警告、4TB超過で危険レベル

3. **削除されたプロジェクト数**
   - ログで削除されたプロジェクト数を確認
   - 異常に多い場合は調査が必要

## 🛡️ セーフティ機能

### エラーハンドリング

- 個別のプロジェクト削除でエラーが発生しても、次のプロジェクトの処理を継続
- エラーはログに記録され、レスポンスに含まれる

### 認証

- Vercel Cron Jobsからのリクエストのみ受け付け
- 本番環境では認証トークンが必要

## 📝 設定

### Vercel Cron Jobsの設定

`vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/interview/projects/cleanup",
      "schedule": "0 2 * * *"
    }
  ]
}
```

- `schedule`: Cron形式（毎日午前2時）
- `path`: 実行するAPIエンドポイント

### 環境変数

- `CRON_SECRET` または `VERCEL_CRON_SECRET`: 認証トークン（オプション）

## 🔍 トラブルシューティング

### 削除が実行されない

1. Vercel Cron Jobsの設定を確認
2. ログでエラーを確認
3. 認証設定を確認

### ファイルが削除されない

1. GCSの権限を確認
2. ファイルURLが正しいか確認
3. エラーログを確認

### 容量が減らない

1. GCSの実際の使用量を確認
2. データベースとGCSの同期を確認
3. 手動でクリーンアップを実行

## 📈 パフォーマンス

### 実行時間

- プロジェクト数に応じて変動
- 通常は数秒〜数分

### リソース使用量

- サーバーレス関数の実行時間制限内で完了
- 大量のプロジェクトがある場合は、バッチ処理を検討

## 🔗 関連ドキュメント

- [GCS仕様書](./gcs-specification.md)
- [セキュリティチェックリスト](./security-checklist.md)

