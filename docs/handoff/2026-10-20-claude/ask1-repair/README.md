# ASK1 作成と結果回復の限定補修

2026-10-20時点で実装・対象検証済みです。本番未反映です。統合候補は19ゲート合格・型1件失敗後、実JSが同一の型境界修正と5delta検証が合格しました。統合証拠は ../../2026-10-20-finance-ask1/summary.json を参照します。変更対象とSHA-256はsource-inventory.json、対象検証はverification.jsonを参照してください。

## 問題と変更

事前の現行Tool/API合成再現では、保存後の応答消失に対する再送と同時押下で、runとprovider呼出しが二重になりました。DTO変換の失敗でも完成runが削除されました。事前の再現は ../ask1-preflight/ に保存しています。旧コードの検証結果とは別の証跡です。

今回、時刻入りv2操作IDとSystemSettingの受付を追加しました。作成はUser行のlockを先に取り、現在のplan・利用枠・run予約・受付を同じSerializableトランザクションで確定します。同一IDの同時要求でもprovider実行claimは1つです。runと受付の確定は原子的に行い、DTO・応答の障害では完成runを削除しません。

画面はWeb Locksと永続storageで利用者ごとの操作IDを保持します。応答が不明な場合はGETで確認します。新しいIDで自動再送しません。新規作成は終端状態を確認した後の明示操作です。利用者切替・loading・ABAで旧応答を拒否し、別利用者の表示へ結果を渡しません。GETとPOSTのreplayでは初回バナー生成を再開しません。Web Locksやstorageが使えない場合はprovider開始前に停止します。

## 初回バナーqueueの表示所有権

独立レビューの実queue再現で、旧runの画像生成中に新runを作ると、旧応答が表示を上書きし、新runの初回画像生成が始まらない不具合を確認しました。同じmounted fixtureにHEADの旧queueを読み込むと、新runの初回requestが0件となり失敗します。補修後は32件が合格しました。peerの独立fixtureも、旧応答が先/後の両方で新run表示と各run3枚の順序を確認しています。

Toolは現在表示中のrunIdをqueueへ渡します。queueはrunごとのtokenで同runの重複を抑え、別runの初回生成を開始します。DTOはrequest runIdと完全な現行RunDto契約を検証してから、表示ownerが一致する場合だけ反映します。busy/error/finallyもrunごとです。新規入力のnull状態では旧runを復活させません。旧runへ戻った場合も、完了済みtaskのbusyを復活させません。

同じ利用者のTool内では、旧runの残り画像も従来どおり順次要求します。表示切替だけで中断しません。unmount/利用者切替では旧世代の表示・event・後続POSTを止めます。既に始まったproviderの停止や画像生成成功は保証しません。通信失敗と壊れたDTOは以前の表示を保持し、汎用errorへ変換してbusyを解放します。

履歴画面の1引数呼出しは従来のsingle busyを維持します。API/DTO schemaは変更していません。GET回復で画像を自動再生成しない条件も維持しています。StrictModeのcleanup/setup、旧finally、同run重複、null、両応答順、誤ID/partial DTO/通信失敗を実queueで確認しました。

## 期限と整理

未受付IDの新規受付期限は発行時刻から24時間です。既存受付はサーバーのfirstAcceptedAtから30日間回復でき、GET/replayでは延長しません。GC後でも古いIDは410です。実行leaseは6分で、APIの300秒とは別です。lease後のworkerは保存できません。未受付操作の終了はtombstoneを保存し、遅れて届くPOSTの復活を防ぎます。

受付にはopaque利用者ID、操作ID、hash、claim、状態、予約照合情報だけを保存します。氏名・email・URL原文・手入力・生成本文は複製しません。opaque利用者IDは、runが消えた場合もGCが同じUser lockを取得するために必要です。1利用者512受付の上限は技術上の保護です。料金・生成回数のplan定義は変更していません。

GCはUser lock後に受付を再読し、claimとrun全体の予約CASを確認します。経過時間だけで枠を返却したり、runを削除したりしません。完成run、変更済みrun、他サービスprefixを保持します。カーソルを巡回し、有効な先頭受付の後にある期限切れ受付も処理します。GCだけはReadCommittedでUser lock後の最新値を読みます。受付・確定はSerializableを維持しています。

専用cron APIとvercel.jsonの毎時1登録は設定コードの準備までです。本番での定期実行開始は未実施です。CRON_SECRET未設定、認証なし、Bearer undefined、誤った認証は401で停止します。

管理者DELETEとPrismaAdapter.deleteUserは、削除Txの先頭でUser lockと自prefix受付削除を行います。adapterの削除結果と例外を維持します。既存run・banner・Storageの退会後残置は別のprivacy P1です。receipt対策をもって全退会データ削除の完了とは扱いません。詳細はprivacy-remainder.mdを参照してください。

## 検証

| 検証 | 結果・範囲 |
|---|---|
| 実PostgreSQL | 31件合格。実Prisma、User行lock待機をpg_stat_activityで観測、Serializable retry、同一ID/provider1、quota同時競合、reservation CAS、GC/退会競合、adapter戻り値・例外・rollback |
| 実Tool/hook mounted | 32件合格。React StrictModeで二重押下、応答消失、DTO503、2タブ、storage/locks不可、利用者/ABA、遅延body、入力/結果照合 |
| 既存AskLink | 24件合格。既存assertは維持 |
| 既存owner/admin/auth | 全合格。依存注入fixtureだけ追加。元のassertを削除・緩和していない |
| 対象lint | 警告・エラー0 |
| 契約維持 | schema/package/DTO/banner再生成API/共有DS/ToolFrame/公式artをHEADと照合。履歴GET本文も一致 |

PostgreSQL検証は自分の一時Unix socketサーバーだけを起動しました。inet_server_addr=null、専用role、所有data_directoryをDDL前に照合しています。実行後に停止exit0、所有一時ディレクトリ削除trueを確認しました。実DB・常設DB・Stripe・有料providerは使っていません。認証/provider/DTO内容は合成です。

mounted検証のWeb Locksは合成schedulerです。実ブラウザのnative Web Locks・OAuth・本番全画面QAは未実施です。UI3点のoffline表示証跡は ../asklink-ui-repair/ にあります。親は保存済みの375/1280px画像を静的に読み取り、3タブ、見出し、余白、公式artを目視確認しました。CUAのfile:表示は安全制約で拒否されたため、別経路への置き換えは行っていません。candidate E2Eの合格とは扱いません。

## 実行方法

- offline: `node scripts/security-regression/verify-asklink-creation-client.cjs`。追加env不要、timeout60秒を推奨します。
- isolated PG: `python3 scripts/security-regression/verify-asklink-creation-postgres.py`。timeout240秒を推奨します。MacのPostgreSQL17またはLinuxの/usr/lib/postgresql/*/binを探索します。必要ならDOYA_PRIVATE_POSTGRES_BINでbinary所在だけを指定します。
- operation.cjsへ通常DB URLを渡さないでください。supervisor専用のDOYA_ASK1_PG_*環境と所有パス照合が必要です。supervisorはPG*環境を除去し、Unix socketだけに待受を限定します。
- 共通runnerの接続と統合ゲートは別担当です。schema/packageは変更していません。

Luna利用: 未使用。通常のCodexで実装・検証しました。

## 統合型チェックでの境界補正

統合tscで、Prisma User.emailのnullable型とNextAuth AdapterUser.emailのstring型が衝突しました。installed PrismaAdapter 1.0.7は同じp.user.delete結果を返します。戻り値にAdapterUserの型assertを1か所だけ置き、email補完・新例外・void化はしていません。修正前後のtranspile JavaScriptはbyte一致です。実PG31件を再実行し、nullable emailを含む削除結果、例外、rollbackが維持されることを確認しました。adapter-type-boundary.jsonとpostgres-type-boundary.logが証跡です。統合担当の非incremental tscは終了0でした。全5deltaとsource/dependency不変は ../../2026-10-20-finance-ask1/summary.json に記録しています。同一候補のリモートCI・Nextビルドはcommit後の確認です。
