# Global retirement intent / fence 設計

2026-10-21。基準sourceは7672cb8fです。R0の新規core3ファイルと隔離PGを実装しました。既存APIへの接続は0で、全writerの接続・競合解消・本番反映の証拠ではありません。R1以降は親の解禁待ちです。schema追加なしのSystemSetting案は親承認済みです。新API/保持定数と具体的な範囲は段階ごとに確定します。SFA担当ACL・AI回数・料金・本番DB/Stripe/メール・Promane schemaには触れません。

## 合意した不変条件

Astra戦略に従い、退会operationはreserved→executing→completed、外部未開始のreservedだけabortedへ遷移します。外部actionはplanned→dispatched→confirmedです。unknownはphaseを巻き戻す根拠になりません。timeoutで未実行に戻す、別operation/keyで再送する、status GETから自動再開する動作は禁止します。

exact operator/target/operationIdを固定します。管理者はAdminUser、利用者はUserという別principalです。現在のverifyAdminSessionはadminUser.idを返しますが、DELETEはvalidしか使っていません。新受付ではidを必須にしてreceiptへ結びます。受理前の明示取消もaborted receiptを保存し、遅延POSTを再受付しません。取消はclaim世代を失効させ、dispatch前の旧workerを止めます。

外部IO中はDB lockを保持しません。短いTxでdispatchを永続化してからIOを行い、戻った結果は正確なtoken/世代/対象とCASします。CASは旧workerのDB保存を防ぐもので、送信済みリクエストをprovider側から消す保証ではありません。dispatch直後に停止したworkerをtimeoutだけで無効化できません。

そのためdispatched unknownはUser/fenceを保持してneeds_reviewとします。正確な応答ack、対応requestを裏付ける証拠、または外部的に不可逆だと検証できるterminal状態だけを完了根拠にします。resume等の可変状態をGETで見ただけでは完了・lane解除しません。旧workerの送信直前自己確認は追加防御であり、保証の代替ではありません。

## Durable storeの案

既存namespaceに接続せず、`doya-account-operation:v2:` / `doya-account-fence:v2:` / `doya-account-action:v2:`を使う案です。operation/action keyは全target共通のUUIDだけで一意にし、receipt.targetHashでtargetを固定します。fence keyはUser IDのSHA-256です。fence→global receiptのtargetHash/generation/kindを毎回照合します。別actor/targetが同UUIDへabort tombstone等を書けません。変更前の案は未接続namespace内だけで、本番移行は発生していません。生email、氏名、応募本文、Stripe URL、customerの全文を複製しません。

- fence：target hash、operationId、generation、kind。active pointerとreceiptは同じTxで作成・更新します。
- operation：version、operator種別と技術ID、target hash、operationId、input digest、claim token/generation、phase、server時刻、technical reason code。operator/target/input不一致の再送は409。
- action ledger：service/mode、厳密resource ID、動作種別、payload digest、planned/dispatched/confirmed、dispatch generation、正確な結果の必要最小値。resource一覧は重複除去・上限・schema検証を行います。
- completed退会：User削除と同じTxでoperationをcompletedへ移し、terminal fenceとの整合を保存します。Userをupsertして復元しません。
- aborted：receiptを残し、対応するactive pointerだけをCASで解除します。別の現行operation pointerを削除しません。

不正・欠落・terminal/pointerの矛盾はfail closedです。unknown・needs_review・未完了fenceの時間解除/GCは設けません。terminalも無期限保持します。UUIDだけのoperationをGCすると旧POSTが復活するため、自動GCは実装しません。保持期間の追加決定を今回の作業条件にはしません。ASK1の24h/30dを無断で転用しません。

既存SystemSettingは一意keyとvalue CASがあり、現在の範囲はschema追加なしで表現できます。専用tableのFK/cascadeはむしろUser削除後の回復を壊すため今回必要ありません。量・索引・運用SLAのため後から専用tableへ移す場合も、旧namespaceとの移行をfail closedで行います。

## Writerのlock規約

ロック順を **User ID昇順 → service/組織ID順 → member/invitation ID順 → operation key順** に揃えます。User/ownerの探索は最初の候補取得であり、権限の保証ではありません。

1. actor、変更対象User、canonical owner、old/new owner候補、変更する参照先を事前探索する。新規orgのownerは作成User本人。
2. 実Userを重複除去してID順にFOR UPDATE。欠落User・不正なauthorityは拒否します。owner数と状態は下表のサービス契約に従います。正規PENDINGの仮ID/nullはUserではなくmember参照としてlockします。
3. orgと対象member/invitationを同じ閉じたregistry順でlockする。
4. canonical owner/actor/target/email/role/status/招待tokenを再読する。候補集合が変わっていたら全Txをrollbackし、User lockからやり直す。org lock後に新しいUser lockを継ぎ足さない。
5. operation/fence/ledgerを最新値で読み、不正・欠落は拒否します。通常の所属変更はretirement/retiredだけで拒否します。正常なcheckout/cancel/resume/change/portal unknownで通常の招待・整理を恒久停止させません。billing subjectを変えるowner譲渡等には別の全kind排他を接続します。受理を返す前まで同じTxを維持する。

actorとtargetだけのlockでは、owner Aの退会中にadmin BがCを招待する操作を止められません。B/Cに加えてAを必ず含めます。Kintai/Expenseのように複数authorityが正常なサービスは、有効authority全員を集合として含め、先頭を偽のcanonical ownerにしません。全11系統のowner transferはこの規約の後です。Promaneはmember.roleで推測せずworkspace.userIdをcanonical ownerとします。nullable移行後のnullもownerを推測して通しません。

waiting後の状態を再読するためReadCommittedを基本にします。Serializableを維持する既存quota処理はfresh snapshot取得と全Tx retryの条件を別途検証します。SFAのwithSfaAdmission等へfenceをcallbackの最後に足すだけでは順序が逆になるため、User/fence preludeを最初のDB処理へ入れるか、Txを渡せるDB-only entryへ分けます。既存quota式・counter・ACL方針は変えません。

## Current writer inventory

writer-inventory.jsonはsrcの2428 TS/TSX（未接続R0の3ファイルを含む）をASTで調べた候補です。membership/deletion/nested createが82箇所、organization create/metadata/counterが22箇所、外部billing mutationが12箇所、既知helper callが24箇所、計78パスをhash固定しています。加えてCustomer作成2箇所と共有Portal構成作成1箇所を別分類しました。現在の未commit Promane候補も含むため、基準commitのsourceと同一だという意味ではありません。implementation-manifest.jsonで全78パスを、接続helper・同Tx範囲・除外理由・fixture未実証まで対応付けています。件数は欠陥数・接続完了数ではありません。read、quota counter、料金設定等を区別し、動的呼出しの不存在までは証明しません。

| 系統 | 接続すべき入口・依存 |
|---|---|
| 全11の作成 | hr/kintai/sfa/shodan/aio/mensetsu/quote/aishodan/income access、expense access/setup、promane auth/workspace-mutations。nested member createも含む |
| 招待/所属 | HR invitation発行/accept/期限更新・member変更・現transfer-owner。Kintai employee role/invite・token accept。SFA/Shodan/AIO/Quote/Mensetsu/Aishodanのmembers/invite群 |
| Expense | members POST/PATCH/DELETEに加え、claimPendingMemberships。usage GETとshell pageから起動するclaimもwrite |
| Promane | invite-admission issue/accept、invitations取消、workspace mutation。member rate/repairはmembership lifecycleを変えるか分類し、共有データの書込範囲を別記 |
| 退会 | admin/users DELETE、creation-adapter deleteUser、共通retirement guard/ASK cleanup。admin UIのopID/unknown/拒否/status/resume表示まで結合 |
| checkout | stripe/checkoutとhr/billing/checkout、checkout-reservationのadmission/再送/ready再利用/settle、stripe.ts createCheckoutSession |
| billing mutation | subscription cancel/resume、admin/stripe cancel/cancel_immediately/resume、stripe.tsのhelper。admin/users PATCHのplan変更も権利writer |
| Portal | stripe/portal GET/POST、portal/redirect GET、hr/billing/portal、stripe.ts createCustomerPortalSession。新規発行fenceだけでは既発行URLを閉じた保証にならない |
| billing fact | billing-sync、webhook、stripe sync/sync latest、admin stripe/admin users、cron daily-summary。HR webhookは現codeではdeprecated no-op |

createCheckoutSessionのstatic consumerはstripe/checkoutだけ、createReservedCheckoutSessionはcheckout2入口です。createCustomerPortalSessionは上記3 route fileの4handlerです。cancelSubscription/resumeSubscription helperは現在のsrc named-import callを検出せず定義のみです。この証拠をJSONへ記録し、将来の別consumerが無条件で通らないguard境界も設けます。

installed PrismaAdapterにはdeleteUserが存在します。current NextAuth coreの検索では呼出しを検出しませんでしたが、未使用を絶対保証しません。adapterは同じworkflowの完了権限を持つ削除へ接続するか、operation文脈を得られない呼出しをfail closedにします。払込やunknownを無視したfallback直deleteは残しません。具体な既存返却/例外契約は認可済み削除で維持します。

## Checkout / cancel / resume / facts

retirement予約とcheckout creation受付は同じUser lock/laneで排他にします。旧・新creatingが不明なら退会を開始・完了せずUserを残します。ready行はURLを再利用する前にもfenceを確認し、retirement後のpayable URLを返しません。遅いcreate成功は既存value/token CASでtechnical receiptだけを保存できる専用settleへ分け、Userや権利を復活させず、新しいURL返却の権限にも使いません。

既存open Checkoutは厳密ID/owner/mode/metadata/correlationを検証して閉鎖します。停止より先にpayable capabilityを閉じます。閉鎖と同時にcompleteへ進んだ場合は、そのCheckoutの正確なsubscriptionだけを、同operationのrevision付きplan拡張で同じledgerへ組み込みます。既存dispatched/confirmed payloadは差し替えません。この拡張はR2の未実装要件で、R0のcheckout_expire outcomeはexpiredだけを受けます。失効/完了/ownershipを確認できなければunknownを残します。期限到来や一覧0を、未実行や未課金の証拠にしません。

cancel/resume/price change/admin操作にも同じintent・dispatch台帳を適用します。違うkindの外部操作とretirementを並列で許可しません。既発行Portalや外部Stripe Dashboardでの変更は、アプリの新規発行fenceだけでは無効化できません。source上でprice change capabilityが有効です。既存Portalがあってもfinalize安全だというprovider根拠と適用条件が必要です。不可逆terminalと全creation/reuse/late settle/schedule/旧worker/factsの閉鎖を確認できなければ、User/fenceをneeds_reviewで保持します。共有設定無効化やCustomer削除は追加しません。限定した一次資料レビューはsol-provider-capability-review.mdを参照します。Portalのinvoice支払/会計保持/PII能力は別要件であり、存在だけを永久退会拒否の根拠にはしません。

webhookはprovider事実です。fenceを理由に黙ってdropしたり、受信済みとだけ返して事実を捨てたりしません。既存receipt/token CASを維持し、intent下の新resource/変更をdurableに記録してplan dirtyとして再照合します。User存在・identity・plan/ledger revisionを最後の削除Txで確認します。User消失時はUser/権利をupsertせず、対象不明/退会済みの事実として回復可能に保持します。customer/subscription/checkout等の厳密技術ID→retirement recordの最小索引をR2で設け、emailで再関連しません。finalizeとのwebhook revision競合はplan dirtyとして再照合します。admin手動権利変更と署名済みprovider事実は別入口に分け、manual操作でfact扱いを偽装させません。

## サービス別authority/statusと遷移

| サービス | 保護するauthority・状態 | 正規target遷移とsource根拠 |
|---|---|---|
| HR | ACTIVE OWNERを1人。member statusはACTIVE/INVITED/SUSPENDED | organization/members/[id]のVALID_STATUSESに従います。OWNER変更はtransfer-owner。招待PENDING等は別HrInvitationで、member列挙へ混ぜません |
| Kintai | ACTIVEかつemployee.isActiveのsystem_admin全員。ownerUserIdはnull | employees/[id]は複数system_adminと最後管理者保護が正常仕様。employees POSTのpending_UUIDだけを仮参照とし、invite/tokenの実User置換・employee.email fallbackを保持します |
| Expense | ACTIVE owner全員。ownerUserIdはnull。ACTIVE/PENDING/INACTIVE | member-policyはowner→ownerを許可。members/[id]の最後owner countと更新/auditをR1で同Txへ移します。PENDING null→DB email本人を明示claimとして扱います |
| SFA/Shodan/AIO/Mensetsu/Quote/Aishodan | ACTIVE owner1人。ACTIVE/PENDING/INACTIVE | membersのowner付与禁止・target owner変更拒否が現仕様。PENDING null+token/emailの明示claimを許可。owner引継は後続です |
| Income | ACTIVE owner1人。ACTIVE/PENDING/INACTIVE | 現accessの本人組織作成が入口。schemaのPENDING nullだけで新しい招待APIを作りません |
| Promane | workspace.userIdと一致する有効owner1人。isActiveをACTIVE/INACTIVEへ読取変換 | 招待はPromaneInvitationのacceptedAt/expiry。nullable互換readは退会解禁の証拠ではありません |

Kintaiのquota参照はemployee-admission.tsのcreatedAt最古system_adminで、ACTIVE/employee filterがありません。authority集合と課金参照元を同一視せず、全実参照Userを保護し、既存quota計算をactive最古へ変えません。PENDING仮IDは実User lockへ送りません。

明示pendingClaimUserIdは、actor=受諾User、対象PENDING、正規placeholder/null、DB email解決先の同一性を要求します。対象member/token/email/employee行は同Txで再読し、署名が変わればUser探索から再試行します。取消・再招待と実Userへの付与をgrantsAuthority=falseの偽装で混ぜません。現R0はこのDB契約の確認であり、HTTP tokenの認証・expiry・許可roleはR1の既存callbackへ残ります。

Expenseの未知target roleは、既知ownerが明示repairsUnknownTargetRoleで正規roleへ修復する既存権限を残します。未知actor/authorityを許可する意味ではありません。detached ACTIVE/INACTIVE nullへの新grantは拒否します。

R1の実route検証は未実施です。Kintai受諾が他組織の所属を無効化する全範囲、複数admin/ownerの最後1人の同時降格、Expenseのglobal prismaを同Txへ移す接続を完了条件に残します。R3のOWNER-A conservative guardにも複数admin/owner一律拒否が残るため、R0の通常操作契約とは分けます。

## 復旧と後続の境界

reserve成功直後、prepare前/後、start後dispatch前、confirm後次planned前、全confirm後finalize前は、同operationの明示resumeでclaim世代/tokenを回転できます。旧claimのprepare/start/dispatch/finalizeは拒否します。status GETはclaimを発行せず、dispatched/unknownはこの回転対象にしません。

HR checkoutのCustomer明示作成とUserへのID保存は現reservationより前にあります。stripe.tsの未使用customer helper、Checkoutの暗黙Customer作成、共有Portal構成作成もR2の分類へ含めます。切替前deployment/workerの未記録処理は、固定時間待機でdrain済みとしません。

PromaneのrequireCurrentTaskWriter/actions-projects/actions-clients/actions-time-entriesはmember→operation/advisoryの既存順を持ちます。新User-firstとの逆転をR1で検証します。assignee割当・工数の対象User/owner lockは別のdata-writer分類で、membershipの82 callsitesへ接続済みと数えません。全2000件のデータ書込を今回接続するという意味ではありません。

## API / UIの案

現在の管理者削除UIとDELETEを同じoperationIdに結びます。受付・status・未開始abort・明示resume/reconcile/finalizeを区別し、GET statusはDB観測だけで外部IOを始めません。新APIはvalid adminUser.idまたは許可済み本人のみに限定し、targetをoperation作成時から固定します。新たな一般向け自己退会権限はこの設計だけで追加しません。mutationにはsame-origin検証、expected actor/context照合、private/no-store/Vary: Cookieを付けます。

UIは未完了/unknown/needs_reviewをreceiptと同じ意味で表示します。自動で別IDを作って削除をやり直さず、未受付取消後の遅延POSTも拒否します。admin actor/target切替時は旧operation応答を新しいUser行へ反映しません。復旧は同operationの状態確認と明示操作です。

## 実装の分割と安全な公開順

1. 共通state/strict parser/namespace/短Tx CAS/participant resolver。DB-only helperと隔離PGで、abort-vs-dispatch、破損receipt、canonical owner第三者加入、lock順を確認する。まだ旧経路の危険解消とは扱わない。
2. 全membership writerへ同じpreludeを接続する。既存quota/authorizationを維持し、各入口とshared helperのcoverage manifestを固定する。第三者admin→別target、pending email claim、owner change再探索、lock逆転のPGを行う。
3. checkout admission/ready/creating/settleとbilling mutations/Portal/fact同期を接続する。未知結果はUserを残す。既存open/complete/応答消失/late settle/false DTOを回帰する。
4. admin/adapter coordinatorとUIを接続し、新規退会受付を有効にする。全writerとbilling経路が揃う前に新workflowを安全と宣言・有効化しない。全owner引継・Promane移行は別の必要作業として残す。

OWNER-Aの2 unsafe観測は、membership追加がfenceで拒否される期待、checkoutの新規/再利用が拒否され既存capability未確認ならUserが残る期待へ変更します。危険動作を正仕様として残しません。隔離PG+Storage/Stripe mockだけで検証し、実契約・本番削除・メール送信・外部cron稼働は行いません。

旧707のreserved/executing、planned/dispatched/confirmed、同operation回復は設計上の参考です。actor/targetのみのfence、DBTx内provider IO、古い8系統registry、nullable前提、timeoutによる権限復活は採用しません。Luna未使用、通常のCodexによるsource読取と設計です。


## R0検証の範囲

新core3と専用PG supervisor/CJSだけを今回の実装対象にしています。86件のunconnected_core_contractが合格しました。証跡・最終hashはr0-verification.jsonへ固定します。User/org/member/employeeの実row lock、CAS、操作IDのtarget/principal固定、明示同operation回復、破損receipt/fence/ledger、通常招待と課金unknownの分離を含みます。DB-only callbackはHTTP認証や実route接続、provider能力閉鎖の証拠ではありません。OWNER-Aの2 unsafe観測は未解消です。

同一21入力候補の独立snapshotで28統合gateが合格した。R0は86件すべてunconnected core contractであり、既存routeへの接続数は0、既知2競合は未解消である。fresh route型と全体nonincremental tscも終了0。入力・依存の前後不変と結果は [統合summary](../../2026-10-21-r0-promane/summary.json) を参照。同commit remote Nextと本番反映は含まない。

R1受入では、ExpenseのPENDING nullのrole編集と取消後INACTIVE owner null履歴を専用遷移で扱う。recipient退会時もEXP-F05のメール登録状態を漏らさない。これらは後続の実route PGとAstra reviewで確認し、今回86契約を全正常Expense状態の網羅保証とは扱わない。既知2競合とは別のR1残件である。
