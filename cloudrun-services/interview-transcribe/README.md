# Interview Transcribe Service (Cloud Run)

Google Cloud Runで動作する音声変換サービスです。

## 概要

ドヤインタビューAI専用の音声変換サービスです。大きなファイルや長時間の音声ファイルを効率的に処理できます。

## 主な機能

- ✅ **MP4ファイルの自動処理**: FFmpegを使ってMP4ファイルから音声を自動抽出し、FLAC形式に変換して文字起こし
- ✅ **大容量ファイル対応**: 最大1GB、タイムアウト3600秒（1時間）
- ✅ **音声形式の自動最適化**: Speech-to-Text APIに最適な形式（FLAC、16kHz、モノラル）に自動変換

## デプロイ方法

### 1. Google Cloud CLIでデプロイ

```bash
# プロジェクトディレクトリに移動
cd cloudrun-services/interview-transcribe

# Google Cloudプロジェクトを設定
gcloud config set project YOUR_PROJECT_ID

# Cloud Runにデプロイ
gcloud run deploy interview-transcribe-service \
  --source . \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600 \
  --set-env-vars GOOGLE_APPLICATION_CREDENTIALS="$GOOGLE_APPLICATION_CREDENTIALS" \
  --set-env-vars GOOGLE_CLOUD_PROJECT_ID="YOUR_PROJECT_ID"
```

### 2. 環境変数の設定

Cloud Runの環境変数を設定：

- `GOOGLE_APPLICATION_CREDENTIALS`: サービスアカウントキーのJSON文字列
- `GOOGLE_CLOUD_PROJECT_ID`: Google CloudプロジェクトID

### 3. サービスURLの確認

デプロイ後、サービスURLを取得：

```bash
gcloud run services describe interview-transcribe-service \
  --platform managed \
  --region asia-northeast1 \
  --format 'value(status.url)'
```

## API仕様

### POST /transcribe

音声ファイルを文字起こしします。

**リクエストボディ:**
```json
{
  "gcsUri": "gs://bucket-name/path/to/file",
  "mimeType": "audio/mpeg",
  "fileName": "audio.mp3",
  "isVideoFile": false,
  "fileSize": 1048576
}
```

**レスポンス:**
```json
{
  "success": true,
  "transcription": "文字起こしテキスト..."
}
```

## ローカル開発

```bash
# 依存関係をインストール
npm install

# 開発サーバーを起動
npm run dev
```

## 処理フロー

1. **MP4ファイルの検出**: MP4ファイルがアップロードされると、自動的に音声抽出が必要と判定
2. **音声抽出**: GCSからMP4ファイルをダウンロードし、FFmpegを使って音声を抽出
3. **FLAC変換**: 抽出した音声をFLAC形式に変換（16kHz、モノラル、最適化）
4. **GCS再アップロード**: 変換されたFLACファイルをGCSにアップロード
5. **文字起こし**: Speech-to-Text APIを使ってFLACファイルを文字起こし
6. **クリーンアップ**: 一時ファイルを自動削除

## 注意事項

- このサービスはドヤインタビューAI専用です
- 他のサービスに影響を与えないよう、完全に分離されています
- 最大ファイルサイズ: 1GB
- タイムアウト: 3600秒（1時間）
- **FFmpegが必要**: DockerfileにFFmpegがインストールされています
- **MP4ファイル対応**: MP4ファイルは自動的に音声が抽出され、FLAC形式に変換されます

