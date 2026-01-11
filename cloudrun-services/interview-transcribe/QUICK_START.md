# クイックスタート: Cloud Runサービスをデプロイ

## 最も簡単な方法

### ステップ1: 環境変数を設定

```bash
# プロジェクトディレクトリに移動
cd cloudrun-services/interview-transcribe

# Google CloudプロジェクトIDを設定
export GOOGLE_CLOUD_PROJECT_ID="your-project-id"

# サービスアカウントキーを設定（既にある場合）
export GOOGLE_APPLICATION_CREDENTIALS='{"type":"service_account",...}'
```

### ステップ2: デプロイスクリプトを実行

```bash
./deploy.sh
```

これで自動的に：
- 必要なAPIが有効化されます
- サービスアカウントが作成されます
- 権限が設定されます
- Cloud Runサービスがデプロイされます
- サービスURLが表示されます

## 手動でデプロイする場合

### 1. Google Cloudプロジェクトを設定

```bash
gcloud config set project YOUR_PROJECT_ID
```

### 2. 必要なAPIを有効化

```bash
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable speech.googleapis.com
gcloud services enable storage.googleapis.com
```

### 3. サービスアカウントを作成

```bash
gcloud iam service-accounts create interview-transcribe-sa \
  --display-name="Interview Transcribe Service Account"

# 権限を付与
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:interview-transcribe-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/speech.admin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:interview-transcribe-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectViewer"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:interview-transcribe-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

### 4. サービスアカウントキーを作成

```bash
gcloud iam service-accounts keys create key.json \
  --iam-account=interview-transcribe-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com

export GOOGLE_APPLICATION_CREDENTIALS_JSON=$(cat key.json | jq -c)
```

### 5. Cloud Runにデプロイ

```bash
gcloud run deploy interview-transcribe-service \
  --source . \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600 \
  --set-env-vars GOOGLE_CLOUD_PROJECT_ID="YOUR_PROJECT_ID" \
  --set-env-vars GOOGLE_APPLICATION_CREDENTIALS="$GOOGLE_APPLICATION_CREDENTIALS_JSON" \
  --service-account interview-transcribe-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

### 6. サービスURLを取得

```bash
gcloud run services describe interview-transcribe-service \
  --platform managed \
  --region asia-northeast1 \
  --format 'value(status.url)'
```

## トラブルシューティング

### gcloudコマンドが見つからない場合

Google Cloud CLIをインストール:
```bash
# macOS
brew install google-cloud-sdk

# 初期化
gcloud init
```

### プロジェクトIDがわからない場合

Google Cloud Consoleで確認:
1. https://console.cloud.google.com/ にアクセス
2. プロジェクトセレクター（画面上部）でプロジェクトIDを確認

### 権限エラーが発生した場合

必要な権限を確認:
- Cloud Run Admin
- Service Account User
- Cloud Build Editor

