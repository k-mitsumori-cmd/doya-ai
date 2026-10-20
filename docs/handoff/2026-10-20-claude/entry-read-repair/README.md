# SFA・商談準備の入口読取補修

初回の組織確認が失敗したとき、SFAは組織作成フォーム、商談準備は未ログイン画面へ進んでいました。読取失敗を未所属や未ログインと区別し、再読み込みを表示するよう補修しました。利用者切替後の古い組織確認、作成成功、401からのログイン開始も破棄します。

共通hookは既存のbounded readerを使い、本文を含め35秒・64KiBに制限します。SDKがloadingでもCookieによる読取は開始します。確認済み利用者の変更時は入力と送信ロックを別の世代へ切り替えます。authenticatedのまま同じ利用者IDのsession objectだけが更新される場合は、入力と読取結果を保ちます。認証状態がloadingを経由する場合は世代を更新し、入力と確認結果を破棄して再確認します。履歴復元時は所属を再確認します。組織の確認に成功した通常遷移と、UI-next/従来の表示分岐を保持しました。

対象は入口2画面と新しい共通hookです。SFAの担当者別閲覧・編集ACL、API、DB定義、課金処理、OrgBoundaryは変更していません。

## 確認

- 実ReactコンポーネントをStrictModeでマウントし、合成session/HTTP/SDKで42ケース確認しました。実通信・DB・OAuth・有料APIは使っていません。
- 修正前sourceに同じfixtureを適用すると10合格・32不合格、修正後は42合格でした。件数は検証条件の数であり、不具合の数ではありません。
- 通信・HTTP失敗、不正応答、所属不一致、actor変更、ABA、unmount、期限切れ、BFC復元、SDK loading、二重押下、旧作成200/401の後着、手動再読み込みを確認しました。
- 既存の送信回帰18ケースも合格しました。抽出handlerに新しいscope fixture値だけを追加し、既存assertionは削除・緩和していません。
- TSX2本と共通hookの対象Lintは、警告・エラーとも0でした。型検査と統合gateの最終状態はverification.jsonと親作業の記録を参照します。

## 実行方法

`node scripts/security-regression/verify-organization-entry-mounted.cjs`

追加環境変数は不要です。共通runnerへの登録は統合担当が行います。スクリプトのDOYA_ENTRY_BASELINEは修正前source比較専用で、CIには設定しません。

## Reactレビュー

React Best Practicesスキルを適用しました。hooksは各コンポーネントで無条件に呼び、利用者世代をkeyにした小さな境界で入力を分けました。読取effectの依存はprimitive値と安定したcallbackに限定し、cleanupで取消します。エラーにはrole=alert、再読込にはbuttonを使っています。既存のLP・Skeleton・DS分岐を維持し、UIライブラリは追加していません。

ローカルのNextは15.5.25です。指定のnode_modules/next/dist/docsはこのcheckoutに存在しませんでした。今回はNextの新しいAPIを導入せず、既存useRouterのreplaceだけを継続利用しています。

本番反映・実認証での手動操作確認は未実施です。コミット・pushはしていません。

Luna利用: 未使用。通常のCodexで再現・補修・検証しました。
