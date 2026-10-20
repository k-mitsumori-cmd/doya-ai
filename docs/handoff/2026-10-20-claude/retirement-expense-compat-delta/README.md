# Expense 統合検証の互換差分

固定 candidate の Expense 93 件は、88 合格・5 失敗でした。その証拠と候補は `docs/handoff/2026-10-21-r1-popup-jst/` に保持しています。この差分は source 2 ファイルだけです。旧 R1 13 入力のうち POST route 1 件を更新し、既存 members.test.ts を追加したため、新 R1 入力は 14 件です。元の 13 入力 manifest は当時の証跡として変更していません。

POST の再招待 update は、既存 member ID に加え `organizationId: ctx.organizationId` を明示しました。scope.test.ts の元の検査は変更していません。

members.test.ts の 4 テストは、旧 ctx.role と 1 引数への依存を現在の契約へ合わせました。lock 後の memberRows から role を得ること、PATCH/DELETE の再読 role、同じ transaction の target・最後 owner 確認・更新・audit、claim の任意 org 指定・DB email 再照合・PENDING/null 条件付き CAS を検査します。既存 9 テストの名前は全て維持し、assert は 27 から 57 へ増加しました。skip・削除・広い正規表現による許容は加えていません。

修正後は Expense 93、実 route PG 56、既存 Entry 54 が全て合格しました。対象 2 ファイルの lint と whitespace check も合格しました。PG の test/stop は 0、自己 owned directory の削除を確認済みです。source hash は `source-inputs.json`、各結果は同じフォルダーにあります。型検査は billing 担当の次の固定 candidate にまとめ、author 合格とは記録していません。

他の旧 R1 12 入力と Income 5 入力は hash 不変です。Popup・JST・共通 runner・CI・schema・package は変更していません。既存の全退会 2 gap はこの差分の解消対象ではありません。commit/push は行っていません。


## 固定候補の統合結果（2026-10-21）

上記の個別結果はauthor時点の記録です。その後、26入力の物理候補で全27gate、fresh route型生成・非incremental全体型検査・対象Lintが合格しました。実行source5,163件と依存指紋は前後不変です。今回候補のCI/Vercel・認証後画面・本番反映は別確認です。`../../2026-10-21-r1-popup-jst-delta/summary.json` を参照します。
