# Vercel環境変数設定ガイド

## 必要な環境変数

以下の3つの環境変数をVercelダッシュボードで設定してください。

### 1. GOOGLE_CLOUD_PROJECT_ID

- **値**: `gen-lang-client-0767544294`
- **重要**: 環境変数名は完全に一致している必要があります（大文字小文字も含む）

### 2. GCS_BUCKET_NAME

- **値**: `doya-interview-storage`（または実際のバケット名）
- **重要**: 環境変数名は完全に一致している必要があります

### 3. GOOGLE_APPLICATION_CREDENTIALS

- **値**: サービスアカウントキーのJSONを**1行で**貼り付け
- **重要**: 
  - 環境変数名は `GOOGLE_APPLICATION_CREDENTIALS` である必要があります（`GOOGLE_APPLICATION_CREDENT` など、途中で切れていないか確認）
  - JSONを1行で貼り付ける必要があります（改行を含めない）
  - 例:
  ```json
  {"type":"service_account","project_id":"gen-lang-client-0767544294","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}
  ```

## 設定手順

1. Vercelダッシュボードにログイン
2. プロジェクト（`doya-ai`）を選択
3. **Settings** > **Environment Variables** を開く
4. 各環境変数を追加：
   - **Key**: 環境変数名（例: `GOOGLE_APPLICATION_CREDENTIALS`）
   - **Value**: 値（JSONの場合は1行で貼り付け）
   - **Environment**: `Production`, `Preview`, `Development` すべてにチェック
5. **Save** をクリック
6. **Redeploy** を実行（環境変数を変更した場合は再デプロイが必要）

## よくある問題

### 問題1: 環境変数名が間違っている

- `GOOGLE_APPLICATION_CREDENT` → `GOOGLE_APPLICATION_CREDENTIALS`（完全な名前）
- 大文字小文字も正確に一致させる必要があります

### 問題2: JSONの形式が正しくない

- 改行を含めず、1行で貼り付ける
- JSONの構文エラーがないか確認（カンマ、引用符など）

### 問題3: 環境変数が反映されない

- 環境変数を変更した後、**必ず再デプロイ**を実行してください
- Vercelダッシュボードで「Redeploy」をクリック

### 問題4: 一部の環境でのみエラーが発生

- 環境変数の設定で、`Production`, `Preview`, `Development` すべてにチェックが入っているか確認

## 確認方法

デプロイ後、Vercelのログを確認してください。以下のようなログが表示されます：

```
[GCS] Checking environment variables...
[GCS] GOOGLE_CLOUD_PROJECT_ID: ✓ (gen-lang-client-0767...)
[GCS] GCS_BUCKET_NAME: ✓ (doya-interview-storage)
[GCS] GOOGLE_APPLICATION_CREDENTIALS: ✓ (set (1234 chars))
```

もし `✗` が表示されている場合は、その環境変数が設定されていません。

