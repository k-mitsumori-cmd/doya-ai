# Google Cloud Storage CORS設定ガイド

## 問題
クライアント側から直接Google Cloud Storageにアップロードする場合、CORS（Cross-Origin Resource Sharing）設定が必要です。
CORS設定がないと、ブラウザからGCSへのPUTリクエストがブロックされます。

## 解決方法

### 方法1: スクリプトを使用（最も簡単）

プロジェクトルートにある `setup-cors.sh` を実行：

```bash
./setup-cors.sh
```

### 方法2: Google Cloud Shellを使用（推奨）

1. Google Cloud Shellを開く
   - https://shell.cloud.google.com/ にアクセス
   - または、Google Cloud Console右上の「Cloud Shell」アイコンをクリック

2. 以下のコマンドを実行：

```bash
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
```

### 方法3: ローカルのgsutilコマンドを使用

1. Google Cloud Consoleにアクセス
   - https://console.cloud.google.com/storage/browser/doya-interview-storage

2. バケットを選択
   - `doya-interview-storage` をクリック

3. 「構成」タブを開く
   - バケット詳細ページの「構成」タブをクリック

4. CORS設定を追加
   - 「CORS」セクションを探す
   - 「CORS設定を編集」または「CORS設定を追加」をクリック

5. 以下のJSONを貼り付け：

```json
[
  {
    "origin": ["*"],
    "method": ["PUT", "GET", "HEAD", "POST", "DELETE"],
    "responseHeader": ["Content-Type", "Content-Length", "x-goog-resumable"],
    "maxAgeSeconds": 3600
  }
]
```

6. 「保存」をクリック

### 方法2: gsutilコマンドで設定

```bash
# CORS設定ファイルを作成
cat > cors-config.json << EOF
[
  {
    "origin": ["*"],
    "method": ["PUT", "GET", "HEAD", "POST", "DELETE"],
    "responseHeader": ["Content-Type", "Content-Length", "x-goog-resumable"],
    "maxAgeSeconds": 3600
  }
]
EOF

# CORS設定を適用
gsutil cors set cors-config.json gs://doya-interview-storage
```

### 方法3: より制限的なCORS設定（本番環境推奨）

本番環境では、特定のドメインのみを許可することを推奨します：

```json
[
  {
    "origin": [
      "https://doya-ai.surisuta.jp",
      "https://*.surisuta.jp"
    ],
    "method": ["PUT", "GET", "HEAD"],
    "responseHeader": ["Content-Type", "Content-Length", "x-goog-resumable"],
    "maxAgeSeconds": 3600
  }
]
```

## 設定の確認

設定後、以下のコマンドで確認できます：

```bash
gsutil cors get gs://doya-interview-storage
```

または、Google Cloud Consoleの「構成」タブで確認できます。

## トラブルシューティング

### CORSエラーが続く場合

1. ブラウザのキャッシュをクリア
2. 設定が反映されるまで数分待つ
3. ブラウザの開発者ツール（F12）でネットワークタブを確認
   - エラーメッセージに「CORS」が含まれているか確認

### 署名付きURLの有効期限

署名付きURLは1時間有効です。アップロードに時間がかかる場合は、タイムアウト時間を延長してください。

## 参考資料

- [Google Cloud Storage CORS設定](https://cloud.google.com/storage/docs/configuring-cors)
- [gsutil cors コマンド](https://cloud.google.com/storage/docs/gsutil/commands/cors)

