# 2026-10-28 開発監査の修正

ユーザーから本番修正の許可を受け、監査で再現した問題へ対応する。

## DBアクセス制御

本番設定の接続先とロールを確認し、publicの243テーブルでRLSを有効にした。既存8テーブルを含め251テーブルがRLS有効となった。行、列、既存ポリシー、GRANT、Storageは変更していない。

適用前には、対象の243テーブルにポリシーがなく、アプリ接続がBYPASSRLSを持ち、anon/authenticatedがそれを持たないことを再確認した。独立したPG17上で14ケースの適用・基本CRUD・復旧検査も再実行した。適用はlock_timeout=2s、statement_timeout=15sの単一トランザクションで行った。

適用後、anon/authenticatedのrow_security_active=trueとUser可視行数0、実アプリ接続での0件SELECT、公開テンプレートAPIの200を確認した。RLSのみを有効にし、テーブルGRANTは残るため、匿名RESTの0件GETが200であることだけでは失敗・成功を判定しない。

初回適用はCOMMIT後の確認でP2010となった。新しい接続による再確認では全251テーブルのRLSとアプリ接続の正常性を確認できた。適用済みの変更を二重実行せず、再確認結果を別に記録した。

SQLはenable-public-table-rls.sql。復旧用SQLも保存したが、匿名アクセスを再度開くため、通常のアプリ修正時に実行しない。適用のためのcustom settingのreview guardと、直前のロール・テーブル確認が必要。

## アプリ

- バナー履歴と9つの個人データAPIで、成功・拒否・エラー応答をprivateApiJsonに統一。Cache-Control: private, no-store とVary: Cookieを返す。
- 履歴画面の取得にもcache: no-storeを付ける。
- HRの従業員登録・更新で、姓/名の型と空文字、JSONのrootを保存前に検査する。
- SEO自動修正はSchema検証失敗を400にする。
- ロゴ受付はformData解析失敗を400にする。
- SEOカテゴリ画像は実在するPrisma列を使用し、WebPのMIMEと二重URLデコードを修正する。

API応答の本文・権限・正常な保存処理を維持する。従量生成、決済、メール/Slackの実送信は行わない。SFAの製品権限方針は今回変更しない。

## 検証

verify-audit-input-cache.cjsは実装を読み込み、private JSON、A/Bの履歴、未ログイン、SEOの入力拒否/正常保存、ロゴの解析失敗を検査する。security runnerに追加した。CIの画面fixtureは現在の(shell)配下のパスと現行部品へ合わせ、旧文言と未モック依存を更新する。

検証結果、公開コミットとデプロイ結果は、実行完了後の作業記録へ追記する。準備済みと公開済みを混同しない。

制作記録: Codexで修正・検証。Lunaは未使用。

ビルド後のNext生成型の検査で、5ファイルに7件の引数型エラーが出たため、params/searchParamsをPromise型へ統一した。通常buildの末尾でもtscを実行し、生成後の型も検査する。

追加のCI fixtureは実装のimage-entitlements/creation-receipt/user-errorなどを読み込めるように修正した。Persona画像7ケース、SFA権限のprivate PG検査、追加8つのmounted検査が合格した。入力・画像APIは実HTTP16/16、人事・勤怠は65/65、セキュリティrunnerと16種類のサービステストもローカルで合格した。

Next.js/eslint-config-nextを15.5.28、DOMPurifyを3.4.17へ更新するlockfileを作成した。lockfileのnpm auditでCriticalは2から0へ減少したが、High10/Moderate3は残る。ローカルの共有依存は変更せず、更新された依存のインストールとビルドはCIで検証する。本番反映済みとはこの時点では記載しない。
