#!/bin/bash
# Cloud Runサービスをデプロイするスクリプト

set -e

echo "========================================="
echo "Cloud Run音声変換サービス デプロイ"
echo "========================================="

# プロジェクトIDを確認
if [ -z "$GOOGLE_CLOUD_PROJECT_ID" ]; then
  echo "エラー: GOOGLE_CLOUD_PROJECT_ID 環境変数が設定されていません"
  echo ""
  echo "設定方法:"
  echo "  export GOOGLE_CLOUD_PROJECT_ID=\"your-project-id\""
  exit 1
fi

echo "プロジェクトID: $GOOGLE_CLOUD_PROJECT_ID"

# Google Cloudプロジェクトを設定
gcloud config set project $GOOGLE_CLOUD_PROJECT_ID

# 必要なAPIを有効化
echo ""
echo "必要なAPIを有効化中..."
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable speech.googleapis.com
gcloud services enable storage.googleapis.com

# サービスアカウントの確認
echo ""
echo "サービスアカウントを確認中..."
SA_EMAIL="interview-transcribe-sa@$GOOGLE_CLOUD_PROJECT_ID.iam.gserviceaccount.com"

if ! gcloud iam service-accounts describe $SA_EMAIL &>/dev/null; then
  echo "サービスアカウントを作成中..."
  gcloud iam service-accounts create interview-transcribe-sa \
    --display-name="Interview Transcribe Service Account"
  
  echo "権限を付与中..."
  gcloud projects add-iam-policy-binding $GOOGLE_CLOUD_PROJECT_ID \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/speech.admin"
  
  gcloud projects add-iam-policy-binding $GOOGLE_CLOUD_PROJECT_ID \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/storage.objectViewer"
  
  gcloud projects add-iam-policy-binding $GOOGLE_CLOUD_PROJECT_ID \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/storage.objectAdmin"
else
  echo "サービスアカウントは既に存在します"
fi

# 認証情報の確認
if [ -z "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
  echo ""
  echo "警告: GOOGLE_APPLICATION_CREDENTIALS 環境変数が設定されていません"
  echo "サービスアカウントキーを作成しますか？ (y/n)"
  read -r response
  if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo "サービスアカウントキーを作成中..."
    gcloud iam service-accounts keys create key.json \
      --iam-account=$SA_EMAIL
    
    export GOOGLE_APPLICATION_CREDENTIALS_JSON=$(cat key.json | jq -c)
    echo "✓ サービスアカウントキーを作成しました"
    echo "  ファイル: key.json"
    echo "  環境変数: GOOGLE_APPLICATION_CREDENTIALS_JSON が設定されました"
  else
    echo "エラー: GOOGLE_APPLICATION_CREDENTIALS が必要です"
    exit 1
  fi
else
  # JSON文字列として設定されている場合
  if [[ "$GOOGLE_APPLICATION_CREDENTIALS" == \{* ]]; then
    export GOOGLE_APPLICATION_CREDENTIALS_JSON="$GOOGLE_APPLICATION_CREDENTIALS"
  else
    # ファイルパスの場合
    export GOOGLE_APPLICATION_CREDENTIALS_JSON=$(cat "$GOOGLE_APPLICATION_CREDENTIALS" | jq -c)
  fi
fi

# Cloud Runにデプロイ
echo ""
echo "Cloud Runにデプロイ中..."
echo "（これには数分かかる場合があります）"

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
  --set-env-vars GOOGLE_CLOUD_PROJECT_ID="$GOOGLE_CLOUD_PROJECT_ID" \
  --set-env-vars GOOGLE_APPLICATION_CREDENTIALS="$GOOGLE_APPLICATION_CREDENTIALS_JSON" \
  --service-account $SA_EMAIL

# サービスURLを取得
echo ""
echo "========================================="
echo "デプロイ完了"
echo "========================================="

SERVICE_URL=$(gcloud run services describe interview-transcribe-service \
  --platform managed \
  --region asia-northeast1 \
  --format 'value(status.url)')

echo ""
echo "✓ サービスURL: $SERVICE_URL"
echo ""
echo "次のステップ:"
echo "1. このURLをVercelの環境変数に設定してください:"
echo "   CLOUDRUN_TRANSCRIBE_SERVICE_URL=$SERVICE_URL"
echo ""
echo "2. ヘルスチェックを実行:"
echo "   curl $SERVICE_URL/health"
echo ""

