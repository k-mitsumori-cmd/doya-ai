# Vercelデプロイメント制限エラーの解決方法

## エラーの内容
```
Resource is limited - try again in 7 hours (more than 100, code: "api-deployments-free-per-day")
```

## 原因
Vercelの無料プラン（Hobby）では、1日あたり100回のデプロイメントに制限があります。この制限に達したため、手動デプロイが7時間ブロックされています。

## 解決方法

### 方法1: 自動デプロイを確認（推奨）
GitHubリポジトリへのプッシュで自動デプロイが開始されるはずです。以下を確認してください：

1. **GitHubリポジトリのWebhook設定を確認**
   - URL: `https://github.com/k-mitsumori-cmd/doya-ai/settings/hooks`
   - VercelのWebhookが存在し、"Active" になっているか確認
   - 最近のWebhookの配信履歴を確認（エラーがないか）

2. **Vercelのプロジェクト設定を確認**
   - URL: `https://vercel.com/surisutas-projects/doya-ai/settings/git`
   - Gitリポジトリが正しく接続されているか確認
   - `deployment_status Events` と `repository_dispatch Events` が有効になっているか確認

3. **最新のコミットを確認**
   - 現在の最新コミット: `abe48672` - "fix: 全ての文字起こし完了待機ロジックのデプロイを確実に反映"
   - GitHubリポジトリ: `https://github.com/k-mitsumori-cmd/doya-ai/commits/main`
   - このコミットがGitHubにプッシュされているか確認

### 方法2: Vercel Proプランにアップグレード
手動デプロイの制限を解除するには、Vercel Proプランにアップグレードしてください：

1. Vercelの設定画面にアクセス: `https://vercel.com/surisutas-projects/doya-ai/settings/billing`
2. "Upgrade to Pro" をクリック
3. Proプランでは、デプロイメント数の制限が大幅に緩和されます

### 方法3: 7時間待つ
無料プランの制限がリセットされるまで（7時間後）待つことができます。

## 自動デプロイが機能しない場合の対処法

### Gitリポジトリの再接続
1. Vercelの設定画面（`https://vercel.com/surisutas-projects/doya-ai/settings/git`）で "Disconnect" をクリック
2. 再度 "Connect Git Repository" をクリックして `k-mitsumori-cmd/doya-ai` を選択
3. これにより、GitHubのWebhookが再設定され、自動デプロイが復旧する可能性があります

### GitHubのWebhookを手動で確認
1. GitHubリポジトリの設定画面（`https://github.com/k-mitsumori-cmd/doya-ai/settings/hooks`）にアクセス
2. VercelのWebhookが存在するか確認
3. 存在しない場合、Vercelの設定画面でGitリポジトリを再接続すると、自動的にWebhookが作成されます

## 現在の状況
- 最新のコミット（`abe48672`）はGitHubリポジトリにプッシュ済み
- 手動デプロイは7時間ブロックされている
- 自動デプロイが機能していれば、GitHubへのプッシュで自動的にデプロイが開始されるはず

## 次のステップ
1. GitHubリポジトリのWebhook設定を確認
2. Vercelのプロジェクト設定でGitリポジトリの接続を確認
3. 自動デプロイが機能していない場合、Gitリポジトリを再接続
4. それでも解決しない場合、Vercel Proプランへのアップグレードを検討

