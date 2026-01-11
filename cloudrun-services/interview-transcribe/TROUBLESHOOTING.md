# トラブルシューティング

## ビルドエラーの確認方法

### 方法1: Google Cloud Consoleで確認（推奨）

1. 以下のURLにアクセス：
   ```
   https://console.cloud.google.com/cloud-build/builds?project=doya-ai
   ```

2. 最新のビルドをクリック

3. ログを確認してエラー原因を特定

### 方法2: gcloudコマンドで確認

```bash
# 最新のビルドIDを取得
BUILD_ID=$(gcloud builds list --limit=1 --format="value(id)")

# ビルドログを表示
gcloud builds log $BUILD_ID

# または、ストリーミングログを表示
gcloud builds log $BUILD_ID --stream
```

## よくあるエラーと解決方法

### エラー1: npm install エラー

**症状**: `npm ci` または `npm install` が失敗する

**解決方法**:
- `package-lock.json` が最新か確認
- 依存関係を再インストール: `npm install`

### エラー2: TypeScriptビルドエラー

**症状**: `npm run build` が失敗する

**解決方法**:
- ローカルでビルドを確認: `npm run build`
- TypeScriptのバージョンを確認
- `tsconfig.json` の設定を確認

### エラー3: FFmpegインストールエラー

**症状**: `apt-get install ffmpeg` が失敗する

**解決方法**:
- Dockerfileで`apt-get update`を確実に実行
- ネットワーク接続を確認

### エラー4: 環境変数の設定エラー

**症状**: `GOOGLE_APPLICATION_CREDENTIALS` が正しく設定されない

**解決方法**:
- `env-vars.yaml` の形式を確認
- JSON文字列が正しくエスケープされているか確認
- YAMLの引用符の使い方を確認

## デプロイをやり直す場合

```bash
# プロジェクトディレクトリに移動
cd cloudrun-services/interview-transcribe

# PATHを設定
export PATH=/opt/homebrew/share/google-cloud-sdk/bin:"$PATH"

# 環境変数を設定
export GOOGLE_CLOUD_PROJECT_ID="doya-ai"

# サービスアカウントキーを作成（まだの場合）
gcloud iam service-accounts keys create key.json \
  --iam-account=interview-transcribe-sa@doya-ai.iam.gserviceaccount.com

# 環境変数ファイルを作成
CREDS_JSON=$(cat key.json | jq -c . | sed 's/"/\\"/g')
cat > env-vars.yaml << EOF
GOOGLE_CLOUD_PROJECT_ID: doya-ai
GOOGLE_APPLICATION_CREDENTIALS: '${CREDS_JSON}'
EOF

# デプロイ
echo "Y" | gcloud run deploy interview-transcribe-service \
  --source . \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600 \
  --max-instances 10 \
  --min-instances 0 \
  --env-vars-file env-vars.yaml \
  --service-account interview-transcribe-sa@doya-ai.iam.gserviceaccount.com
```

