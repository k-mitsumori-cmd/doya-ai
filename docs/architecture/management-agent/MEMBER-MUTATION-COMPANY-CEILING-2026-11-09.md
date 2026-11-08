# 既存メンバー変更時の会社権限再確認

会社権限を強制する設定では、AIO・商談・見積・面接・AI商談の権限変更/削除が、処理開始時のctxに残る古い権限を使っていた。会社adminをmember/guestへ引き下げた後でも、別メンバーの更新/削除が成功することを隔離SQLで再現した。

各処理の同じトランザクション内で、domainのメンバー行をロックする前にceilToolRoleを再実行する。現在の会社権限と現在のツール権限からadmin以上を確認する。既存の自己変更・同格以上・owner保護、Serializableの再試行は維持する。

検証は実route/context/company ceilingと隔離PostgreSQLを使う。5ツール×13条件で、降格後の更新/削除拒否、対象行の維持、所属削除、不明/重複会社role、初期低権限、shadow/off、ロック後の降格待機を確認する。セッション・rolloutは合成。外部API・通知・金銭は呼ばない。

再実行：python3 scripts/security-regression/verify-member-mutation-company-ceiling-postgres.py
証拠：DOYA_SEAT_EVIDENCE_DIR配下の5個の*-member-mutation-results.jsonとseat-postgres-lifecycle.json。各結果には実際に読んだsource hashを残し、私有DBは停止する。

現在の本番COMPANY_ROLES_ROLLOUTはunset/off。今回flagや未適用モデルを有効化しない。本番の顧客権限・会員行・Stripe設定を変更しない。全ツールの全writer、実OAuth、別権限の本番アカウント、課金の受入とは分ける。
