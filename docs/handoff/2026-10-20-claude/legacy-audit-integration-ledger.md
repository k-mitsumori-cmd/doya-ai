# 旧707入力監査と現行ソースの統合台帳

確認日: 2026-10-20。対象はローカルのソース比較です。本番の不具合や漏えいを実測した結果ではありません。

## 結論

旧候補は一括移植できません。44移動先は全て現存しますが、旧候補の修正意図を現行へ移した証拠にはなりません。次の候補はAskLinkの操作記録と回復、その次は組織を固定する要求・画面境界です。各バッチは現在の動作で再現し、現行UIを維持して最小修正します。

親作業の課金full gateとホームhydration補修を先に進めます。この台帳作成ではアプリ・テスト・設定を変更していません。旧ソースを正解と見なさず、下記triggerは次の検証条件として扱います。

## 比較の基準と範囲

- 現行: `/Users/mitsumori_katsuki/Code/doya-claude-handoff-20261020`、`codex/claude-handoff-20261020`、HEAD `deb68914790b602f2ceedc6684b64c10ba0582d4`。比較時の作業ファイルを直接参照。
- 旧作業場所: `/Users/mitsumori_katsuki/Code/doya-billing-client-20261006`、HEAD `934b126883c2952ad49610b5fde25e6944e3b94b`。
- 旧707の固定正本: `hr-employee-cache-20261019/release-scope-inventory.json` と `prospective-tree.json`。候補treeは `e1fdac417dde4eaff270f047a64f9422f95addf3`、親は `c6676cab0632f8bdbb983e513286968dce271d23`。以下の旧証拠パスは特記がなければ旧checkoutの `docs/audits/2026-10-06-all-services-recheck/` 相対。
- 移動対応: `public-base-reconciliation-20261019/rename-review.json` と `rename-three-way-preview.json`。旧main `2b88ca32` に対する26 clean / 18 manualは歴史的なテキスト統合案。44件を今回直接照合したが、旧案を適用していない。
- 707 manifestを44移動対応後に現行とhash比較: 全707入力は一致4・差異412・不存在291。runtimeに当たる `src/` / `seo/` は343入力で、一致0・差異238・不存在105。これは差分の分類であり、343不具合・105欠陥という意味ではない。他の場所への再設計や廃止は別途意味確認が必要。
- 一致4件はAskLink OGP画像と生成記録3件。旧監査のruntime修正が全て未実装という判定には使わない。共通の既存補修は次節で個別に確認した。
- 旧checkout全体には763 tracked変更がある。707の固定manifest外の差分はこの台帳の統合対象に追加していない。

## 現行で既に保持される重要な補修

| 対象 | 現行の直接根拠 | 判定 |
|---|---|---|
| HR従業員詳細のprivate応答 | `src/app/api/hr/employees/[id]/route.ts:1` | 今回の親作業で移植済み。旧707を再適用しない |
| 共通private応答ヘッダー | `src/lib/private-api-response.ts:6` | private/no-storeとVary Cookieを共通設定 |
| HR評価の組織/権限/操作記録 | `src/app/api/hr/evaluations/[id]/route.ts:28` | 既存の権限・操作記録を維持。旧候補全体で置換しない |
| SFA商談の行lock・更新版・private応答 | `src/app/api/sfa/deals/[id]/route.ts:13` | 既存補修は保持。担当者別の閲覧/編集方針は未決 |
| AI商談一覧の読取版 | `src/app/(shell)/aishodan/Tool.tsx:93` | 既存loadVersionを残す。actor/組織境界とは別の防御 |
| AIO quick startのactor/取消 | `src/app/(shell)/aio/Entry.tsx:52` | 既存actor epoch・AbortControllerあり。残差はsign-in callbackのscope引継ぎ |
| HR設定の組織要求hook | `src/app/(shell)/hr/settings/page.tsx:3` | 既存HR組織scopeを維持。所有権移譲clientの残差だけ調べる |

## 次に扱うバッチ

P1は再現確認を優先する候補です。現行コードだけで実害を実証したという優先度ではありません。移植前に対象サービス仕様と課金仕様を読む。外部送信・本番DB・実Stripe・有料モデルは使わず、合成応答と許可された隔離環境で確認します。

| ID/優先 | 現在の動作と起点 | 再現するtrigger | 旧修正の意図 | 現行へ移す際の依存範囲 | 合格条件と制約 |
|---|---|---|---|---|---|
| ASK / P1・次候補 | `src/app/(shell)/asklink/Tool.tsx:70` のcreateはPOST後にrunを反映してqueueを開始。`src/app/api/asklink/runs/route.ts:20` は作成枠を確保し、操作idによる再取得がない | サーバー成功後の応答消失→再押下、A→B切替後のA後着応答、履歴の失敗/不正応答、再生成後の質問とバナー版の不一致 | durable creation/regen、actor scope、結果不明をGETで照会し二重生成を防ぐ、本文サイズ/期限と応答契約 | UI3移動先・RunResult/useBannerQueue・AskLinkAuthenticatedScope/useAskLinkCreation/useAskLinkRegeneration/BannerRecoveryPanel。API runs/creation-operations/banner/regenとlib/asklink/*operation/*response/*request。認証・削除・Storage補修との依存を切るか同じbatchへ明記 | まず作成と回復を小batch化。操作idの重複、応答消失、取消、利用者切替、不正payload、quota保持を現行画面+APIで確認。旧root cohort自体にもnative regeneration等の未検証が残る。旧21ファイルをそのまま採用しない |
| ORG / P1・次候補 | `src/app/(shell)/aishodan/Tool.tsx:120` で既存withOrg選択、子画面は個別fetch。`src/components/org/OrganizationWorkspaceBoundary.tsx` は現行にない | A組織の画面→B組織へ切替→Aの遅延応答/保存完了、詳細/価格/ダウンロードへ移動、権限失効/所属外の明示org | URL・fetch・jsonを確認済みactor/orgに固定。古い組織の応答を破棄し、所有権を見直す | aishodan7画面、mensetsu6画面、quote4画面と各Layout/ShellFrame/Sidebar。OrgSwitcher・organization-selection-client/workspace-client・OrganizationWorkspaceBoundary/Picker。各APIの明示org拒否との契約 | まず1サービスで境界を作り他へ広げる。UI_SHELL有効/無効、直接URL、同一/別タブ、A→B→A、拒否時に別orgへfallbackしない条件を確認。旧サイドバーを現行Shellへ戻さない |
| ENTRY / P1 | `src/app/(shell)/sfa/Entry.tsx:52` と `src/app/(shell)/shodan/Entry.tsx:49` が初回fetch | 通信失敗を組織なしと扱う、確認済み利用者A→B後のA応答が遷移する | readEntryOrganization/useEntryActorScopeで失敗と組織なしを分ける | 2画面、organization-entry-read、use-entry-actor-scope、navigation-submission、実画面fixture | 旧organization-entry-actor-20261019に歴史的再現あり。現行uiNext分岐を残し、A→B、ABA、失敗→再読込、signin二重押下を限定確認。SFA担当レコードACLの方針とは独立 |
| INV / P1 | aio/hr/shodan招待3画面に個別読取と参加処理 | token/利用者変更、unmount、戻る復元、参加応答消失/403、本文終端停止 | bounded transport・取消・世代照合・結果不明案内 | 3移動画面、organization-invite-request、既存service invite API。メール送信/実招待は対象外 | 既存招待の期限/権限/atomicテスト保持。合成応答のみでUI成功誤認と後着応答を確認 |
| TRANS / P1 | interview材料/文字起こし2画面、既存transcribe/stream API | prepare直後のactor/org変更、操作記録後の応答消失、二重開始、stream中断 | prepare情報とintent・operationIdを対応させて結果不明を回復 | 2画面、transcription-client/request/operation/key、実transcribeとstream API | 現行の文字起こし制限/所有権/stream budgetを保持。既存transcription-client/recovery/admission/providerのfixtureとnative合成経路を対応させる |
| OWNER / P1 | 共通OwnerTransferPanelと7サービスtransfer-owner APIが現行にない。HRは既存APIとclientあり | 移譲前後のrole/member変更、A→B→A、成功応答消失、異なるtargetへ再送 | owner再確認、操作対象/actor固定、同じ移譲結果を回復 | 表のmembers/settings群、OwnerTransferPanel、organization-owner-transfer、promane owner-transfer/http、各API/会員ack契約。HRは既存handlerを拡張 | 既存オーナー移譲方針を再確認してから実装。UIだけ追加しない。実メール/招待を送らない。policy根拠がない追加操作は保留 |
| BILL / P1・親作業と調整 | banner/seo plan/settings等で旧Resume/CancellationRecoveryPanelとuseServiceLogoutが未接続 | Stripe成功後の応答消失、cancel/resume連打、利用者切替、SDK SESSION_ERRORをlogout成功と誤認 | durable予約/回復・継続操作fence・cookie消失の読取確認 | plan/settings6画面、CheckoutButton/Subscription管理、Stripe recovery API・billing/cancellation/resume各helper、auth/logout-status | 現行billing full gateを先に完了。旧branchの課金・退会全体を混ぜず、残差を別batchとして比較。実Stripeと本番DBに接続しない |
| CAT / P2 | `src/app/(shell)/banner/dashboard/page.tsx:732` 等がtemplate一覧を直接fetch | 失敗を空一覧扱い、巨大/不正応答、unmount後更新、後半ページ読取の失敗 | bounded catalogue parser/取消・再読込と既存値保持 | dashboard/test2画面、banner/template-catalogue、既存template API | 文字検査/生成モデルを変更せず、一覧だけ合成検証。現行のUI見本/生成抑制を保持 |
| AUTH / P2 | AIO2画面はonSignInにscope引数を渡していない。現行startGoogleSignInはcallbackUrlの1引数 | 非同期準備後に利用者/画面が変わった後のsign-in | 呼出元scopeの有効性を遷移直前に再確認 | use-aio-quick-start / navigation-submission / auth-navigation、2画面 | 既存actor epochを重複実装しない。SDKをmockしてstale処理の遷移ゼロを確認 |
| UI / P2 | promaneの3画面は旧fallbackレイアウト/nullable inviter参照が残る | 375px長い顧客名/金額/タスク、inviter欠損 | 幅と高さの修正、inviter欠損fallback | promane layout/dashboard/entryのみ。共通Shell分岐とDSを考慮 | UI上書きせず現行の375/1280で再現する。inviterはPrisma必須関係/削除挙動を確認してから修正。セキュリティ欠陥に数えない |
| POLICY / 保留 | SFA getSfaContextと商談の行lock/更新版は存在 | 同じ組織のmemberが他担当レコードを閲覧/編集 | 旧23ケースの方針との差異を整理する | `src/lib/sfa/access.ts`、`src/lib/sfa/mutation-authority.ts`、deal/lead/account/contact各API、一覧/エクスポート | 一般memberの閲覧/編集範囲はユーザー回答待ち。旧expectationを正解としてACLを変更しない |

## 優先2候補の着手単位とテスト対応

次の分割は実装承認済みという意味ではなく、台帳から実行へ進む際の最小単位です。現行でtriggerを再現できなければその補修は移さず、同等実装の根拠を追記します。

| 単位 | 現行からの再現 | 移植を検討する依存 | テストの対応と終了条件 |
|---|---|---|---|
| ASK-1 作成と結果回復 | ToolのPOST成功応答だけを落とし、再押下で新runが増えるかを合成環境で確認。A→B後の成功表示も確認 | `useAskLinkCreation.ts`、`creation-intent-client.ts`、`creation-operation.ts`、`creation-response.ts`、`creation-operations/[operationId]/route.ts` とruns POST。認証scopeと結果照会に必要な最小共通部だけ選ぶ | 旧 `scripts/security-regression/verify-asklink-creation-pages.cjs`、`verify-asklink-write-acceptance.cjs` は現行に存在しない。移動先/新UIへfixtureを合わせ、同一operation再送1run、応答消失後のGET回復、actor変更時に旧表示ゼロ、結果不明時に再作成しないを確認 |
| ASK-2 履歴の契約 | 現行history一覧/detailに後着・非JSON・過大本文・403を与え、古いrunが残らないか確認 | `read-response.ts` / `run-response.ts`、履歴2画面、runs GET/detail APIのactor/format/page契約 | 旧 `verify-asklink-history-mounted.cjs` / `verify-asklink-history-read.cjs` は現行に存在しない。既存一覧UI・ページングを保ち、旧データ非表示/再読込/カーソル不正拒否を確認 |
| ASK-3 バナー/再生成 | ASK-1/2が整った後に質問変更→queue進行中→別run/actorへ切替を確認 | useBannerQueue/RunResult、banner operation/source/key/readiness/response、regen operation/client、対応API | 旧 `verify-asklink-banner-queue-mounted.cjs` / `verify-asklink-banner-client.cjs` と `scripts/security-regression/native-asklink/` は現行に存在しない。旧候補で未完了だった再生成成功UI/版整合も新たに証明する。各providerはmock |
| ORG-1 1サービスの境界 | aishodanの現行Tool→詳細→価格→settingsでorgを変更し、送信先と後着状態を観測 | OrganizationWorkspaceBoundary/Picker、organization-selection-client/workspace-client、OrgSwitcher、AishodanShellFrame/Layout/Sidebar、7画面。APIが明示orgを拒否する契約と合わせる | 現行 `scripts/security-regression/verify-organization-layout-mounted.cjs` を保持。旧追加 `verify-organization-workspace-scope.cjs` / `verify-organization-workspace-shell.cjs` / `verify-organization-workspace-recovery.cjs` / `verify-organization-workspace-picker.cjs` は現行に存在しない。fixtureを現行Shellへ対応し、orgなし/所属外を別orgへfallbackさせないことを確認 |
| ORG-2 対象サービス展開 | ORG-1後にmensetsu6画面、quote4画面へ同じtriggerを適用。PDF hrefも対象 | 各ShellFrame/Layout/SidebarとAPIへの明示org、既存useQuoteIssuerSettingsやloadVersionを維持 | 現行mensetsuのcompare/session/template検証、quote document/settings/workspace検証を保持。跨ぐ操作だけ追加して、同じ境界で実装を統一できるか判定 |

## 移動44件の意味対応

C=旧26件のclean、M=旧18件のmanual。いずれも現行へ適用済みを表す記号ではありません。行の現行参照は比較時の直接根拠です。表の「未反映」は記載した旧機構の未接続を意味し、脆弱性の実証を意味しません。

| # | 旧パス | 現行の根拠 | 旧案 | バッチ | 判定 |
|---|---|---|---|---|---|
| 1 | `src/app/aio/Entry.tsx` | `src/app/(shell)/aio/Entry.tsx:57` | C | AUTH | 未反映: 遅延sign-inのscope引継ぎ |
| 2 | `src/app/aio/[orgSlug]/members/page.tsx` | `src/app/(shell)/aio/[orgSlug]/members/page.tsx:11` | C | OWNER | 未反映: 共通所有権移譲UI |
| 3 | `src/app/aio/[orgSlug]/scan/page.tsx` | `src/app/(shell)/aio/[orgSlug]/scan/page.tsx:26` | C | AUTH | 未反映: 遅延sign-inのscope引継ぎ |
| 4 | `src/app/aio/invite/[token]/page.tsx` | `src/app/(shell)/aio/invite/[token]/page.tsx:32` | C | INV | 未反映: 招待読取・参加の取消/遅延応答防止 |
| 5 | `src/app/aishodan/Tool.tsx` | `src/app/(shell)/aishodan/Tool.tsx:71` | M | ORG | 未反映: URLと要求の組織固定 |
| 6 | `src/app/aishodan/preview/page.tsx` | `src/app/(shell)/aishodan/preview/page.tsx:40` | M | ORG | 未反映: URLと要求の組織固定 |
| 7 | `src/app/aishodan/pricing/page.tsx` | `src/app/(shell)/aishodan/pricing/page.tsx:8` | C | ORG | 未反映: URLと要求の組織固定 |
| 8 | `src/app/aishodan/scenarios/[id]/page.tsx` | `src/app/(shell)/aishodan/scenarios/[id]/page.tsx:37` | M | ORG | 未反映: URLと要求の組織固定 |
| 9 | `src/app/aishodan/sessions/[id]/page.tsx` | `src/app/(shell)/aishodan/sessions/[id]/page.tsx:61` | M | ORG | 未反映: URLと要求の組織固定 |
| 10 | `src/app/aishodan/sessions/page.tsx` | `src/app/(shell)/aishodan/sessions/page.tsx:47` | M | ORG | 未反映: URLと要求の組織固定 |
| 11 | `src/app/aishodan/settings/page.tsx` | `src/app/(shell)/aishodan/settings/page.tsx:13` | C | OWNER | 未反映: 共通所有権移譲UI |
| 12 | `src/app/asklink/Tool.tsx` | `src/app/(shell)/asklink/Tool.tsx:52` | M | ASK | 未反映: actor/操作記録/履歴契約 |
| 13 | `src/app/asklink/history/[id]/page.tsx` | `src/app/(shell)/asklink/history/[id]/page.tsx:12` | C | ASK | 未反映: actor/操作記録/履歴契約 |
| 14 | `src/app/asklink/history/page.tsx` | `src/app/(shell)/asklink/history/page.tsx:21` | M | ASK | 未反映: actor/操作記録/履歴契約 |
| 15 | `src/app/banner/dashboard/page.tsx` | `src/app/(shell)/banner/dashboard/page.tsx:732` | C | CAT | 未反映: bounded catalogue読取 |
| 16 | `src/app/banner/dashboard/plan/page.tsx` | `src/app/(shell)/banner/dashboard/plan/page.tsx:43` | M | BILL | 未反映: recovery UI/ログアウト完了確認 |
| 17 | `src/app/banner/dashboard/settings/page.tsx` | `src/app/(shell)/banner/dashboard/settings/page.tsx:18` | M | BILL | 未反映: recovery UI/ログアウト完了確認 |
| 18 | `src/app/banner/test/page.tsx` | `src/app/(shell)/banner/test/page.tsx:428` | C | CAT | 未反映: bounded catalogue読取 |
| 19 | `src/app/doyalist/settings/page.tsx` | `src/app/(shell)/doyalist/settings/page.tsx:50` | C | BILL | 未反映: recovery UI/ログアウト完了確認 |
| 20 | `src/app/hr/invite/[token]/page.tsx` | `src/app/(shell)/hr/invite/[token]/page.tsx:37` | C | INV | 未反映: 招待読取・参加の取消/遅延応答防止 |
| 21 | `src/app/hr/settings/page.tsx` | `src/app/(shell)/hr/settings/page.tsx:545` | C | OWNER | 一部既存: HR移譲APIあり。旧client fenceは未反映 |
| 22 | `src/app/interview/projects/[id]/materials/page.tsx` | `src/app/(shell)/interview/projects/[id]/materials/page.tsx:126` | C | TRANS | 未反映: 文字起こしprepare/intent/recover |
| 23 | `src/app/interview/projects/[id]/transcribe/page.tsx` | `src/app/(shell)/interview/projects/[id]/transcribe/page.tsx:55` | C | TRANS | 未反映: 文字起こしprepare/intent/recover |
| 24 | `src/app/mensetsu/Tool.tsx` | `src/app/(shell)/mensetsu/Tool.tsx:76` | C | ORG | 未反映: URLと要求の組織固定 |
| 25 | `src/app/mensetsu/compare/page.tsx` | `src/app/(shell)/mensetsu/compare/page.tsx:59` | C | ORG | 未反映: URLと要求の組織固定 |
| 26 | `src/app/mensetsu/pricing/page.tsx` | `src/app/(shell)/mensetsu/pricing/page.tsx:8` | C | ORG | 未反映: URLと要求の組織固定 |
| 27 | `src/app/mensetsu/sessions/[id]/page.tsx` | `src/app/(shell)/mensetsu/sessions/[id]/page.tsx:29` | C | ORG | 未反映: URLと要求の組織固定 |
| 28 | `src/app/mensetsu/settings/page.tsx` | `src/app/(shell)/mensetsu/settings/page.tsx:42` | M | ORG | 未反映: 組織/読取版/保存ack照合 |
| 29 | `src/app/mensetsu/templates/[id]/page.tsx` | `src/app/(shell)/mensetsu/templates/[id]/page.tsx:45` | M | ORG | 未反映: 組織/読取版/保存ack照合 |
| 30 | `src/app/promane/[workspaceSlug]/layout.tsx` | `src/app/(shell)/promane/[workspaceSlug]/layout.tsx:27` | C | UI | 独立再評価: 共通Shellの旧fallbackレイアウト |
| 31 | `src/app/promane/[workspaceSlug]/members/page.tsx` | `src/app/(shell)/promane/[workspaceSlug]/members/page.tsx:29` | M | OWNER | 未反映: 共通所有権移譲UI |
| 32 | `src/app/promane/[workspaceSlug]/page.tsx` | `src/app/(shell)/promane/[workspaceSlug]/page.tsx:258` | M | UI | 独立再評価: 狭幅/長文と現行DSの整合 |
| 33 | `src/app/promane/page.tsx` | `src/app/(shell)/promane/page.tsx:137` | C | UI | 未反映: inviter不在時のfallback |
| 34 | `src/app/quote/Tool.tsx` | `src/app/(shell)/quote/Tool.tsx:68` | C | ORG | 未反映: 組織固定/権限再読取 |
| 35 | `src/app/quote/documents/[id]/page.tsx` | `src/app/(shell)/quote/documents/[id]/page.tsx:29` | M | ORG | 未反映: 組織固定/権限再読取 |
| 36 | `src/app/quote/pricing/page.tsx` | `src/app/(shell)/quote/pricing/page.tsx:11` | M | ORG | 未反映: 組織固定/権限再読取 |
| 37 | `src/app/quote/settings/page.tsx` | `src/app/(shell)/quote/settings/page.tsx:30` | M | ORG | 未反映: 組織固定/権限再読取 |
| 38 | `src/app/seo/dashboard/plan/page.tsx` | `src/app/(shell)/seo/dashboard/plan/page.tsx:21` | C | BILL | 未反映: recovery UI/ログアウト完了確認 |
| 39 | `src/app/seo/settings/page.tsx` | `src/app/(shell)/seo/settings/page.tsx:11` | C | BILL | 未反映: recovery UI/ログアウト完了確認 |
| 40 | `src/app/sfa/Entry.tsx` | `src/app/(shell)/sfa/Entry.tsx:52` | M | ENTRY | 未反映: 初回組織読取の失敗区別/actor fence |
| 41 | `src/app/sfa/[orgSlug]/members/page.tsx` | `src/app/(shell)/sfa/[orgSlug]/members/page.tsx:27` | C | OWNER | 未反映: 共通所有権移譲UI |
| 42 | `src/app/shodan/Entry.tsx` | `src/app/(shell)/shodan/Entry.tsx:49` | M | ENTRY | 未反映: 初回組織読取の失敗区別/actor fence |
| 43 | `src/app/shodan/[orgSlug]/members/page.tsx` | `src/app/(shell)/shodan/[orgSlug]/members/page.tsx:11` | C | OWNER | 未反映: 共通所有権移譲UI |
| 44 | `src/app/shodan/invite/[token]/page.tsx` | `src/app/(shell)/shodan/invite/[token]/page.tsx:28` | C | INV | 未反映: 招待読取・参加の取消/遅延応答防止 |

## 44件以外の重要な依存と境界

- 不存在105 runtimeは、共通組織境界、所有権移譲、AskLink operation/recovery、logout確認、課金結果回復、アカウント退会とStorage削除などに集中する。ファイル不存在だけで既存機能の欠陥とはしない。上位batchごとに同等実装・不要化・移植対象へ分ける。
- 退会/アセット削除候補: `account-deletion-*` / `account-*-cleanup` / `retired-*`、admin users deletion/recovery、cron storage purge。旧候補は課金・所有権・Storageと結合する。現行の安全条件、遷移/競合、廃止workerの互換性とDB仕様を読むまではportしない。運用CRONや本番DDLを追加しない。
- 同一パス81件の旧previewは31 clean / 50 manual。依存関係、Prisma、Stripe、メンバーAPI、Storage、サイドバー、回帰スクリプトを含む。44件の表はこの81件の代わりではない。特に旧package/schemaを現行へ上書きしない。
- 旧テストは当時のAPI/画面名、source hashに結び付く。copyして合格させるのでなく、現行でtriggerが成立することと補修後に防げることを確認する。旧133工程の全再実行は小batchの再現/修正が終わってから現行CIの集合へ対応させる。

## 歴史的な証拠と今回の証拠

旧 `organization-entry-actor-20261019` の706入力は全133工程が合格した記録。旧 `hr-employee-cache-20261019` の707入力は差分23ケース・型・Lint・ビルド・実HR26ケースが合格した記録。707で全133工程を再実行した証拠ではありません。`goal-loop-current-handoff.json` の `latestAuthoritativeContinuation` を参照し、古いキーのrunning-sessionやscope件数を現況と見なさない。

今回行った確認はmanifest/hash比較、固定候補treeから旧差分の抽出、44移動先と関連する現行ソースの直接読取です。アプリ実行・DB・HTTP・ブラウザ・有料providerの検証はしていません。現行のfull gate結果は親作業の記録を参照します。本番反映、コミット、pushはしていません。

Luna利用: 未使用。通常のCodexで比較と台帳作成を実施。

## 台帳作成後のENTRY補修

ENTRYの入口2画面は、その後に現行sourceで再現・補修しました。初回読取の失敗区別、actor世代、取消、再読込を限定実装し、同じ実画面fixtureで修正前10合格/32不合格、修正後42合格を確認しました。既存送信18ケースも保持して合格、対象Lintと型検査も合格です。上の44件表は補修前の比較記録です。現行source hash・修正範囲・検証条件は `entry-read-repair/verification.json` と `entry-read-repair/README.md` を参照してください。全707候補の統合完了は主張しません。
