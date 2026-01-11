# 403エラーの修正方法

## 問題
Cloud Runサービスへのアクセスが403 Forbiddenで拒否されています。

## 原因
Next.jsアプリケーションが使用するサービスアカウントに、Cloud Run Invoker権限が設定されていません。

## 解決方法

### ステップ1: サービスアカウントのメールアドレスを確認

1. Vercelダッシュボードにアクセス
2. プロジェクト設定 > Environment Variables
3. `GOOGLE_APPLICATION_CREDENTIALS`環境変数を確認
4. JSONの中の`client_email`フィールドを確認

例：
```json
{
  "type": "service_account",
  "project_id": "doya-ai",
  "client_email": "your-service-account@doya-ai.iam.gserviceaccount.com",
  ...
}
```

### ステップ2: Cloud Run Invoker権限を付与

以下のコマンドを実行してください（`YOUR_SERVICE_ACCOUNT_EMAIL`を実際のメールアドレスに置き換えてください）：

```bash
gcloud run services add-iam-policy-binding interview-transcribe-service \
  --region=asia-northeast1 \
  --member='serviceAccount:YOUR_SERVICE_ACCOUNT_EMAIL' \
  --role='roles/run.invoker'
```

### ステップ3: 確認

権限が正しく設定されたか確認：

```bash
gcloud run services get-iam-policy interview-transcribe-service \
  --region=asia-northeast1
```

## 注意事項
- 権限の変更は数秒で反映されます
- 複数のサービスアカウントを使用している場合は、すべてに権限を付与する必要があります
