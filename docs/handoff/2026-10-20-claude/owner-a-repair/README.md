# OWNER-A：限定的な退会保護と本人応募の匿名化

2026-10-20、72d471caの現行スキーマを基準に実装しました。runtime6ファイルとfixture9ファイルを固定しています。対象検証と29統合ゲートの実行は終了0で、global型・5,141入力/主要依存の不変を確認しました。2件の危険な観測は未解決のままです。../../2026-10-20-owner-org/summary.jsonを参照します。本番未反映です。退会全体の対応完了とは扱いません。

## 今回の変更

共通ガードを管理者DELETEのStripe照会前、最終削除Tx、PrismaAdapter.deleteUserへ接続しました。User行を先にロックし、現行のHR・Kintai・SFA・Shodan・AIO・Mensetsu・Quote・Aishodan・Income・Expense・Promaneを確認します。未知のrole/status、inactive/pendingの所属、実在Userを確認できない所属、複数owner等は停止します。本人ownerに他メンバーや保留招待がある場合も停止します。期限切れでもPENDINGのまま残ったHR招待は、自動で取消済みと見なしません。

Promaneはworkspace.userIdとmember.userIdが非nullableのUser Cascadeです。引き継いでも元メンバーの工数・コメントが消えるため、現在のmembershipまたは招待発行者参照が残る退会は拒否します。solo membershipもこの保守条件に含まれます。nullable/SetNullへの移行と全consumer確認はOWNER-Bの残件です。

本人のCaseStudyApplicationはuserIdの完全一致で匿名化します。会社名は固定の匿名名、氏名・emailは空、URL・利用サービス・希望日時・備考はnull、userIdはnullにします。id/status/掲載同意/createdAtは維持します。同じemailでもguest行と他人の行を変更しません。ガード、匿名化、ASK outbox、既存削除処理、User削除は同じTx内にあり、途中失敗は全て巻き戻します。adapterの削除row返却・例外同一性・P2025契約も維持します。

応募APIは明示したuser/guest contextをセッションと照合します。認証済み作成は退会と同じUserロックを取得し、実在を確認して保存します。退会済み・別利用者・id欠落のセッションや認証取得失敗をguestへ切り替えません。本当のguest応募は維持します。旧context欠落は428で、入力を控えてからの再読み込みを案内します。個人向け応答にはprivate, no-storeとVary: Cookieを付けます。

フォームは確定したactor/guest contextで分離し、変更時に旧PII草稿を破棄します。loading/id不明時は入力を描画せず送信不可です。この間はフォームをunmountするため、loadingを挟んだ同actor復帰でも草稿は戻りません。同じauthenticated idのオブジェクト更新や明確な4xx拒否では入力を維持します。旧actorの遅延応答は新画面へ反映しません。

成功表示は{ok:true,id}を検証した場合だけです。200HTML/不正JSON/不正DTO・HTTP5xx・通信切断は結果未確認とし、入力を保持して再送を止めます。未送信とは断定しません。既存のお問い合わせ先を新しいタブで開けます。一般応募のidempotency/recovery APIは新設していません。

## 証拠の区分

| 証拠 | 結果・限界 |
|---|---|
| 修正前 | 実API・実Form・実FKを使う8観測。guest維持の対照も含むため、8欠陥とは数えません。全入力hashは72d471caと一致 |
| 新PG | 実行64件。契約・安全性回帰62件が合格。残る2件は未解決の危険な挙動の観測であり、安全性の合格・受入ではありません |
| 新Form | 実Form mounted19件合格。認証・通信は合成mock。実ブラウザE2Eではありません |
| 既存 | creationPG32/privacyPG41/admin billing10/auth12/admin quotaを維持して合格 |
| Lint | runtime6ファイル、警告・エラーなし |
| 統合 | 最終nonincremental tscを含む29統合gate終了0。remote同一候補ビルドはcommit/push後に別確認 |

修正前と同じ実Form/API接続で、cookie消失・別actor切替の旧草稿は409となり、誤actor保存と通知は0件です。利用者変更がクライアント側で確定した時点で入力は消えます。応募→退会では実Userロック待ち後に応募が匿名化され、退会→応募では実Userロック待ち後に保存を拒否します。全通知とStripeはstubであり、送信・課金は実行していません。

PGは自己所有のUnix socket一時クラスタです。サーバーrole・data directory・TCP非使用をDDL前に照合し、停止exit0と自分の一時ディレクトリ削除を記録しています。既存DB・本番スキーマ・Storageは変更していません。

## 未解決の競合と後続

1. Stripe外部操作中にactual expense/members POSTで参加者が増えると、最終ガードは409でUserを残しますが、直前の合成契約停止1件は戻せません。事前・事後の2回確認だけで、この競合を解決したとは扱いません。
2. 同じ外部区間にactual checkout-reservation helperで合成payable sessionを作成でき、User削除後もready receiptが残る条件を観測しました。実Stripeの契約完了・課金は実施していません。実契約成立まで証明したとは扱いません。

2件は`unresolved-observations.json`に基準source hashと未受入状態を保存しています。共通のdurable退会状態とmembership/招待/owner変更・checkout側のfenceが後続です。後続の修正では、この危険な挙動を安全な期待へ置き換えます。危険な動作を恒久的な正仕様として固定しません。

`membership-writer-inventory.json`は直接呼出しの候補67箇所とnested create・別招待・checkout候補を示します。字句検索の結果であり、67欠陥や全writer未接続の証明ではありません。既存の組織ロックを壊さず、User lock/fenceの順序を揃える後続レビューが必要です。今回未変更のmembership PII、全owner引継、Promane migration、既に退会済み行のbackfill、外部通知履歴の消去も完了扱いにしません。

## consumer・公開ページの確認

現srcの静的参照検索では、保存済み応募を読むadmin一覧/CSV/mailto consumerは検出しませんでした。作成APIはidのみ返し、既存通知はそのリクエストの入力から組み立てます。匿名化済み空emailを読み直して送信する導線は見つかっていません。外部運用や動的consumerまでの不存在を証明するものではありません。

公開`src/app/campaign/case-study/page.tsx:79`のFormは`src/app/layout.tsx:181-208`のProviders配下です。`src/components/Providers.tsx:8`はSessionProviderでchildrenを包含します。このForm変更は72d471caのpreview候補に含まれず、その前cohortのpreview failureとは分けます。

## 実行方法と入力

- offline：`node scripts/security-regression/verify-case-study-form-mounted.cjs`、追加envなし、推奨60秒。
- PG：`python3 scripts/security-regression/verify-account-retirement-postgres.py`、任意`DOYA_PRIVATE_POSTGRES_BIN`、child180秒・推奨outer240秒。既存の安全な一時PG方式と同じです。
- 共通runner/CIはbilling所有です。ここでは編集していません。

`source-inputs.json`が15入力を列挙します。schema/package/共有adimage/ASK cleanup本体/vercel.jsonは72d471caと一致します。旧707のnullable移行コードは移植していません。Reactスキルの観点で、条件付きhookなし、render時のactor分離、重複送信ref、unmount cleanup、明示的な未確認表示を確認しました。Lunaは未使用、通常のCodexで実装・検証しました。
