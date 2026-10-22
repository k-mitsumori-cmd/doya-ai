# Shodan membership R1：招待・受諾・初回作成

02f9a4ebを基準に、追加13入力をauthor freezeしました。内訳はruntime 4、専用PG 2、承認済み旧fixture 6、専用fixture adapter 1です。既存member 6入力と合わせた19入力で、ShodanMemberの直接書込7箇所を同じ退会予約規約へ接続しています。これは局所検証済みの候補です。全体型検査・ビルド・CI・配備は統合担当の別ゲートです。

追加13のset hashは `58c83cb8b4a017242921e058338b1d480d56b09bdf296904c7dec1c5f2615725`、Shodan合計19は `e979c9c3b038a6bb2d58bbe7038e6ad2d9f99cac6cae5bf0ea40027becbacb07` です。正本は [source-inputs.json](source-inputs.json) です。member 6とIncome 5の元hashは不変です。schema/package/runner/CI/Homeは変更していません。

招待発行では、actorとcanonical ownerをUserから順にlockします。locked状態でroleと重複を再読し、期限切れ招待の置換と新規保存を同Txで行います。受信者の登録有無・退会状態に関わらず、従来どおりunbound PENDINGを保存します。48時間の期限、同格以上の招待禁止、ACTIVE/PENDING重複の拒否を保持しています。メールはcommit後です。送信結果falseなら保存済み招待とprivateなfallback URLを返します。送信例外時も招待は残り、自動再送しません。

受諾は、認証session IDに対応するlocked DB Userのemailを本人判定に使います。古い・欠落したSDK emailだけで正当な本人を拒否しません。User、組織、memberの順にlockし、email/token/role/binding/status/48時間を再確認してCASします。既参加時の招待掃除も同Txです。保存後に期限を跨いだ場合も全rollbackします。

旧版が作った同本人bound PENDINGは、実Userが存在し、初回bindingが認証本人と一致し、locked DB emailとinviteEmailが一致する場合だけ通常のreal User targetとして扱います。coreのunbound pendingClaim条件は緩めていません。別User binding、dangling binding、status/role/token変更、退会中は拒否し、別Userへ結び直しません。歴史行用のassertは招待・受諾に流用していません。

初回作成では、User実在lockと退会予約確認を組織・owner作成より先に行います。既存の正当な所属のreplay/readは、退会予約だけで一律遮断しません。同時初回作成は1組織へ収束し、未知のACTIVE roleを新組織作成へfallbackしません。

追加実PGは61契約、member変更の実PGは82契約が合格しました。旧6fixtureも合格し、135個の元assert ASTをすべて保持しています。追加7 ASTはauthority/不正fence等の負例です。role組合せ120期待も不変です。adapterは正常fixtureの明示seedだけを使い、actorのowner昇格や不正authorityの修復、実在fenceの空値化をしません。合成PENDINGの古いmarkerをnullへ直したのは、元からunbound招待を意図したShodan fixtureだけです。実PGにはdangling拒否と有効bound本人の成功を別々に残しています。

同じ最終PG fixtureで旧runtimeを読み、退会予約中の発行200、User不在の作成200、古いsession emailでの本人受諾403を反例として保存しました。現在の期待はそれぞれ409/409/200です。正当な同本人bound PENDINGは旧新とも200です。反例は安全性の合格件数へ含めません。[before-after.json](before-after.json) に実行した旧runtimeのhashを記録しています。

対象runtimeのLintと限定型検査、9 test入力の構文、diff checkが合格しています。限定型検査は実runtime/coreと型付きPrisma/auth/email境界を使い、全体tscの代わりにはしていません。PGは自分のUnix socket隔離インスタンスだけを使い、test/stopとも0、所有ディレクトリ削除を確認済みです。実メール・有料provider・本番接続は0です。[verification.json](verification.json) と [postgres-results.json](postgres-results.json) を参照してください。

統合担当向け実行は `python3 scripts/security-regression/verify-shodan-closure-postgres.py` です。PostgreSQL 17のローカルbin（任意で `DOYA_PRIVATE_POSTGRES_BIN`）が必要です。通常の接続先envは使わず、supervisorが自分のsocket/rootを生成します。child上限180秒、外側timeoutは240秒を推奨します。既存member PGも独立stepです。追加の旧fixtureは既存runnerで列挙済みで、共通loader/runnerの変更はありません。

[writer-coverage.json](writer-coverage.json) は7書込のhelper・同Tx範囲・fixture対応表です。Shodanの通常data/AI/content writer、他サービスのR1、R2課金外部能力、R3退会統合、元のglobal unsafe観測2件は未完了です。手動DB操作で同じopaque User IDを再挿入する経路の完全直列化、旧worker drain、全退会完了、配備済み安全性は主張しません。既存role120 fixtureが生成する旧audit JSONの変更は保存し、この13入力へ混ぜていません。
