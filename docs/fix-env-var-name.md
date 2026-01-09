# 環境変数名の修正手順

## 問題
環境変数名が `GOOGLE_APPLICATION_CREDENT` になっていますが、正しくは `GOOGLE_APPLICATION_CREDENTIALS` です。

## 修正手順

### 1. Vercelダッシュボードにログイン
1. https://vercel.com にアクセス
2. ログイン

### 2. プロジェクトを選択
1. プロジェクト一覧から `doya-ai` を選択

### 3. 環境変数の設定画面を開く
1. 上部のタブから **Settings** をクリック
2. 左サイドバーから **Environment Variables** をクリック

### 4. 間違った環境変数を削除
1. `GOOGLE_APPLICATION_CREDENT` を探す
2. その行の右側にある **削除アイコン（ゴミ箱）** をクリック
3. 確認ダイアログで **削除** をクリック

### 5. 正しい環境変数を追加
1. **Add New** ボタンをクリック
2. **Key** に以下を入力（完全に一致させる）:
   ```
   GOOGLE_APPLICATION_CREDENTIALS
   ```
   ⚠️ 注意: 大文字小文字も完全に一致させる必要があります
   - ✅ 正しい: `GOOGLE_APPLICATION_CREDENTIALS`
   - ❌ 間違い: `GOOGLE_APPLICATION_CREDENT` (途中で切れている)
   - ❌ 間違い: `google_application_credentials` (小文字)
   - ❌ 間違い: `GOOGLE_APPLICATION_CREDENTIAL` (末尾のSがない)

3. **Value** にサービスアカウントキーのJSONを1行で貼り付け:
   ```json
   {"type":"service_account","project_id":"gen-lang-client-0767544294",...}
   ```
   ⚠️ 注意: 改行を含めず、1行で貼り付けてください

4. **Environment** で以下をすべてチェック:
   - ☑ Production
   - ☑ Preview
   - ☑ Development

5. **Save** をクリック

### 6. 他の環境変数も確認
以下の環境変数も正しく設定されているか確認してください:

- **GOOGLE_CLOUD_PROJECT_ID**
  - 値: `gen-lang-client-0767544294`

- **GCS_BUCKET_NAME**
  - 値: `doya-interview-storage`（または実際のバケット名）

### 7. 再デプロイ
1. 環境変数を変更した後、**必ず再デプロイ**が必要です
2. 上部のタブから **Deployments** をクリック
3. 最新のデプロイメントの右側にある **...** メニューをクリック
4. **Redeploy** をクリック
5. 確認ダイアログで **Redeploy** をクリック

### 8. 確認
再デプロイ完了後、再度ファイルアップロードを試してください。エラーが解消されているはずです。

## よくある間違い

| 間違った名前 | 正しい名前 |
|------------|----------|
| `GOOGLE_APPLICATION_CREDENT` | `GOOGLE_APPLICATION_CREDENTIALS` |
| `google_application_credentials` | `GOOGLE_APPLICATION_CREDENTIALS` |
| `GOOGLE_APPLICATION_CREDENTIAL` | `GOOGLE_APPLICATION_CREDENTIALS` |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | `GOOGLE_APPLICATION_CREDENTIALS` |

## トラブルシューティング

### エラーが続く場合
1. Vercelダッシュボードで環境変数名が完全に一致しているか再確認
2. 環境変数の値（JSON）が正しい形式か確認
3. 再デプロイを実行したか確認
4. Vercelのログ（Functions > Logs）で詳細なエラー情報を確認

