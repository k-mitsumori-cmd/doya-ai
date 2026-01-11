# Cloud Run音声変換サービス デプロイ手順

ドヤインタビューAI専用のGoogle Cloud Run音声変換サービスのデプロイ手順です。

## 前提条件

- Google Cloudプロジェクトが作成されていること
- Google Cloud CLI (`gcloud`) がインストールされていること
- サービスアカウントキーが作成されていること

## デプロイ手順

### 1. Google Cloudプロジェクトの設定

```bash
# プロジェクトIDを設定
export PROJECT_ID="your-project-id"
gcloud config set project $PROJECT_ID
```

### 2. 必要なAPIを有効化

```bash
# Cloud Run APIを有効化
gcloud services enable run.googleapis.com

# Cloud Build APIを有効化（ソースからデプロイする場合）
gcloud services enable cloudbuild.googleapis.com

# Speech-to-Text APIを有効化
gcloud services enable speech.googleapis.com

# Cloud Storage APIを有効化
gcloud services enable storage.googleapis.com
```

### 3. サービスアカウントの作成と権限設定

```bash
# サービスアカウントを作成（既にある場合はスキップ）
gcloud iam service-accounts create interview-transcribe-sa \
  --display-name="Interview Transcribe Service Account"

# 必要な権限を付与
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:interview-transcribe-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/speech.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:interview-transcribe-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectViewer"
```

### 4. サービスアカウントキーの作成

```bash
# サービスアカウントキーを作成
gcloud iam service-accounts keys create key.json \
  --iam-account=interview-transcribe-sa@$PROJECT_ID.iam.gserviceaccount.com

# キーの内容を環境変数として設定（JSON文字列として）
export GOOGLE_APPLICATION_CREDENTIALS_JSON=$(cat key.json | jq -c)
```

### 5. Cloud Runにデプロイ

```bash
# プロジェクトディレクトリに移動
cd cloudrun-services/interview-transcribe

# Cloud Runにデプロイ（ソースから直接デプロイ）
gcloud run deploy interview-transcribe-service \
  --source . \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600 \
  --max-instances 10 \
  --min-instances 0 \
  --set-env-vars GOOGLE_CLOUD_PROJECT_ID=$PROJECT_ID \
  --set-env-vars GOOGLE_APPLICATION_CREDENTIALS="$GOOGLE_APPLICATION_CREDENTIALS_JSON" \
  --service-account interview-transcribe-sa@$PROJECT_ID.iam.gserviceaccount.com
```

### 6. サービスURLの取得

```bash
# デプロイ後、サービスURLを取得
export SERVICE_URL=$(gcloud run services describe interview-transcribe-service \
  --platform managed \
  --region asia-northeast1 \
  --format 'value(status.url)')

echo "Service URL: $SERVICE_URL"
```

### 7. Vercel環境変数の設定

Vercelダッシュボードで以下の環境変数を設定：

```
CLOUDRUN_TRANSCRIBE_SERVICE_URL=https://interview-transcribe-service-xxxxx-an.a.run.app
```

## 動作確認

### 1. ヘルスチェック

```bash
curl $SERVICE_URL/health
```

期待されるレスポンス:
```json
{
  "status": "ok",
  "service": "interview-transcribe"
}
```

### 2. 音声変換のテスト

```bash
curl -X POST $SERVICE_URL/transcribe \
  -H "Content-Type: application/json" \
  -d '{
    "gcsUri": "gs://your-bucket/path/to/audio.mp3",
    "mimeType": "audio/mpeg",
    "fileName": "audio.mp3",
    "isVideoFile": false,
    "fileSize": 1048576
  }'
```

## トラブルシューティング

### エラー: Service account not found

サービスアカウントが存在しない場合：
```bash
gcloud iam service-accounts create interview-transcribe-sa \
  --display-name="Interview Transcribe Service Account"
```

### エラー: Permission denied

権限が不足している場合：
```bash
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:interview-transcribe-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/speech.admin"
```

### エラー: API not enabled

APIが有効化されていない場合：
```bash
gcloud services enable speech.googleapis.com
gcloud services enable storage.googleapis.com
```

## 注意事項

- このサービスはドヤインタビューAI専用です
- 他のサービスに影響を与えないよう、完全に分離されています
- 最大ファイルサイズ: 1GB
- タイムアウト: 3600秒（1時間）
- メモリ: 2GB
- CPU: 2コア

## 更新方法

```bash
# プロジェクトディレクトリに移動
cd cloudrun-services/interview-transcribe

# 変更をコミット後、再デプロイ
gcloud run deploy interview-transcribe-service \
  --source . \
  --platform managed \
  --region asia-northeast1
```

