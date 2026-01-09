#!/bin/bash

# Google Cloud Storage CORS設定スクリプト
# 使用方法: ./setup-cors.sh

BUCKET_NAME="doya-interview-storage"
CORS_CONFIG_FILE="/tmp/cors-config.json"

echo "=========================================="
echo "Google Cloud Storage CORS設定"
echo "=========================================="
echo ""
echo "バケット名: $BUCKET_NAME"
echo ""

# CORS設定ファイルを作成
cat > "$CORS_CONFIG_FILE" << 'EOF'
[
  {
    "origin": ["*"],
    "method": ["PUT", "GET", "HEAD", "POST", "DELETE"],
    "responseHeader": ["Content-Type", "Content-Length", "x-goog-resumable"],
    "maxAgeSeconds": 3600
  }
]
EOF

echo "CORS設定ファイルを作成しました: $CORS_CONFIG_FILE"
echo ""
cat "$CORS_CONFIG_FILE"
echo ""
echo "=========================================="
echo ""

# gsutilがインストールされているか確認
if ! command -v gsutil &> /dev/null; then
    echo "エラー: gsutilがインストールされていません"
    echo ""
    echo "インストール方法:"
    echo "1. Google Cloud SDKをインストール: https://cloud.google.com/sdk/docs/install"
    echo "2. または、Google Cloud Shellを使用してください"
    echo ""
    echo "Google Cloud Shellを使用する場合:"
    echo "1. https://shell.cloud.google.com/ にアクセス"
    echo "2. 以下のコマンドを実行:"
    echo ""
    cat << 'SHELL_CMD'
cat > cors-config.json << 'EOF'
[
  {
    "origin": ["*"],
    "method": ["PUT", "GET", "HEAD", "POST", "DELETE"],
    "responseHeader": ["Content-Type", "Content-Length", "x-goog-resumable"],
    "maxAgeSeconds": 3600
  }
]
EOF

gsutil cors set cors-config.json gs://doya-interview-storage
gsutil cors get gs://doya-interview-storage
SHELL_CMD
    exit 1
fi

# 認証確認
echo "Google Cloud認証を確認中..."
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "警告: Google Cloudにログインしていません"
    echo "以下のコマンドでログインしてください:"
    echo "  gcloud auth login"
    exit 1
fi

echo "認証済み: $(gcloud auth list --filter=status:ACTIVE --format='value(account)' | head -1)"
echo ""

# CORS設定を適用
echo "CORS設定を適用中..."
if gsutil cors set "$CORS_CONFIG_FILE" "gs://$BUCKET_NAME"; then
    echo ""
    echo "✓ CORS設定が正常に適用されました"
    echo ""
    echo "=========================================="
    echo "現在のCORS設定:"
    echo "=========================================="
    gsutil cors get "gs://$BUCKET_NAME"
    echo ""
    echo "=========================================="
    echo ""
    echo "設定完了！これでクライアント側からのアップロードが可能になります。"
else
    echo ""
    echo "✗ CORS設定の適用に失敗しました"
    echo ""
    echo "考えられる原因:"
    echo "1. バケットへのアクセス権限が不足している"
    echo "2. ネットワーク接続の問題"
    echo ""
    echo "対処方法:"
    echo "1. サービスアカウントに 'Storage Admin' ロールが付与されているか確認"
    echo "2. Google Cloud Shellを使用して再試行"
    exit 1
fi

