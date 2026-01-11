# セキュリティ修正: Google Cloud認証情報の削除

## 問題
GitGuardianがGitHubリポジトリ内でGoogle Cloud Keysを検出しました。

## 対応内容

### 1. 機密情報を含むファイルの削除
以下のファイルをリポジトリから削除しました：
- `cloudrun-services/interview-transcribe/key.json`
- `cloudrun-services/interview-transcribe/env-vars.yaml`
- `cloudrun-services/interview-transcribe/env-vars-temp.yaml`

### 2. .gitignoreの更新
これらのファイルを`.gitignore`に追加し、今後のコミットを防止しました。

### 3. Git履歴のクリーンアップ
過去のコミット履歴からも認証情報を削除するため、`git filter-branch`を使用して履歴を書き換えました。

## 重要な注意事項

### ⚠️ 漏洩した認証情報の無効化が必要です

以下のサービスアカウントキーが漏洩した可能性があります：

1. **interview-transcribe-sa@doya-ai.iam.gserviceaccount.com**
   - プライベートキーID: `7301fedd072852efe8917dfbe1d33758d07c7521`
   - プライベートキーID: `f725a800228e2b806360b99c71a63f543a234ef6`

### 推奨される対応

1. **Google Cloud Consoleでサービスアカウントキーを無効化**
   ```
   gcloud iam service-accounts keys list \
     --iam-account=interview-transcribe-sa@doya-ai.iam.gserviceaccount.com
   
   gcloud iam service-accounts keys delete <KEY_ID> \
     --iam-account=interview-transcribe-sa@doya-ai.iam.gserviceaccount.com
   ```

2. **新しいサービスアカウントキーを生成**
   ```
   gcloud iam service-accounts keys create key.json \
     --iam-account=interview-transcribe-sa@doya-ai.iam.gserviceaccount.com
   ```

3. **環境変数の更新**
   - Vercelの環境変数 `GOOGLE_APPLICATION_CREDENTIALS` を新しいキーで更新
   - Cloud Runサービスの環境変数 `GOOGLE_APPLICATION_CREDENTIALS_B64` を新しいキーで更新

## 今後の対策

1. **機密情報は環境変数として管理**
   - ローカルファイル（`key.json`など）をリポジトリにコミットしない
   - VercelやCloud Runの環境変数として設定

2. **.gitignoreの徹底**
   - 認証情報を含む可能性のあるファイルパターンを`.gitignore`に追加済み

3. **GitGuardianの継続的な監視**
   - GitHubリポジトリでGitGuardianを有効化し、機密情報の漏洩を監視

## 修正日時
2026-01-11

