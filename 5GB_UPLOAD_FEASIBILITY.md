# 5GB動画アップロード対応の技術的検討

## 現在の状況

### ✅ 既に実装済み（5GB対応可能な部分）

1. **GCSアップロード**
   - Google Cloud Storageは5TBまで対応可能
   - チャンクアップロード機能が実装済み（4MBチャンク）
   - バックエンドAPIは既に5TBまで対応（`src/app/api/interview/materials/upload-chunk/route.ts`）

2. **フロントエンド**
   - チャンクアップロード機能が実装済み
   - Vercelの4.5MB制限を回避する仕組みが実装済み

### ❌ 制限がある部分（1GB制限）

1. **フロントエンドのファイルサイズチェック**
   - `src/app/interview/page.tsx`: `MAX_FILE_SIZE = 1GB`

2. **文字起こしAPI**
   - `src/app/api/interview/transcribe/route.ts`: `MAX_FILE_SIZE = 1GB`

3. **Cloud Runサービス**
   - `cloudrun-services/interview-transcribe/src/transcribe.ts`: `MAX_FILE_SIZE = 1GB`
   - メモリ: 2Gi
   - タイムアウト: 3600秒（1時間）

## 5GB対応に必要な変更

### 1. フロントエンドの変更

**ファイル**: `src/app/interview/page.tsx`

```typescript
// 変更前
const MAX_FILE_SIZE = 1024 * 1024 * 1024 // 1GB

// 変更後
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024 // 5GB
```

### 2. 文字起こしAPIの変更

**ファイル**: `src/app/api/interview/transcribe/route.ts`

```typescript
// 変更前
const MAX_FILE_SIZE = 1024 * 1024 * 1024 // 1GB

// 変更後
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024 // 5GB
```

### 3. Cloud Runサービスの変更

**ファイル**: `cloudrun-services/interview-transcribe/src/transcribe.ts`

```typescript
// 変更前
const MAX_FILE_SIZE = 1024 * 1024 * 1024 // 1GB

// 変更後
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024 // 5GB
```

**ファイル**: `cloudrun-services/interview-transcribe/deploy.sh`

```bash
# 変更前
--memory 2Gi \
--timeout 3600 \

# 変更後（5GBファイル処理用）
--memory 4Gi \  # メモリを増やす（5GBファイルの処理に必要）
--timeout 7200 \  # タイムアウトを2時間に延長（大容量ファイル処理に時間がかかる）
```

## 技術的な考慮事項

### ✅ 可能な理由

1. **アップロード処理**
   - チャンクアップロードが実装済み
   - GCSは5TBまで対応可能
   - バックエンドAPIは既に5TBまで対応

2. **FFmpeg処理**
   - FFmpegは5GBファイルの処理が可能
   - メモリを増やせば処理可能

3. **Google Cloud Speech-to-Text API**
   - ファイルサイズの制限はない（GCS URI経由）
   - 処理時間は長くなるが、技術的には可能

### ⚠️ 注意点

1. **処理時間**
   - 5GBの動画ファイルの文字起こしには数時間かかる可能性がある
   - Cloud Runのタイムアウトを延長する必要がある（最大3600秒 = 1時間、2nd genでは最大3600秒）

2. **メモリ使用量**
   - 5GBファイルの処理には十分なメモリが必要
   - メモリを4Gi以上に増やす必要がある

3. **コスト**
   - 処理時間が長くなるため、Cloud Runのコストが増加
   - GCSのストレージコストも増加

4. **Cloud Runのタイムアウト制限**
   - Cloud Run 1st gen: 最大3600秒（1時間）
   - Cloud Run 2nd gen: 最大3600秒（1時間）
   - 5GBファイルの処理が1時間を超える場合は、非同期処理やバッチ処理の検討が必要

## 推奨される実装方法

### 方法1: 同期処理（推奨）

1. フロントエンド、API、Cloud Runのファイルサイズ制限を5GBに変更
2. Cloud Runのメモリを4Giに増やす
3. タイムアウトを3600秒（最大）に設定
4. 処理時間が長いことをユーザーに通知

### 方法2: 非同期処理（大容量ファイル向け）

1. アップロード後、バックグラウンドで文字起こしを実行
2. 処理状況をポーリングで確認
3. 完了時に通知

## 結論

**技術的には可能です。**

必要な変更：
- ファイルサイズ制限を1GB → 5GBに変更（3箇所）
- Cloud Runのメモリを2Gi → 4Giに増やす
- タイムアウトを3600秒（最大）に設定

注意点：
- 処理時間が長くなる（数時間の可能性）
- コストが増加する可能性
- ユーザーに処理時間を通知する必要がある

