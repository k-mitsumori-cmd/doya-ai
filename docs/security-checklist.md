# セキュリティチェックリスト

## ✅ 確認済み項目

### 1. サービスアカウントキーファイルの確認
- ✅ サービスアカウントキーファイル（`gen-lang-client-0767544294-17a1d2f3aa83.json`）はリポジトリに含まれていません
- ✅ ファイルは `/Users/mitsumori_katsuki/Downloads/` にのみ存在（ワークスペース外）
- ✅ `.gitignore` にサービスアカウントキーファイルのパターンを追加済み

### 2. 機密情報のコード内確認
- ✅ サービスアカウントキーの内容がコードに直接含まれていません
- ✅ 環境変数名のみがコードに含まれています（`GOOGLE_APPLICATION_CREDENTIALS`など）

### 3. .gitignoreの設定
- ✅ `.env` ファイルは無視される設定
- ✅ `*.pem` ファイルは無視される設定
- ✅ サービスアカウントキーのJSONファイルパターンを追加済み

## ⚠️ 確認が必要な項目

### 1. GitHubリポジトリの公開設定

以下のリポジトリの公開設定を確認してください：

#### リポジトリ1: `09_Cursol`
- URL: https://github.com/k-mitsumori-cmd/09_Cursol
- 確認方法:
  1. ブラウザで上記URLにアクセス
  2. ログインせずにアクセスできる場合 → **公開リポジトリ**
  3. ログインが必要な場合 → **プライベートリポジトリ**

#### リポジトリ2: `doya-ai`
- URL: https://github.com/k-mitsumori-cmd/doya-ai
- 確認方法: 同上

### 2. 過去のコミット履歴の確認

念のため、過去のコミット履歴に機密情報が含まれていないか確認してください：

```bash
# サービスアカウントキーの内容が含まれていないか確認
git log --all --source -p | grep -i "gen-lang-client" | head -20

# プライベートキーが含まれていないか確認
git log --all --source -p | grep -i "BEGIN PRIVATE KEY" | head -20
```

### 3. Vercel環境変数の確認

Vercelダッシュボードで以下の環境変数が正しく設定されているか確認：

- ✅ `GOOGLE_CLOUD_PROJECT_ID` = `gen-lang-client-0767544294`
- ✅ `GOOGLE_APPLICATION_CREDENTIALS` = （JSONファイルの内容）
- ✅ `GCS_BUCKET_NAME` = （バケット名）

## 🔒 セキュリティのベストプラクティス

### 1. サービスアカウントキーの管理
- ✅ キーファイルはローカルのみに保存（リポジトリに含めない）
- ✅ Vercelの環境変数に設定（暗号化されて保存される）
- ⚠️ 定期的にキーをローテーション（推奨: 90日ごと）

### 2. リポジトリの設定
- ⚠️ プライベートリポジトリに設定することを推奨
- ✅ `.gitignore` に機密ファイルのパターンを追加済み

### 3. アクセス制御
- ⚠️ GitHubリポジトリへのアクセス権限を適切に管理
- ⚠️ Vercelプロジェクトへのアクセス権限を適切に管理

## 🚨 もし機密情報が漏洩した場合の対応

1. **即座にサービスアカウントキーを無効化**
   - Google Cloud Console → IAMと管理 → サービスアカウント
   - 該当するサービスアカウントのキーを削除

2. **新しいサービスアカウントキーを作成**
   - 新しいキーを作成
   - Vercelの環境変数を更新

3. **GitHubの履歴から削除（必要に応じて）**
   - `git filter-branch` または `git filter-repo` を使用
   - または、新しいリポジトリを作成

## 📝 確認手順

### GitHubリポジトリの公開設定を確認する手順

1. **ブラウザでリポジトリにアクセス**
   - https://github.com/k-mitsumori-cmd/09_Cursol
   - https://github.com/k-mitsumori-cmd/doya-ai

2. **ログイン状態を確認**
   - ログアウトした状態でアクセス
   - アクセスできる場合 → **公開リポジトリ**（要対応）
   - アクセスできない場合 → **プライベートリポジトリ**（安全）

3. **プライベートに変更する場合**
   - リポジトリの Settings → General → Danger Zone
   - 「Change repository visibility」をクリック
   - 「Make private」を選択

### Vercel環境変数の確認手順

1. Vercelダッシュボードにログイン
2. プロジェクトを選択
3. Settings → Environment Variables
4. 以下の環境変数が設定されているか確認：
   - `GOOGLE_CLOUD_PROJECT_ID`
   - `GOOGLE_APPLICATION_CREDENTIALS`
   - `GCS_BUCKET_NAME`

