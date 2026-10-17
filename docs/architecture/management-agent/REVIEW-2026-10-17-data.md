<!-- 2026-10-17 第2回 独立審査（data）。読み取り専用の審査担当による。設計書の改訂3はこれを反映して行う。 -->

# DB 設計・移行計画 再監査（schema-draft 改訂 2 / README §5・§12 / CHECKLIST）

対象: `/Users/mitsumori_katsuki/Code/09_Cursol-ui-renewal/docs/architecture/management-agent/{README.md, schema-draft.prisma, CHECKLIST.md}`。実測は `prisma/schema.prisma`（4,623 行、`@@map` 157 件、`cuid()` 181 件）と `src/` の grep、およびスクラッチ領域で付録 C の規則どおり結合した schema に対する `prisma validate`（Prisma 5.22.0）。リポジトリは無変更。

実測結果の要約:
- 結合 validate: merge-into 27 件、新規 model 32 件で **valid**（付録 C の記述と一致）。`prisma format` との差分は空白のみ（補われる relation は無し）。
- `@@map` 衝突: 既存 157 件と draft 32 件の交差 **0**。model 名の衝突 **0**。relation 名（`CompanyInvitationInvitedBy` / `AgentRunRequestedBy` / `ApprovalRequestedTo`）は既存に無し。

**重大: 4 件（DATA-01〜04）**。

---

## A. 重大

### DATA-01 既存の管理者ユーザー削除 API が、Phase1 以降すべてのユーザーで P2003 になる
- 場所: schema-draft L271/L277（`CompanyMember.company/user` Restrict）、L339（`CompanyInvitation.invitedBy` Restrict）、L631（`AgentConversation.user` Restrict）、L654（`AgentRun.requestedBy` Restrict）、L817（`ApprovalRequest.requestedTo` Restrict）、README §6.4 手順 5「所属会社が無いユーザーは個人会社を自動生成」
- 根拠: `src/app/api/admin/users/route.ts` L301-308 は `userServiceSubscription / generation / session / account` を消してから `tx.user.delete` する既存の本番ルート。README・CHECKLIST にこのルートへの言及が無い（grep `user.delete|退会|ユーザー削除` で README 0 件）。
- 何が起きる: Restrict FK を持つ行が 1 つでもあれば `user.delete` が FK 違反で失敗し、トランザクション全体が巻き戻り 500。設計上は全ユーザーに「個人会社」の owner `CompanyMember` 行が作られるため、Phase1 の名寄せ直後から**全ユーザーの削除が不可能**になる。`CompanyMember` は `removed` 行も残す方針なので、脱退済みでも消せない。
- 直し方: (1) §15 または §9.1 に「`admin/users` DELETE の改修」を明記し、削除前に「owner 移譲 or 会社の論理削除 → `CompanyMember` 物理削除（監査用には `AuditLog` に残す）→ `AgentRun.requestedById` 等は Restrict のまま削除拒否（409 で理由提示）」の手順を固定する。(2) `CompanyInvitation.invitedById` は `String?` + `SetNull` に（招待履歴で削除を止める価値は無い）。(3) CHECKLIST SCH-03 に「既存 `user.delete` 経路がある」ことを追加。

### DATA-02 移行された旧契約（`metadata.companyId` 無し）の `CompanySubscription` が webhook で更新されず、解約・支払い失敗後も会社の有償権利が残る
- 場所: README §7.2 手順 3-4、§7.3「見つからなければ既存 `syncUnifiedBilling()`」、§12 Phase3 `billing.company_mode`
- 根拠: §7.2 手順 3 は **Customer** の metadata にだけ `companyId` を書く（`customers.update`）。`customer.subscription.*` イベントの payload は Subscription オブジェクトであり Customer の metadata は含まれない。手順 4「`CompanySubscription` に写す」に `subscriptions.update({metadata})` も `stripeSubscriptionId` による逆引きも無い。§7.3 の分岐は `sub.metadata.companyId` → 無ければ `syncUnifiedBilling`（User.plan 側のみ更新）。
- 何が起きる: Phase3 で権利判定が `CompanySubscription` 由来になった瞬間、移行された全契約は Stripe 側の `canceled / unpaid / past_due` が DB に反映されない。解約後も Pro のまま（逆に `seats` 変更も反映されない）。
- 直し方: §7.3 の分岐を 3 段に: `sub.metadata.companyId` → **`CompanySubscription.findUnique({stripeSubscriptionId})` による逆引き** → `syncUnifiedBilling`。加えて §7.2 手順 4 で `stripe.subscriptions.update(id, {metadata: {companyId}})` を必ず行い、`verify-billing-company-webhook-idempotent.cjs`（BIL-01/02）に「metadata 無し Subscription の status 変更が `CompanySubscription` に反映される」ケースを追加。

### DATA-03 メンバー除籍の二重書き込み「旧 Member 行も INACTIVE」が、旧 7 系統の招待受諾ロジックと `@@unique([organizationId, userId])` で衝突し、再入社が永久に 409 になる
- 場所: README §11.6 (2)「9 系統の旧 Member 行も `INACTIVE`（移行期）」、§7.1「再入社は removed 行の upsert」、§12 Phase2
- 根拠: 旧 7 系統の除籍は **物理削除**（`src/app/api/sfa/members/[id]/route.ts` L36 `tx.sfaMember.delete`、shodan/aio/mensetsu/quote/aishodan 同様、hr は `deleteMany` L45）。再招待受諾（`src/app/api/sfa/invite/[token]/route.ts` L72-86）は `status:'ACTIVE'` の既存行しか見ず、PENDING 行に `userId` を `updateMany` で書く → 同じ `(organizationId, userId)` の INACTIVE 行があれば **P2002** → catch で 409「招待の状態を確認できませんでした」。kintai は P2002 を明示的に 409 にしている（`kintai/invite/[token]/route.ts` L110）。
- 何が起きる: Phase2〜3 で新 API から除籍した人を旧 UI（または新 UI の逆方向書き込み）で再招待すると受諾できない。shadow 差分も「新=active / 旧=INACTIVE」のまま収束しない。
- 直し方: 旧側の意味論に合わせ、逆方向（新→旧）の除籍は **旧行を物理削除**し履歴は `CompanyMember(status=removed)` だけに持つ。`tenant-reconcile.ts` の対応表に「旧行なし ⇔ 新 removed」「旧 PENDING ⇔ 新 `CompanyInvitation`」「旧 INACTIVE（kintai のみ）⇔ 新 suspended」を明記。CHECKLIST MIG-07 に再入社ケースを追加。

### DATA-04 `KintaiMember` の招待中行は `userId='pending_<uuid>'` であり、§5.1 の孤児判定を先に当てると全招待が INACTIVE に隔離される
- 場所: README §5.1 Kintai 行（孤児 → `INACTIVE` 隔離、`PENDING` → `CompanyInvitation`）、§13 #1
- 根拠: `src/app/api/kintai/employees/route.ts` L123-125 `userId: \`pending_${crypto.randomUUID()}\`, status: 'PENDING'`。`KintaiMember.userId` は NOT NULL・FK なし（schema L2414）。
- 何が起きる: 「`userId` が `User` に存在しない行＝孤児」を機械的に適用すると、招待中の従業員が全員 `INACTIVE` に書き換えられ、招待 URL が無効になる（旧 accept は `status:'PENDING'` を要求、L75）。データは消えないが運用上の事故。
- 直し方: 孤児判定の前に `status='PENDING' AND userId LIKE 'pending_%'` を招待として除外する順序を §5.1 に明記。CHECKLIST MIG-03 の「孤児 0 件」も「隔離後 0 件」ではなく「未分類 0 件」に言い換える（隔離後も孤児は残るので完了条件として矛盾）。

---

## B. 中

### DATA-05 Phase1 の `Session` 変更は index だけでなく **FK 追加**がロックを取る。index 名が Prisma 規約と一致しないと `db push` が二重に作る
- 場所: README §12 Phase1、CHECKLIST SCH-12 / OPS-03、schema-draft L69・L92-93
- 根拠: 結合後の `Session` には `deviceId` → `sec_session_devices` の FK が付く。`prisma db push` は `ALTER TABLE "Session" ADD CONSTRAINT "Session_deviceId_fkey" FOREIGN KEY ...` を発行し、既存行の検証スキャン中は Session への UPDATE（`updateAge: 60`、`src/lib/auth.ts` L189）をブロックする。README は index のみ言及。
- 直し方: 手順書に実名を固定する: `CREATE INDEX CONCURRENTLY "Session_userId_revokedAt_lastSeenAt_idx" ON "Session"("userId","revokedAt","lastSeenAt")`、`"Session_deviceId_idx"`、FK は `ADD CONSTRAINT "Session_deviceId_fkey" ... NOT VALID` → `VALIDATE CONSTRAINT`（同名なら db push は差分なし）。`SET lock_timeout='5s'` で db push を実行。なお draft に `User` の index は無く、`AuditLog` は新規テーブル（空）なので CONCURRENTLY 不要。README/CHECKLIST の「Session / User / AuditLog」は「Session のみ」に直す。

### DATA-06 `Session` 行を失効後も残す方針だが、失効・期限切れ行の purge が無い
- 場所: schema-draft L83「削除せず残し、監査に使う」、README §11.3
- 根拠: 既存コードに Session の定期削除は無い（`session.deleteMany` は admin のユーザー削除のみ、`src/app/api/admin/users/route.ts` L305）。PrismaAdapter も期限切れ行を消さない。
- 何が起きる: 1 分ごとに UPDATE されるホットテーブルが単調増加し、`[userId, revokedAt, lastSeenAt]` index と `getSessionAndUser` の性能が劣化。
- 直し方: `cron/security-scan` に「`expires < now()-90d OR revokedAt < now()-90d` の行を削除」を追加（監査上必要な情報は `AuditLog(session.revoke)` に残す）。件数見積もり（現在の Session 行数）を Phase0 ドライラン項目に追加。

### DATA-07 名寄せアルゴリズムが §5.1 内で矛盾し、`owner` が複数いる組織の扱いが未定義
- 場所: README §5.1 名寄せ 1〜6、§14 D3
- 根拠: 手順 1 は「owner が同じ `User.id` なら束ねる」、手順 2 は「slug 完全一致なら束ねる（`linkedBy='slug'`）」、手順 4 は「owner が異なるものは人が決める」、手順 6 は「3 条件すべてを満たすときだけ自動」。手順 2 は owner が異なっても slug 一致で束ねる余地を残し、手順 4・6 と矛盾（他社データ混入の経路）。また `role='owner'` は 1 組織に複数行あり得る（例 `src/lib/aio/access.ts` L124/L155 で 2 経路から owner 作成、kintai は `system_admin` 複数可）。「owner の email」が一意に決まらない。
- 直し方: 手順 1・2 を削除し、手順 6（3 条件）を唯一の自動規則にする。「代表 owner＝`acceptedAt`（無ければ `createdAt`）最古の ACTIVE owner、`userId NOT NULL`」を定義。`CompanyServiceLink.linkedBy` の値 `'slug'` は draft L392 からも落とす。

### DATA-08 複数系統の PENDING 招待を 1 会社に畳むと `CompanyInvitation.activeKey` で P2002
- 場所: schema-draft L344、README §5.1 招待の移行列
- 根拠: 同一メールが SFA と Shodan の両組織で PENDING（旧側は系統ごとに独立）で、両組織が同じ `Company` に名寄せされると `activeKey='<companyId>:<email>'` が 2 行目で衝突。さらに旧 `*Member.inviteToken` 行は `expiresAt` を持たず（TTL は `createdAt` から計算、`sfa/invite` L51 `INVITE_TTL_MS`）、`CompanyInvitation.expiresAt` NOT NULL に写す規則が無い。`HrInvitation.invitedBy`（`src/app/api/hr/organization/invite/route.ts` L81 で userId）が退職者なら `invitedById` の FK で失敗。
- 直し方: 移行は「同一 (companyId, lower(email)) の PENDING を 1 件に統合、`serviceRoles` は和集合、`tokenHash` は最新の 1 本、他は `revoked`」。`expiresAt = createdAt + 系統別 TTL`。`invitedById` が存在しなければ会社 owner にフォールバック（DATA-01 の SetNull 化なら null）。

### DATA-09 Phase1 の「旧データは触らない」と、断片列（`*Organization.companyId` / `*Member.companyMemberId` / `*Profile.companyProfileId`）の backfill が矛盾。正本が二重
- 場所: README §12 Phase1、schema-draft L96-205、§4.3
- 根拠: 旧組織↔会社の対応は `CompanyServiceLink`（isPrimary 付き）と `HrOrganization.companyId` 等の 2 か所に存在するが、どちらが正本で、いつ・誰が旧表の列を埋めるかが README に無い（grep `companyMemberId|companyProfileId|backfill` は ER 図と verify 名のみ）。
- 直し方: 「正本は `CompanyServiceLink`。`*Organization.companyId` は派生列で、Link と同一トランザクションで書く。Phase1 の名寄せバッチが埋める（旧データへの唯一の書き込み）」と明記。`tenant-reconcile.ts` の検査項目に Link と派生列の不一致を追加。Phase1 完了→Phase2 ON の間にも旧 Member は変わるので、**Phase2 初回 ON 前にも reconcile を必須**にする（B-24 はロールバック後のみ）。

### DATA-10 `purge` バッチの順序に Restrict 対象が含まれず、`Company` の物理削除が必ず失敗する
- 場所: README §13 #35「Artifacts→Runs→Members→Links→旧組織→Company」、§9.1 `DELETE /api/company/[id]`「30 日後に purge」、schema-draft の Restrict（`UsageLedger` L577、`UsageBalance` L609、`BillingAccount` L528、`CompanySubscription` L548、`AgentConversation` L629、`AuditChainHead` L919、`CompanyServiceLink` L385）
- 何が起きる: 順序どおり消しても `UsageLedger / UsageBalance / BillingAccount / CompanySubscription / AgentConversation / AuditChainHead` が残って `Company` 削除が P2003。「課金台帳は 3 年保持」なら Company 行自体を 3 年残す必要があり、「30 日後 purge」と両立しない。
- 直し方: purge の定義を「PII を持つ子（Members/Invitations/Profile/BrandAsset/Knowledge/Agent*）の削除と `Company.name` 等の匿名化」に限定し、`Company` 行・課金系・`AuditLog` は保持期間満了まで残すと明記。§13 #35 の順序を Restrict 一覧と突き合わせて書き直す。

### DATA-11 `AgentStep @@unique([runId, ord])` と「再計画で version を上げて上書き」が両立しない
- 場所: schema-draft L711-718（`AgentPlan.version / revisions`）、L766
- 何が起きる: 再計画で新しい step 群を同じ run に作ると `ord` が旧 step と衝突。旧 step を削除すれば `ToolCall`（Cascade）と `ApprovalRequest` の履歴が消える。`ApprovalRequest.stepId @unique`（L812）も、承認が `expired` になった後の再要求ができない。
- 直し方: `AgentStep.planVersion Int @default(1)` を足し `@@unique([runId, planVersion, ord])`。旧版 step は `status='superseded'` で残す。`ApprovalRequest` は `@@unique([stepId, attempt])` か「expired 行を再利用して pending に戻す」の規則を明記。

### DATA-12 プランナーの LLM 呼び出しを run に紐づける列が無く、§7.4「実コストは `LlmCallLog` で数える」が成立しない
- 場所: schema-draft L952-985（`LlmCallLog.toolCallId` のみ、`refType/refId` の規約なし）、README §4.2 `AgentRun ||--o{ LlmCallLog`、§7.4、§9.2 `GET /api/agent/usage`
- 直し方: プランナー呼び出しは `refType='agent.run', refId=runId` を必須にし、`@@index([refType, refId])` を追加。`AgentRun.llmCallCount / llmCostMinor` はこの集計で検算する旨を §8.5 に追記。

### DATA-13 `UsageBalance` を「同一トランザクションで更新」すると会社ごとの行ロックで直列化し、`connection_limit=3` と並列 step（最大 4）が噛み合わない（B-19 と同型）
- 場所: README §7.4、schema-draft L606-618
- 直し方: 残高判定は `UsageLedger` の `SUM` を短いトランザクションで行い、`UsageBalance` は cron または非同期で再計算（正本は台帳なので遅延可）。少なくとも `reserve` は台帳 INSERT 1 本で完結させる。

### DATA-14 Phase3 ロールバックで会社 Checkout 契約者の旧経路権利（`User.plan`）が無い
- 場所: README §7.3「`metadata.companyId` があれば `handleCompanyCheckout` を実行（旧経路に落とさない）」、§12 Phase3 戻し方「二重書き込みは継続しているので DB は整合」
- 何が起きる: Phase3 中に会社 Checkout で契約したユーザーは `User.plan / UserServiceSubscription` が更新されない。`billing.company_mode` を OFF に戻すと、その会社の全員が FREE 扱いになる（データ損失ではないが権利喪失）。
- 直し方: Phase2〜3 の間は `handleCompanyCheckout` 内で **owner の `syncUnifiedBilling` も併せて呼ぶ**（二重書き込みの課金版）と明記。または Phase3 の戻し方に「会社契約者の `User.plan` を再同期する手順」を追加。

---

## C. 軽微

- **DATA-15** `CompanyProfile` 列対応（§5.2）で実列名が違う／抜けているもの: `representativeName` ← `QuoteIssuer.personName`（L3890）、`companySize` ← `HrOrganization.size`（L2096）、`ngWords` の `AdImageBrand.ngWords` は **`Json?`**（L4302）で `String[]` ではない（変換規則が必要）、`HrOrganization.logoUrl`（L2094）が `BrandAsset(kind=logo)` の候補から漏れ、`MensetsuCompanyProfile.companyName`（L3635）が `legalName` 候補から漏れ。`HrOrganization.fiscalMonth` は **`@default(4)` NOT NULL**（L2099）なので未設定組織でも 4 が入り、「事実」として写すと誤り（既定値と同じなら `fieldSources` に `origin:'default'` を付けるか写さない）。
- **DATA-16** ER 図と draft のカーディナリティ不一致: §4.1 `Company ||--|| CompanyProfile` / `||--|| BillingAccount`、§4.2 `AgentRun ||--|| AgentPlan` は draft では optional（`CompanyProfile?` L249、`BillingAccount?` L252、`AgentPlan?` L698）→ `||--o|`。§4.3 の `Company ||--o| HrOrganization` 等 9 本と `CompanyProfile ||--o| ShodanCompanyProfile / AioBrandProfile / QuoteIssuer` は、B-4 対応で 1 会社 N 旧組織を許した以上 `||--o{`。§4.1 `UsageLedger.kind` に draft の `adjust`（L586）が無い。
- **DATA-17** 文書間の表記揺れ: `UsageLedger.idempotencyKey` が §13 #10 では `'stripe:<eventId>'`、§7.3・draft L573 では `'stripe:<eventId>:grant'`。§13 #14「9 組織＋9 Member＋**7** プロフィール＋Session＋User＝27」は実際の断片が 9+9+**6**（Shodan/Aio/Mensetsu/Cunning/Quote/AdImage）+Session+User+**Account**=27 で内訳が違う。§5.1 の `CompanyServiceLink.linkedBy` に `'slug'` があるが手順 6 では使わない。
- **DATA-18** FK 列に index が無いもの（PostgreSQL では Prisma が自動作成しない）: `AgentRun.conversationId`（`conversation.runs` の取得が seq scan）、`UsageLedger.userId`（SetNull 時に全走査）、`CompanyInvitation.invitedById`、`ApprovalRequest.runId`。`AgentRun` に `@@index([conversationId, createdAt])` を追加。
- **DATA-19** `FeatureFlag` は `scope` と `companyId` が二重表現で、`scope='<id>' AND companyId IS NULL` の矛盾行を防ぐ制約が無い（Prisma では CHECK 不可）。書き込み関数で `scope !== '*' ⇒ companyId === scope` を強制し `verify-core-feature-flag-scope.cjs` に含める。
- **DATA-20** `KnowledgeSource.allowedServices @default([])` を「空＝全サービス」と定義しているため、取り込み時に指定を忘れた HR 由来テキストが全サービスへ出る。既定を「空＝どこからも使えない」に反転するか、`service-import` 時は必須にする。
- **DATA-21** `AuditLog` の 5 本の index（L908-912）は追記専用・高頻度 INSERT 表には重い。`[sensitive, createdAt]` は sensitive 行が少数なので `[companyId, createdAt]` + アプリ側フィルタで足りる（Prisma は部分 index を表せない）。
- **DATA-22** `PromaneWorkspace` の slug は「会社名から再生成」（§5.1）だが `Company.slug @unique` に対する重複回避規則（連番付与）が無い。他 8 系統は `<serviceId>-<slug>` で衝突しないことを確認済み。
- **DATA-23** 金額・数量の型: `costMinor / llmCostMinor Int`（1/100 円、上限約 2,147 万円/行）は行単位では十分だが、`GET /api/agent/usage` の月次 SUM は JS 側で `Number` に落とさず `BigInt` 集計にする注記が欲しい。`WebAuthnCredential.counter BigInt` は適切（uint32 は Int に収まらない）。タイムゾーンは全 DateTime が UTC、`period` のみ JST で一貫（問題なし）。

---

## D. 付録 D で「反映」とされたが、実際には直っていない／部分的なもの

| 付録 D | 状態 | 実測 |
|---|---|---|
| E: `auth.ts` L223→L189 | **未反映（部分）** | §2.2 は L189 に直っているが、§13 #5（L1234）と §13 #32（L1262）は `L223` のまま |
| E: `HrOrganization` Stripe 列 L2107-2111 | **未反映（部分）** | §2.5・§7.2 は修正済みだが §13 #13（L1243）は `L2105-2109` のまま |
| E: `HrInvitation.token` L2354 | **未反映（部分）** | §5.1 は L2354 だが §13 #25（L1255）は `L2355` のまま |
| E: `retentionDays` L3595 | **未反映（部分）** | §13 #39（L1269）は `L3598` のまま |
| E: `timingSafeEqual` 0→1 | **未反映（部分）** | §13 #27（L1257）は「`timingSafeEqual` 0 件」のまま |
| B-19（連鎖ハッシュを日次バッチへ） | **矛盾が残る** | §10.6 と draft は後埋め方式に直っているが、§14 D13（L1296）は「コストは行あたり 1 回の `FOR UPDATE`」のまま |
| B-18（ホットテーブルの index） | **不十分** | index のみで FK 追加のロックが未対応（DATA-05）。`User` の index は draft に存在しない |
| A-5 / C-3（Restrict・論理削除） | **副作用未対応** | Restrict 化により既存 `admin/users` DELETE が壊れる点（DATA-01）と purge 順序の不整合（DATA-10）が未検討 |
| B-4（1 会社 N 旧組織） | **ER 図が未更新** | §4.3 のカーディナリティが 1:1 のまま（DATA-16） |
| B-24（reconcile） | **部分** | ロールバック後のみ。Phase1→Phase2 初回 ON 前の reconcile が無い（DATA-09） |
| A-2（Customer 非 unique・metadata.companyId 主キー） | **移行経路が未完** | Subscription 側 metadata を書かず逆引きも無いため、移行契約の webhook が会社側に届かない（DATA-02） |
| B-23（Kintai 実表名） | 正しい | `@@map("kintai_members")` L2425 を確認。ただし DATA-04 の `pending_` 問題は未検討 |

付録 D のうち上記以外（A-3、A-4、A-9、B-5、B-6、B-7、B-8、B-21、B-22、C-1、C-2、C-5 など draft 側の修正）は draft 上で正しく反映されていることを確認した。

---

## E. 補足（推測を含む）

- （推測）`Session` の行数・`AuditLog` の増加率・`UsageLedger` の月次行数の見積もりが README に無い。CHECKLIST MIG-01 のドライラン項目に「Session 総行数／直近 30 日のログイン数」「各系統の Member 行数（PENDING 含む）」「owner が複数いる組織数」「同一メールが複数系統で PENDING の件数」を追加すると DATA-04/07/08 の影響範囲が事前に数値で出る。
- 読めなかった場所: 無し（権限エラー無し）。DB には接続していない。

主要な参照ファイル:
- `/Users/mitsumori_katsuki/Code/09_Cursol-ui-renewal/docs/architecture/management-agent/schema-draft.prisma`
- `/Users/mitsumori_katsuki/Code/09_Cursol-ui-renewal/docs/architecture/management-agent/README.md`
- `/Users/mitsumori_katsuki/Code/09_Cursol-ui-renewal/docs/architecture/management-agent/CHECKLIST.md`
- `/Users/mitsumori_katsuki/Code/09_Cursol-ui-renewal/prisma/schema.prisma`
- `/Users/mitsumori_katsuki/Code/09_Cursol-ui-renewal/src/app/api/admin/users/route.ts`
- `/Users/mitsumori_katsuki/Code/09_Cursol-ui-renewal/src/app/api/sfa/invite/[token]/route.ts`
- `/Users/mitsumori_katsuki/Code/09_Cursol-ui-renewal/src/app/api/kintai/employees/route.ts`
- `/Users/mitsumori_katsuki/Code/09_Cursol-ui-renewal/src/app/api/kintai/invite/[token]/route.ts`
