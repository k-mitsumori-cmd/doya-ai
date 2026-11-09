# 明示的な会社・ツール組織連携の席予約

本番の会社権限flagはoffで、連携APIは404だった。隔離環境では旧linkToolOrgが満席2席で3人の組織帰属を保存し、人数変更中でも保存した。旧helperの実SQL3群を履歴として保持する。本修正はこの明示POSTを対象とし、会社権限flagの有効化や本番顧客の連携は行わない。

## 保存時の決まり

- 元と先の確認できた調整ガードをキー順で取得する。関係User、会社、現在の会社役割、組織、ツール役割の順に固定する。SQL識別子は11ツールの固定表だけを使い、値はパラメーターで渡す。
- 会社admin以上と現在のツール最上位権限を再確認する。会社の所有者は中央メンバー行を必要としない。不明・矛盾した役割は拒否する。
- 新規連携の直前と保存後に、実際の所属・招待の和集合と購入席を同じ取引で確認する。人数不足・控え不明・金融処理中・壊れた金融状態は拒否し、行と監査を巻き戻す。
- 同じ会社に連携済みなら、権限確認後に200とし、監査と人数の更新を増やさない。別会社への連携済みは409。
- 作成者と現在ownerが異なり自動帰属がsetup-requiredの組織も、この明示POSTでは現在の権限を確認して設定できる。自動で古い支払元を推測しない。
- User.plan、中央メンバー、会社プロフィール、Stripe数量・課金を変更しない。SQL取引内で外部通信を行わない。

## 検証

python3 scripts/security-regression/verify-company-tool-link-seat-admission-postgres.py

本体のAPI envelope・POST・helper・会社license・Prismaと専用Unix socket PostgreSQLを使う。認証と入口の会社context、価格と金融状態は合成。11ツールそれぞれの空き席/満席、現在権限、同一User、閲覧guest、変更のない再実行、監査SQL後の故障による両行rollback、pricing off、明示setup、二組織最終席、二会社の同時連携、古いcacheの拒否を含む48群。会社/ツールの遅い降格と、実勤怠追加APIとの競合では実pg_stat_activityのLock待機も確認する。

作成者の合成データはownerとmemberのcreatedAtを明示して順序を固定する。同時刻のid順で別の人を作成者と見なす初期fixtureを修正した。旧fixtureの失敗は履歴に残し、本体の403を不適切に409へ変更しない。

CIは48群とsource hash、private応答、停止確認を保存する。合成Stripeやprivate SQLの合格を、実OAuth・実金融・本番flag有効化の受入にしない。解除・自動連携・profile・HR支払元方針・全writerは未完了。
