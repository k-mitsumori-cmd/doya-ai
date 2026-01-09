# Google Cloud Storage Workload Identity Federation セットアップガイド

このガイドでは、VercelとGoogle Cloud StorageをWorkload Identity Federationで連携する手順を説明します。

## 前提条件

- Google Cloud Platform（GCP）のプロジェクトが作成されていること
- GCPプロジェクトのオーナーまたはIAM管理者の権限があること
- Vercelプロジェクトが作成されていること

## 手順1: Workload Identity Poolの作成

### GCP Consoleを使用する場合

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 「IAMと管理」→「Workload Identity Federation」を選択
3. 「プールを作成」をクリック
4. 以下の情報を入力:
   - **プール名**: `vercel-pool`（任意）
   - **プールID**: `vercel-pool`（自動生成）
   - **説明**: `Vercelからの認証用プール`
5. 「続行」をクリック

### gcloud CLIを使用する場合

```bash
gcloud iam workload-identity-pools create vercel-pool \
  --project=PROJECT_ID \
  --location=global \
  --display-name="Vercel Pool"
```

## 手順2: Workload Identity Providerの作成

### GCP Consoleを使用する場合

1. 作成したプールを選択
2. 「プロバイダを追加」をクリック
3. プロバイダタイプ: **OpenID Connect (OIDC)** を選択
4. 以下の情報を入力:
   - **プロバイダ名**: `vercel-provider`
   - **プロバイダID**: `vercel-provider`（自動生成）
   - **発行者URI**: `https://id.vercel.com`
   - **許可されたオーディエンス**: `https://id.vercel.com`（または空欄）
5. 「属性マッピング」セクション:
   - **Google属性**: `google.subject`
   - **属性値**: `assertion.sub`
   - 「マッピングを追加」をクリック
6. 「保存」をクリック

### gcloud CLIを使用する場合

```bash
gcloud iam workload-identity-pools providers create-oidc vercel-provider \
  --project=PROJECT_ID \
  --location=global \
  --workload-identity-pool=vercel-pool \
  --display-name="Vercel Provider" \
  --issuer-uri="https://id.vercel.com" \
  --allowed-audiences="https://id.vercel.com" \
  --attribute-mapping="google.subject=assertion.sub"
```

## 手順3: サービスアカウントの作成

### GCP Consoleを使用する場合

1. 「IAMと管理」→「サービスアカウント」を選択
2. 「サービスアカウントを作成」をクリック
3. 以下の情報を入力:
   - **サービスアカウント名**: `doya-interview-storage`
   - **サービスアカウントID**: `doya-interview-storage`（自動生成）
   - **説明**: `Doya Interview AI用のストレージサービスアカウント`
4. 「作成して続行」をクリック
5. ロールの付与:
   - 「Cloud Storage」→「Storage オブジェクト管理者」を選択
6. 「完了」をクリック

### gcloud CLIを使用する場合

```bash
# サービスアカウントを作成
gcloud iam service-accounts create doya-interview-storage \
  --project=PROJECT_ID \
  --display-name="Doya Interview AI Storage"

# ロールを付与
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:doya-interview-storage@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

## 手順4: サービスアカウントへのなりすまし権限の設定

Workload Identity Poolからサービスアカウントになりすます権限を付与します。

### GCP Consoleを使用する場合

1. 作成したサービスアカウントを選択
2. 「権限」タブを開く
3. 「プリンシパルを追加」をクリック
4. 以下の情報を入力:
   - **新しいプリンシパル**: 
     ```
     principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/vercel-pool/attribute.vercel_team_id/YOUR_VERCEL_TEAM_ID
     ```
     - `PROJECT_NUMBER`: GCPプロジェクト番号（プロジェクト設定で確認）
     - `YOUR_VERCEL_TEAM_ID`: VercelのチームID（Vercelダッシュボードで確認）
   - **ロール**: 「Service Account」→「Service Account User」
5. 「保存」をクリック

### gcloud CLIを使用する場合

```bash
# プロジェクト番号を取得
PROJECT_NUMBER=$(gcloud projects describe PROJECT_ID --format="value(projectNumber)")

# なりすまし権限を付与
gcloud iam service-accounts add-iam-policy-binding \
  doya-interview-storage@PROJECT_ID.iam.gserviceaccount.com \
  --project=PROJECT_ID \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/vercel-pool/attribute.vercel_team_id/YOUR_VERCEL_TEAM_ID"
```

## 手順5: Vercelでの環境変数設定

Vercelダッシュボードで以下の環境変数を設定します:

1. Vercelダッシュボード → プロジェクト → Settings → Environment Variables

2. 以下の環境変数を追加:

   **`GOOGLE_CLOUD_PROJECT_ID`**
   ```
   値: プロジェクトID（例: doya-interview-123456）
   ```

   **`GCS_BUCKET_NAME`**
   ```
   値: バケット名（例: doya-interview-storage）
   ```

   **`GCP_PROJECT_NUMBER`**
   ```
   値: プロジェクト番号（プロジェクト設定で確認）
   ```

   **`GCS_WORKLOAD_IDENTITY_POOL`**
   ```
   値: vercel-pool（作成したプール名）
   ```

   **`GCS_WORKLOAD_IDENTITY_PROVIDER`**
   ```
   値: vercel-provider（作成したプロバイダ名）
   ```

   **`GCS_SERVICE_ACCOUNT_EMAIL`**
   ```
   値: doya-interview-storage@PROJECT_ID.iam.gserviceaccount.com
   ```

   **`VERCEL_TEAM_ID`**（オプション）
   ```
   値: VercelのチームID（Vercelダッシュボードで確認）
   ```

3. 環境: Production, Preview, Development すべてに適用

## 手順6: 重要な注意事項

**⚠️ 現在の制限事項:**

Vercelは現在、OIDCトークンを直接提供していないため、Workload Identity Federationを直接使用することはできません。

### 代替解決策

以下のいずれかの方法を使用してください:

#### 方法A: 組織ポリシーを無効化してサービスアカウントキーを使用（推奨）

1. 組織ポリシー管理者に依頼して、`iam.disableServiceAccountKeyCreation`ポリシーを無効化
2. サービスアカウントキーを作成
3. `GOOGLE_APPLICATION_CREDENTIALS`環境変数に設定

#### 方法B: 個別の環境変数を使用

サービスアカウントキーのJSONから必要な情報を個別の環境変数に設定:

- `GCS_CLIENT_EMAIL`
- `GCS_PRIVATE_KEY`
- `GCS_PRIVATE_KEY_ID`
- `GCS_CLIENT_ID`
- `GCS_CLIENT_X509_CERT_URL`

#### 方法C: 将来的な対応

VercelがOIDCトークンを提供するようになった場合、このWorkload Identity Federationの設定が使用可能になります。

## トラブルシューティング

### エラー: "Principal not found"

- プリンシパルの形式が正しいか確認
- プロジェクト番号が正しいか確認
- VercelチームIDが正しいか確認

### エラー: "Permission denied"

- サービスアカウントに適切なロールが付与されているか確認
- Workload Identity Poolからサービスアカウントへのなりすまし権限が設定されているか確認

### エラー: "Invalid token"

- Workload Identity Providerの設定が正しいか確認
- 発行者URIが `https://id.vercel.com` であることを確認

## 参考資料

- [Workload Identity Federation の概要](https://cloud.google.com/iam/docs/workload-identity-federation)
- [Vercel のドキュメント](https://vercel.com/docs)

