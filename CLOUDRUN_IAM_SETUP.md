# Cloud RunサービスのIAM設定

## 問題
403 Forbiddenエラーが発生しています。これは、Next.jsアプリケーションが使用するサービスアカウントにCloud Run Invoker権限が設定されていないためです。

## 解決方法

### 1. サービスアカウントのメールアドレスを確認
ログに以下のようなメッセージが表示されます：
```
[INTERVIEW]   Service Account: SERVICE_ACCOUNT_EMAIL
```

### 2. Cloud Run Invoker権限を付与
以下のコマンドを実行して、サービスアカウントに権限を付与します：

```bash
gcloud run services add-iam-policy-binding interview-transcribe-service \
  --region=asia-northeast1 \
  --member='serviceAccount:SERVICE_ACCOUNT_EMAIL' \
  --role='roles/run.invoker'
```

`SERVICE_ACCOUNT_EMAIL`は、ログに表示されたサービスアカウントのメールアドレスに置き換えてください。

### 3. 確認
権限が正しく設定されたか確認します：

```bash
gcloud run services get-iam-policy interview-transcribe-service \
  --region=asia-northeast1
```

## 注意事項
- 組織ポリシーで`allUsers`がブロックされているため、サービスアカウントに明示的に権限を付与する必要があります
- 権限の変更は数秒で反映されます
