# 勤怠の更新時の会社権限とロック順序

会社権限を強制する設定で、入口の会社adminをmember/guestへ引き下げた後にも、従業員更新/無効化が成功する問題を隔離SQLで再現した。共有actorはツールの現在行を再確認していたが、会社の上限は古いctx.roleを使っていた。

共有lockCurrentKintaiActorで会社権限を同じTX内で固定し、続いて組織・会員/従業員をロックする。11callerの14先行組織lockを除き、会社User→会社→組織→会員/従業員の順をそろえる。要求開始時の役割の上限も維持する。部門・就業ルール・従業員・申請・打刻・招待を含む12appファイルが対象。

実context/company ceiling/API/private SQL17条件で、従業員変更/無効化、部署/就業ルール作成の会社降格後拒否と行保持を確認。所属削除、未知/重複会社role、初期低権限、shadow/off、無効従業員、会社降格のロック待機、実SQL順序も確認する。セッションとrolloutは合成、顧客行/有料API/通知/Stripe操作なし。

再実行：python3 scripts/security-regression/verify-kintai-write-company-authority-postgres.py

古い就業ルールstale検証はrevision依存、expectedRevision、現行shell内pageパスへ追従。2人が同じ版を保存する場合、2人目は409となり1人目の内容を保持する。

再実行：python3 docs/audits/2026-10-06-all-services-recheck/kintai-work-rule-stale-postgres-supervise.py

初回のlegacy fixture依存漏れは実organization-lock helperを読むよう修正し、実SQLクエリに応じてorg/actorを別に検査する。no-opによる権限回避ではない。会社の新権限は実SQL17、既存functional fixtureは元の合成company ceiling/offの境界で扱う。

本番の会社権限flagと未適用モデルは有効化しない。本番顧客の権限変更や実操作の受入ではない。従業員新規POSTも共通会社席admission内で保存する。会社席不足、キャッシュ不明、財務操作中は保存と通知を止め、空き席があれば予約を保存する。Recipientの現在User IDを固定し、曖昧な大文字小文字の一致は拒否する。料金flag offではこの追加lookupを行わない。

追加の実SQL12群ではKintai同時最終席、Promaneとの共通最終席、既存operator User/同じ招待emailの重複なし、別FREE契約者の従業員上限、型不正入力と従業員GETのprivate応答を確認する。全GET/POST応答をprivateApiJsonへ統一し、11群の登録APIでもCache-Control/Vary Cookieを検査する。会社所属/User.planは自動変更せず、通知はSQL commit後だけ。本修正を全サービス全writerや実金融の合格とはしない。
