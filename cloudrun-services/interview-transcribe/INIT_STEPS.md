# gcloud初期化とデプロイ手順

Google Cloud CLIがインストールされました。次に以下の手順を進めてください。

## ステップ1: gcloudの初期化（手動で実行）

ターミナルで以下のコマンドを実行してください：

```bash
# PATHを設定（新しいターミナルの場合は必要）
export PATH=/opt/homebrew/share/google-cloud-sdk/bin:"$PATH"

# gcloudを初期化
gcloud init
```

**初期化時に以下を選択してください：**
1. **ログイン**: `Y` を入力（ブラウザが開きます）
2. **アカウント選択**: Googleアカウントを選択してログイン
3. **プロジェクト選択**: `DOYA-AI` を選択（番号を入力）
4. **デフォルトリージョン**: `asia-northeast1` を選択

## ステップ2: デプロイの準備

初期化が完了したら、以下を実行：

```bash
# プロジェクトディレクトリに移動
cd "/Users/mitsumori_katsuki/Library/CloudStorage/GoogleDrive-k-mitsumori@surisuta.jp/マイドライブ/01_事業管理/09_Cursol/cloudrun-services/interview-transcribe"

# プロジェクトIDを設定
export GOOGLE_CLOUD_PROJECT_ID="DOYA-AI"

# PATHを設定（新しいターミナルの場合）
export PATH=/opt/homebrew/share/google-cloud-sdk/bin:"$PATH"

# 確認
gcloud config get-value project
# 出力: DOYA-AI
```

## ステップ3: デプロイスクリプトを実行

```bash
# デプロイスクリプトを実行
./deploy.sh
```

デプロイには数分かかります。完了すると、サービスURLが表示されます。

## トラブルシューティング

### gcloudコマンドが見つからない場合

新しいターミナルウィンドウを開いた場合、PATHを設定してください：

```bash
export PATH=/opt/homebrew/share/google-cloud-sdk/bin:"$PATH"
```

### 永続的にPATHを設定する場合

`~/.zshrc` に以下を追加：

```bash
export PATH=/opt/homebrew/share/google-cloud-sdk/bin:"$PATH"
```

その後、新しいターミナルを開くか、以下を実行：

```bash
source ~/.zshrc
```

