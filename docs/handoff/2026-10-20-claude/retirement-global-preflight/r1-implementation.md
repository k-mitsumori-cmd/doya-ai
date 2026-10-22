# R1 Expense：author freeze、統合検証待ち

基準は07e53d8bです。9 runtimeと4 test入力の計13ファイルを固定しました。各hashと旧9入力との差分はr1-source-inputs.jsonにあります。R0の旧manifest/proofは当時の記録として保持し、今回の結果で上書きしていません。Popup/JST/runner/CI/schema/packageはauthorの変更対象に含みません。

Expenseのmember POST/PATCH/DELETE、pending email claim、組織作成と会社ウィザードを接続しました。実User→組織→member→退会fenceの順でlockし、actor権限を再読します。target/count/update/auditは同じTxです。全withExpenseを長Txにせず、必要なmembership変更区間だけを包みます。

POST専用のwithLifecycleExpenseInvitationは、actorと全ACTIVE ownerの退会を先に拒否します。その後、ACTIVE/PENDING重複は共通409を返し、受信者のfence理由を応答へ出しません。新規・INACTIVE再招待では、現在のemailで解決した通常Userは即ACTIVE、未登録はPENDING/null、受信者だけが有効なretirement中ならPENDING/nullを実保存します。どれも200 {ok:true}で、member.addのauditはroleだけです。破損・不明状態を未登録として扱いません。

INACTIVE再招待はmember.idを保ち、新payloadのname/email/roleへ揃えます。旧Userの結合を持ち越さず、旧auditは消しません。audit失敗時はbindingを含め全rollbackします。対象外の既知INACTIVE/null owner履歴は、行を保持したままauthority/User集合から外します。未知ACTIVE authorityと、null対象への一般的な新grantは拒否します。

未受諾PENDING/nullの将来role編集は、事前discoveryだけで判断しません。lock後も同じ状態・emailか再確認し、claim等で変化した場合は目的とUser集合を最初から再探索します。一般PATCH/DELETE/claimのtarget保護は維持します。既知ownerによる未知target role修復は別契約として残します。

usage?org=XのclaimはXだけを対象とします。shellの背景claimでも、別org Yの退会/破損で確認済みACTIVE Xを無所属へ変えません。YはPENDINGのまま保持し、明示Yの受諾は拒否します。ACTIVEがない確認失敗を「0件・未使用」にはしません。session例外をguestへ変換する処理も追加していません。

## 検証

| 確認 | 結果・範囲 |
|---|---|
| 実Expense API/helper＋隔離PG | 56安全契約、未解決観測0。新規/INACTIVE linked/null×3受信者状態、重複、退会両順序、claimと安全abort、role編集競合、audit rollbackを確認 |
| 元R0 core＋隔離PG | 86契約合格。未接続coreの検証であり、全writer接続の証拠ではありません |
| 既存Expense mounted | 54合格。依存mock2件のみ追加し、元67 assertion callは変更していません |
| 既存OWNER-A PG | 62契約合格＋2つの未解決unsafe観測を維持。実core importと実memberIdだけ追従し、元99 assertion callは変更していません |
| Lint・構文・型 | 対象9 runtimeのLint、test構文、core限定の非incremental型検査が合格。全体型検査/buildはbillingのsnapshot検証待ち |

PGはすべて専用Unix socket/role/data-directoryを検証し、自分の一時DBだけを停止・削除しています。本番DB、provider、Stripe、外部通知、課金実行はありません。

旧R1 runtime7ファイルを過去manifestのhashへ一致させ、同じ56-case fixtureで、recipient response差異と取消owner/null履歴の2件が安全期待に失敗することも保存しました。旧409に対し補修後は期待した200・実保存です。r1-core-delta-before-after.jsonを参照してください。2owner同時降格の基準7672は200/200、補修後は200/409・残owner1・audit1で、r1-two-owner-before.jsonへ分けてあります。

## 残る範囲

今回解消した2件はExpense subsetの問題です。元OWNER-Aのmembership/Stripe間隔とCheckoutのglobal競合2件は未解消です。他の10サービス、R2のbilling能力閉鎖、R3の退会coordinator、全owner引継、Promane nullable移行・旧worker drainは引き続き必要です。全退会完了、全78候補接続済み、全データwriter保護済みとは記録しません。

Solで実装・検証しました。Lunaは使用していません。


## 固定候補の統合結果（2026-10-21）

上記の個別結果はauthor時点の記録です。その後、26入力の物理候補で全27gate、fresh route型生成・非incremental全体型検査・対象Lintが合格しました。実行source5,163件と依存指紋は前後不変です。今回候補のCI/Vercel・認証後画面・本番反映は別確認です。`../../2026-10-21-r1-popup-jst-delta/summary.json` を参照します。
