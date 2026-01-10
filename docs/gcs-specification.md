# Google Cloud Storage (GCS) 仕様書

## 📋 概要

Doya Interview AIでは、Google Cloud Storage (GCS) を使用してインタビュー素材（音声・動画・テキスト・PDF）を保存・管理しています。

## 🗂️ ストレージ構造

### バケット構成

```
gs://doya-interview-storage/
└── interview/
    └── {projectId}/
        └── {timestamp}-{filename}
```

### ファイルパスの例

```
interview/cmk6ay2ff0001le9zh6h3b9y3/1767928439513-C1226.MP4
```

- `interview/`: プレフィックス（すべてのインタビュー素材）
- `{projectId}/`: プロジェクトID（データベースのプロジェクトID）
- `{timestamp}-{filename}`: タイムスタンプとファイル名

## 📊 容量制限とコスト

### 容量制限

- **実質的な上限**: 5TB（ほぼ無制限）
- **推奨使用量**: プロジェクトの規模に応じて調整

### コスト（2024年時点）

#### ストレージ料金（Standard Storage）

| リージョン | 月額料金（GBあたり） |
|-----------|-------------------|
| 東京（asia-northeast1） | $0.020/GB |
| 米国（us-central1） | $0.020/GB |
| 欧州（europe-west1） | $0.020/GB |

**無料枠**: 月5GBまで無料

#### 操作料金

| 操作 | 料金 |
|------|------|
| クラスA操作（書き込み、一覧取得） | 月5,000回まで無料、以降 $0.05/10,000回 |
| クラスB操作（読み取り、削除） | 月50,000回まで無料、以降 $0.004/10,000回 |

#### ネットワーク料金

| 転送先 | 料金（GBあたり） |
|--------|----------------|
| 同一リージョン内 | 無料 |
| 同一大陸内 | $0.01/GB |
| 大陸間 | $0.05/GB |
| インターネット（egress） | 月1GBまで無料、以降 $0.12/GB |

### コスト見積もり例

**月間100GB、1000ファイルの場合:**

- ストレージ: 100GB × $0.020 = **$2.00**
- クラスA操作（アップロード）: 1000回 × $0.05/10,000 = **$0.005**
- クラスB操作（読み取り）: 5000回 × $0.004/10,000 = **$0.002**
- **合計: 約$2.01/月**

## 🔄 自動削除機能

### 3ヶ月自動削除

- **スケジュール**: 毎日午前2時（JST）に実行
- **対象**: 作成から3ヶ月以上経過したプロジェクト
- **削除内容**:
  - GCSバケット内のファイル
  - データベースのプロジェクトと関連データ

### 実装詳細

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

### 容量不足時の自動削除

- **トリガー**: ストレージ容量が不足した場合
- **動作**: 古いプロジェクトから順に削除
- **API**: `/api/interview/storage/cleanup`

## 🔐 セキュリティ

### アクセス制御

- **認証**: サービスアカウントキーを使用
- **権限**: `Storage Object Admin` ロール
- **公開設定**: ファイルは公開設定（`public: true`）

### ファイルURL形式

```
https://storage.googleapis.com/{bucket-name}/{file-path}
```

例:
```
https://storage.googleapis.com/doya-interview-storage/interview/cmk6ay2ff0001le9zh6h3b9y3/1767928439513-C1226.MP4
```

## 📁 対応ファイル形式

### 音声ファイル
- MP3, WAV, M4A, AAC, OGG

### 動画ファイル
- MP4, MOV, AVI, WebM

### テキストファイル
- TXT, MD, DOCX

### PDFファイル
- PDF

### ファイルサイズ制限

- **最大ファイルサイズ**: 5TB（実質的な上限）
- **推奨ファイルサイズ**: 4.5MB以上はチャンクアップロードを使用
- **チャンクサイズ**: 4MB

## 🚀 パフォーマンス

### アップロード速度

- **小さいファイル（<4.5MB）**: 通常アップロード（1回のリクエスト）
- **大きいファイル（>4.5MB）**: チャンクアップロード（複数のリクエスト）

### 可用性

- **SLA**: 99.9%（Standard Storage）
- **耐久性**: 99.999999999%（11ナイン）

## 🔧 管理機能

### 使用状況の確認

```typescript
const usage = await getGCSUsage()
// {
//   totalSize: 1024000000, // バイト単位
//   fileCount: 150
// }
```

### ファイルの削除

```typescript
await deleteFromGCS(fileUrl)
```

### ファイルの取得

```typescript
const buffer = await getFileFromGCS(fileUrl)
```

## 📈 モニタリング

### 推奨される監視項目

1. **ストレージ使用量**
   - 月間のストレージ使用量を監視
   - コスト予算の設定を推奨

2. **操作回数**
   - クラスA/B操作の回数を監視
   - 異常なアクセスパターンを検出

3. **エラー率**
   - アップロード/削除のエラー率を監視
   - 認証エラーの有無を確認

### Google Cloud Consoleでの確認

1. **Cloud Storage** → **バケット** → `doya-interview-storage`
2. **使用量**タブでストレージ使用量を確認
3. **ログ**タブで操作ログを確認

## 🛠️ トラブルシューティング

### よくある問題

#### 1. 認証エラー

**症状**: `Unauthorized` エラー

**解決方法**:
- `GOOGLE_APPLICATION_CREDENTIALS` 環境変数を確認
- サービスアカウントの権限を確認

#### 2. 容量不足

**症状**: `Storage quota exceeded` エラー

**解決方法**:
- 古いプロジェクトを削除
- ストレージ使用量を確認
- 必要に応じて容量を増やす

#### 3. ファイルが見つからない

**症状**: `File not found` エラー

**解決方法**:
- ファイルURLが正しいか確認
- バケット名が正しいか確認
- ファイルが削除されていないか確認

## 📝 ベストプラクティス

### 1. ファイル命名規則

- タイムスタンプを含める（重複を防ぐ）
- プロジェクトIDを含める（整理しやすい）
- 特殊文字を避ける（`_` や `-` を使用）

### 2. 容量管理

- 定期的に使用量を確認
- 不要なファイルを削除
- 3ヶ月自動削除を活用

### 3. コスト最適化

- 不要なファイルを早期に削除
- ストレージクラスを適切に選択（現在はStandard）
- ライフサイクルポリシーを検討

### 4. セキュリティ

- サービスアカウントキーを安全に管理
- 定期的にキーをローテーション
- アクセスログを監視

## 🔗 関連リンク

- [Google Cloud Storage 公式ドキュメント](https://cloud.google.com/storage/docs)
- [料金表](https://cloud.google.com/storage/pricing)
- [ベストプラクティス](https://cloud.google.com/storage/docs/best-practices)

