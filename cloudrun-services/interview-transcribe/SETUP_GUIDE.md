# Cloud Runサービス セットアップガイド

このガイドでは、ターミナルでCloud Runサービスをデプロイする手順を説明します。

## 前提条件

- macOS（WindowsやLinuxの場合はコマンドが若干異なります）
- ターミナルアプリケーション（macOS標準のターミナルでOK）

## ステップ1: Google Cloud CLIのインストール

### 方法1: Homebrewを使用（推奨）

ターミナルで以下のコマンドを実行：

```bash
# Homebrewがインストールされているか確認
brew --version

# Homebrewがインストールされていない場合、以下のコマンドを実行
# /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Google Cloud SDKをインストール
brew install --cask google-cloud-sdk
```

### 方法2: インストーラーを使用

1. https://cloud.google.com/sdk/docs/install にアクセス
2. macOS用のインストーラーをダウンロード
3. インストーラーを実行

### インストール後の確認

新しいターミナルウィンドウを開いて（または `source ~/.zshrc` を実行）、以下を確認：

```bash
gcloud --version
```

## ステップ2: Google Cloud CLIの初期化

```bash
# Google Cloud CLIを初期化
gcloud init
```

初期化時に以下を設定：
1. **ログイン**: Googleアカウントでログイン（ブラウザが開きます）
2. **プロジェクト選択**: `DOYA-AI` プロジェクトを選択

## ステップ3: プロジェクトディレクトリに移動

```bash
# 現在のディレクトリを確認
pwd

# プロジェクトのルートディレクトリに移動（まだの場合）
cd "/Users/mitsumori_katsuki/Library/CloudStorage/GoogleDrive-k-mitsumori@surisuta.jp/マイドライブ/01_事業管理/09_Cursol"

# Cloud Runサービスディレクトリに移動
cd cloudrun-services/interview-transcribe

# 現在のディレクトリを確認
pwd
# 出力: .../09_Cursol/cloudrun-services/interview-transcribe
```

## ステップ4: 環境変数を設定

```bash
# Google CloudプロジェクトIDを設定
export GOOGLE_CLOUD_PROJECT_ID="DOYA-AI"

# 確認
echo $GOOGLE_CLOUD_PROJECT_ID
# 出力: DOYA-AI
```

## ステップ5: デプロイスクリプトを実行

```bash
# デプロイスクリプトに実行権限があることを確認
ls -l deploy.sh
# 出力の最初に "x" が含まれていればOK（例: -rwxr-xr-x）

# デプロイスクリプトを実行
./deploy.sh
```

デプロイには数分かかります。完了すると、サービスURLが表示されます。

## ステップ6: サービスURLを確認

デプロイが完了したら、サービスURLが表示されます。例：

```
✓ サービスURL: https://interview-transcribe-service-xxxxx-an.a.run.app
```

このURLをコピーしておきます。

## ステップ7: Vercelの環境変数に設定

1. Vercelダッシュボードにアクセス: https://vercel.com/dashboard
2. プロジェクト「doya-ai」を選択
3. Settings → Environment Variables に移動
4. 「Add New」をクリック
5. 以下を入力：
   - **Name**: `CLOUDRUN_TRANSCRIBE_SERVICE_URL`
   - **Value**: ステップ6で取得したURL
   - **Environment**: Production, Preview, Development（すべてチェック）
6. 「Save」をクリック
7. 「Deployments」タブで再デプロイを実行

## トラブルシューティング

### gcloudコマンドが見つからない

- 新しいターミナルウィンドウを開く
- または、`source ~/.zshrc` を実行（zshの場合）
- または、`source ~/.bash_profile` を実行（bashの場合）

### 認証エラーが発生した場合

```bash
# 再ログイン
gcloud auth login

# アプリケーションのデフォルト認証情報を設定
gcloud auth application-default login
```

### プロジェクトIDがわからない場合

```bash
# 現在のプロジェクトを確認
gcloud config get-value project

# 利用可能なプロジェクト一覧を表示
gcloud projects list

# プロジェクトを設定
gcloud config set project DOYA-AI
```

### デプロイエラーが発生した場合

```bash
# デプロイログを確認
gcloud run services describe interview-transcribe-service \
  --platform managed \
  --region asia-northeast1

# ビルドログを確認（Cloud Build）
gcloud builds list --limit=5
```

## まとめ

1. ✅ Google Cloud CLIをインストール
2. ✅ `gcloud init` で初期化
3. ✅ プロジェクトディレクトリに移動
4. ✅ 環境変数を設定
5. ✅ `./deploy.sh` を実行
6. ✅ サービスURLを確認
7. ✅ Vercelの環境変数に設定

これで完了です！

