# OpenID discoveryのURL解析互換修正

2026-11-09。本番のGoogle認証開始POSTでDEP0169警告を1件観測した。リクエストはHTTP200で、同じ26.058分の窓のfatalと5xxは0件だった。警告は未解消として監査表に残しており、この文書だけで本番修正済みとは扱わない。

元のopenid-client 5.7.1のissuer.jsを改変せずnode_modules外へ複写すると、Issuer.discoverからresolveWellKnownUriのurl.parse呼び出しによる警告を再現できた。元のnode_modules配置では警告が出ず、Nodeのapplication deprecationの説明と整合する。本番の完全な呼出スタックは取得していないため、本番呼出元の同定はこの再現に基づく推論である。

## 修正

バージョンと完全なソースハッシュを固定したインストール時の互換修正で、discovery URLの解決だけをWHATWG URLへ置き換える。プロバイダー設定、取得したメタデータ、認証情報、state/PKCE、トークン・署名・claimsの検証は既存SDKを使う。アプリへGoogleのメタデータを固定登録する変更や、警告の抑制は行わない。

対象はopenid-client 5.7.1。元のissuer.jsのSHA256はb6dba55f5577e18c9438238782000bbd95d36d45b036fdb065dd24ef66be41f3、修正後は92965efe7055bc4dced4cc3f37183a760ec2536c400f062aa774aea434a9b436。別バージョン・未知の内容・未対応の配置は、書き込む前に失敗させる。依存更新時は互換修正の撤去または再検証が必要になる。

postinstallでscripts/dependency-patches/openid-discovery-url.cjsを実行してから、既存のprisma generateを実行する。DBのpushやmigrationは行わない。適用済みの同じソースには再適用しない。共有node_modulesや対象ソースのシンボリックリンクへの書き込みを拒否する。Codexの共有依存キャッシュは変更していない。

## 検証範囲

- 適用・再実行・未知の内容・異なるバージョン・共有依存・シンボリックリンクのガード8条件と、所有するインストール先でのCLI適用/再実行を検証する。
- 元のSDKと修正後のSDKを使い、実NextAuthクライアントとOIDC暗号処理を動かす。各18条件、12個のdiscovery URIのHTTP境界引数と、正常/拒否の結果を照合する。
- state、PKCE、認可応答issuerの不一致/欠落、ID tokenのissuer/audience/期限/署名、nonce、tokenエラーを確認する。現在のGoogle構成のwell-known URIは同じ文字列を取得する。
- HTTP境界をすべて置き換え、ローカル生成した署名付きの合成ID tokenと公開鍵を使う。実プロバイダー通信、実ログイン、通知は行わない。
- 通常のCI/Build検証は、インストール済みSDKが修正後のハッシュであることを必須にする。ローカル共有キャッシュでの明示的なfixtureモードは、このインストール受入と区別して記録する。

これらはアプリの実DBセッション、実際のGoogleログイン、ネイティブブラウザ、本番での警告解消を受け入れたことにはならない。CI・Build・プレビューと配信後の観測は別に確認する。

## 出典

- [Node DEP0169](https://nodejs.org/download/release/v24.20.0/docs/api/deprecations.html#DEP0169)
- [Google discovery document](https://accounts.google.com/.well-known/openid-configuration)（2026-11-09確認）
- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)
- 現在のpackage-lock.json、next-auth 4.24.15とopenid-client 5.7.1の実ソース
