# ASK privacy P1 限定実装と対象検証

2026-10-20、base commit95063ec6から実装しました。runtime/testをfreezeし、統合25ゲートが合格しました。証拠は ../../2026-10-20-privacy-expense-docs/summary.json にあります。未コミット・本番未反映です。対象は認証済みAskLinkの管理者DELETEとPrismaAdapter.deleteUserです。退会全体の対応完了とは扱いません。

## 変更と境界

共通削除helperはUser lockを先頭に取り、SystemSettingのASK専用outboxを同じTxに保存します。own runとFK cascadeのbanner、新creation receipt、既存関連行を削除し、最後にUserを削除します。outbox書込みやUser削除が失敗すれば全体をrollbackします。adapterの削除結果・例外を保持しています。既存Stripe処理はTx外のままです。

banner writerもUser lockとown run確認から始めます。outboxまたは隔離済みoutboxがあれば、新しいclaimを拒否します。claimは既存generations/status/updatedAtと、専用ticketのtokenを照合します。upload直前にもUser/own run/claimを確認してuploadingを保存します。外部upload中はUser lockを持ちません。settleはCAS付きupdateManyで、run/banner/ticketをupsertして復活させません。

Storage対象は既存adimage bucketのasklink/<actor>/<runId>/だけです。DBに残ったpath一覧に限定せず、旧版とDB未登録画像もnamespaceから削除します。別actor/service/bucket/任意URLへ進みません。folder/basenameを検証し、不正な階層・URL・dot segmentは削除せず保持します。private bucketの確認も必要です。既知のuploaded/settled ticketから導いたexact keyを先に削除確認し、その後namespaceを走査します。不存在keyの削除は冪等成功として扱い、返却された別pathは拒否します。

## 不明結果と完了条件

uploading/unknown/needs_reviewは期限だけで消しません。24時間を超えた不明ticketはneeds_reviewになり、cronを503にして保持します。空一覧でも退会outboxを完了できません。timeoutや通信失敗をnot-writtenへ分類しません。遅いupload成功は既存tokenへのack更新だけを許し、User/runを復活させません。

scan直前に、reserved→not-written等を正規化した後の同actor ticket keys/valueのsignatureを記録します。完了には、最初と最後の未確定数が0で、signatureが一致し、既知exact keyの削除確認とnamespaceの空確認が済んでいる必要があります。scan中の遅いack・key追加・value変更で完了判定を無効化し、outboxを保持して次のpassで再走査します。

active Userの正常settledと、upload未開始がCASで確定したnot-writtenだけを24時間後に整理します。not-writtenへ変わったticketはprepare/ackできない終端です。unknown/needs_reviewやoutbox actorのticketは整理対象外です。512件の技術上限に達しても、確定ticketの24時間整理後に新受付が回復します。この上限の案内はplanの生成回数上限と区別しています。

workerはactor outboxの世代・lease tokenをCASし、古いworkerが新しいtaskを完了・更新できないようにしています。有効期限待ちでもcursorを進め、壊れたtaskは隔離します。1回25候補/最大5actor、各actor最大10namespace step、Storage操作は最大10秒、全体45秒のdeadlineです。leaseは120秒で、cronのmaxDuration60秒より長くしています。

Userが再出現した場合は、claim時・各削除batch前・完了Txで停止し、outbox/ticketを保持します。既に始まった外部削除を巻き戻す保証はありません。known runtimeのUser新規作成はcuidで、NextAuthはprofile.idを除去し、HubSpotもidを指定しません。同opaque IDを手動DB操作等で再利用する経路は今回の保証外です。再利用を導入する場合は作成側のfenceを追加する必要があります。

## 旧タブへの案内

別の小補修として、ACTOR_REQUIRED428だけを「画面が更新されました。入力内容を控えてから再読み込みし、作成してください。この操作では生成していません。」へ変更しました。旧形式を受理するfallbackは追加していません。428はprovider開始前に拒否し、private/no-store/Vary CookieとDB不変を保ちます。

## 対象検証

| 検証 | 結果 |
|---|---|
| 新privacy実PG+Storage mock | 41件合格。User lock待機、原子的削除/rollback、退会各時点、unknown/遅いack、scan signature、exact key、世代CAS、越境0、再出現、24時間/512件回復 |
| 既存creation実PG | 31件を維持し、旧タブ428を追加して32件合格 |
| 実Tool/queue mounted | 既存32件合格 |
| 既存AskLink | 24件合格 |
| owner/admin/auth | 対象全合格。元のassertは維持し、helperのfixture接続だけを更新 |
| 対象lint/構文/diff | 警告・エラー0 |
| 統合ゲート | 25件合格。最終nonincremental tsc、security、7suite、privacyPG41/creationPG32等。5133 source/path setと主要依存は前後一致。Next build/remoteはcommit後の別確認 |

再現前の13件は ../ask-privacy-preflight/ にあります。そのうち2件は「run cascadeだけを加えた場合」のsandbox反例です。13件を13個の本番欠陥とは数えていません。

実PGは自分の一時Unix socket/role/data_directoryを照合してからDDLを行いました。各実行後にstop exit0と所有一時dir削除trueを確認しています。provider/Storage/認証/Stripeは合成で、実DB・常設DB・実bucket・有料API・本番削除/backfillは使っていません。

## 検証と運用の残条件

専用CRON_SECRET APIとvercel.jsonへの1項目追加はdraftコードです。本番稼働は開始していません。secret未設定、Bearer undefined、不一致はDB/Storage操作0で401です。実Storageの一覧整合性・障害運用・旧writerのdrainは本番開始前の別gateです。

旧writerにはticketがありません。切替前から動いている旧uploadを本実装だけで追跡できたとは扱いません。固定時間待機だけで未保存を断定せず、旧writer停止/drainを確認してから本番の削除workerを稼働させる必要があります。過去退会済みUserの一括backfillはしていません。

OWNER引継、Promane履歴の退会条件、CaseStudyApplicationのPII匿名化、guest移管、全サービスの退会全経路は別の残課題です。今回のASK修正でこれらを解消したとは扱いません。

## 入力と証跡

source-inputs.jsonにprivacy8 runtime/config、428互換1 runtime、fixtureを含む6 testの計15入力とSHA-256を記録しました。schema/package/shared adimage storage/共通DTO/queue/auth本体は95063ec6と一致しています。common runnerとCIは別担当です。

- `python3 scripts/security-regression/verify-asklink-privacy-postgres.py`。timeout240秒を推奨します。任意DOYA_PRIVATE_POSTGRES_BINまたは既存Mac17/Linux PG binaryを使い、専用Unix socketだけへ待受を限定します。
- postgres-results.json / postgres-supervisor.json / postgres.logが41件の最終証拠です。
- creation-compat-results.jsonは32件の既存+互換証拠です。
- preserved-contracts.jsonに変更しない契約の照合結果を記録しています。

Luna利用: 未使用。通常のCodexで実装・検証しました。
