#!/bin/bash
# Cloud Runサービスデプロイ用スクリプト

set -e

echo "========================================="
echo "Cloud Runサービス デプロイ準備"
echo "========================================="
echo ""

# PATHを設定
export PATH=/opt/homebrew/share/google-cloud-sdk/bin:"$PATH"

# プロジェクトディレクトリに移動
cd "/Users/mitsumori_katsuki/Library/CloudStorage/GoogleDrive-k-mitsumori@surisuta.jp/マイドライブ/01_事業管理/09_Cursol/cloudrun-services/interview-transcribe"

echo "ステップ1: Google Cloud CLIの認証"
echo "----------------------------------------"
echo "以下のコマンドでログインしてください："
echo ""
echo "  gcloud auth login"
echo ""
echo "ブラウザが開きますので、Googleアカウントでログインしてください。"
echo ""
read -p "ログインが完了したら Enter キーを押してください..."

# 認証状態を確認
echo ""
echo "認証状態を確認中..."
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
  echo "エラー: 認証が完了していません。gcloud auth login を実行してください。"
  exit 1
fi

echo "✓ 認証が完了しました"

# プロジェクト一覧を取得
echo ""
echo "ステップ2: プロジェクトの選択"
echo "----------------------------------------"
echo "利用可能なプロジェクト一覧："
gcloud projects list --format="table(projectId,name,projectNumber)"

echo ""
echo "DOYA-AI プロジェクトのIDを確認中..."

# DOYA-AIプロジェクトを検索
PROJECT_ID=$(gcloud projects list --filter="name:DOYA-AI OR projectId:DOYA-AI" --format="value(projectId)" | head -1)

if [ -z "$PROJECT_ID" ]; then
  echo "警告: DOYA-AI プロジェクトが見つかりませんでした。"
  echo "プロジェクトIDを手動で入力してください："
  read -p "プロジェクトID: " PROJECT_ID
else
  echo "✓ プロジェクトIDが見つかりました: $PROJECT_ID"
fi

# プロジェクトを設定
echo ""
echo "ステップ3: プロジェクトの設定"
echo "----------------------------------------"
gcloud config set project "$PROJECT_ID"
echo "✓ プロジェクトを設定しました: $PROJECT_ID"

# 環境変数を設定
export GOOGLE_CLOUD_PROJECT_ID="$PROJECT_ID"
echo "✓ 環境変数を設定しました: GOOGLE_CLOUD_PROJECT_ID=$PROJECT_ID"

# デプロイスクリプトを実行
echo ""
echo "ステップ4: Cloud Runサービスをデプロイ"
echo "----------------------------------------"
echo "デプロイスクリプトを実行します..."
echo ""

./deploy.sh

echo ""
echo "========================================="
echo "デプロイ準備完了"
echo "========================================="

