# 課金テーブルのクライアント権限

2026-11-06 JST、本番の既存課金9表からPUBLIC・anon・authenticatedの不要なテーブル権限を取り消しました。取引データ・料金・顧客のアプリ内ロールは変更していません。対象SQLは `prisma/migrations-billing-private-acl.sql` です。検証時のバイト列を保つため、準備時のコメントを残しています。この文書が適用状態の記録です。ビルドやPrisma生成からSQLを自動実行しません。

対象は会社・メンバー・契約人数・ポイント口座・付与・増減履歴・初回付与記録・Stripe受領記録・通知の9表です。RLSは有効、クライアント向けポリシーは0件です。テーブルの所有者とservice_roleの既存権限は維持しました。

RLSは通常の行参照・変更を制限しますが、TRUNCATEは対象外です。そのためサーバー専用表では、RLSに加えて不要なテーブル権限も取り消します。公開APIでの漏えいや破壊を再現したという意味ではありません。
出典: https://www.postgresql.org/docs/current/ddl-rowsecurity.html

## 実施と検証

- 本番メタデータの事前読取で、既存9表のRLS・ポリシー・ACL、backend所有者ロール、service_roleの独立72権限を照合しました。
- 私有PostgreSQLへ実Prismaスキーマと元のACL/RLSを再現。変更前は合成1行がRLSで見えなくてもTRUNCATEできる負例を確認しました。SQL適用後はclient権限0、9表のbackendとservice_roleの読取、service_roleとbackendの合成行更新を44条件で確認しました。
- 最初の本番transactionはP2028で未確定となりました。元の全ACL/RLSが一致することを次の事前検査で確認してから、権限検査をまとめて同じ9 REVOKE文を再実行しました。COMMIT前に288個の実効権限と全非client ACLの前後一致を確認しました。
- 別の本番接続で9表×2client×5操作の90条件がすべて権限なしと再確認しました。顧客行読取0、取引データ変更0、security DDL9文です。正式URLの匿名GET4件も期待statusに一致しました。認証後の全操作・実決済の合格とは区別します。

恒久回帰は `python3 scripts/security-regression/verify-power-pack-purchase-postgres.py` から実行します。private Unix socketの新規DBだけを使い、application envや本番資格情報は読みません。schema pushはこの私有DB限定です。44条件の結果は同じCI artifact内の `billing-acl-result.json` に残します。SQL/schema/検査sourceのhashとDB停止記録を照合してください。

## 今後の変更

新しい環境では対象表の存在と用途を確認してからSQLを適用します。既存のRLS・service_role・backendの権限を検査し、失敗時はtransactionを確定しません。対象外の表・全体のdefault privilegesは変更しません。

元のclient権限を戻すSQLは監査成果物に準備していますが、実行していません。戻すと不要な操作権限が再開するため、無条件のrollbackには使いません。所有者/service_role以外の新しい利用経路が必要になった場合は、その用途と必要権限を別に設計します。

返金用の新しい `power_pack_purchases` 表は別の移行です。上記9表の権限修正だけで、返金コードの本番公開やStripeイベント購読が完了したとは扱いません。
