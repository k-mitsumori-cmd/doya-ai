# 徹底チェック項目（共通テナント・課金・経営エージェント）

対象: [`README.md`](./README.md)（設計書）と、その上に載る全サービス。監査 [`AUDIT-2026-10-17.md`](./AUDIT-2026-10-17.md) の A〜D 全指摘が、いずれかの項目で再発防止されている（末尾の対応表）。

## 使い方

| 場面 | 必ず通す章 | 任意 |
|---|---|---|
| **設計を変えたとき**（README / schema-draft / マニフェスト型の変更） | SCH、TEN、AUTHZ、MIG、AGT（エージェントに触るとき）、AUD | 残り |
| **新サービスを追加するとき**（§16 のマニフェスト 1 件） | TEN、AUTHZ、BIL、SCH、EXT、PII、AUD、IO、UI。ツールを出すなら AGT | AUTH、MIG、OPS |
| **本番に出す前**（各フェーズのデプロイ、Phase 昇格） | 全章。特に OPS、MIG、BIL | — |

列の意味: **確認方法** は「自動＝security-regression の verify スクリプト名案 / lint / prisma validate」「手動＝誰が何を見るか」。**重大度** は H（出すと事故）/ M（放置すると事故）/ L（品質）。**監査** は対応する指摘番号。

---

## 1. TEN テナント分離

| ID | 確認内容（はい/いいえ） | なぜ必要か | 確認方法 | 重大度 | 監査 |
|---|---|---|---|---|---|
| TEN-01 | 全てのテナント所属モデルが、マニフェスト `dataModels` にテナント列（`companyId` / `organizationId` / `workspaceId` / `userId` / `via:`）付きで列挙されているか | 列挙漏れ＝`tenantPrisma` が守らないモデル | 自動: `verify-core-tenant-columns.cjs`, `verify-service-manifest-models.cjs` | H | B-3, M-5, M-6 |
| TEN-02 | route / lib からの DB アクセスは `ctx.db`（`tenantPrisma`）経由で、`@/lib/prisma` を直接 import していないか | 直 import は companyId 強制の外側 | 自動: ESLint `no-restricted-imports`（M-19） | H | B-2 |
| TEN-03 | `findUnique / update / delete / upsert` を `tenantPrisma` が「所属確認→元の操作」に書き換え、戻り値の形を変えていないか | `updateMany` 化は既存コードを壊す | 自動: `verify-core-access-cross-tenant.cjs` | H | B-2 |
| TEN-04 | raw SQL（`$queryRaw` / `$executeRaw`）に `companyId` / `organizationId` / `workspaceId` / `userId` 条件が明示されているか | raw SQL は拡張を素通りする | 自動: `verify-core-raw-sql-tenant.cjs`（Phase3 からエラー） | H | B-2 |
| TEN-05 | テナント列を持たない孫モデルは `via:<relation>` 宣言か、Phase1 で `companyId` を非正規化しているか | 結合無しで強制できない | 自動: `verify-core-tenant-columns.cjs` | H | B-3 |
| TEN-06 | A 社の文脈で B 社の id を渡したとき、`findUnique` が null、`update` が NotFound、一覧に混ざらないか | IDOR の直接検証 | 自動: `verify-core-access-cross-tenant.cjs`、各 `verify-<svc>-tenant-boundary.cjs` | H | A-6 |
| TEN-07 | パスパラメータ・body の id は zod で cuid 形式を検証しているか | 推測可能 id・型違い id の混入防止 | 自動: `verify-agent-tool-input-strict.cjs`、route の zod `.strict()` | M | — |
| TEN-08 | ユーザー単位モデル（`Generation`, `SeoArticle`, `AdImageBrand` 等）は `tenantColumn: 'userId'` で個人会社に写像されているか | 会社化しても守られない領域を残さない | 自動: `verify-core-tenant-columns.cjs` | M | B-3 |
| TEN-09 | `?company=` / `x-company` がセッションの会社と異なる**書き込み**は 409 になるか | リンク誘導による別会社への書き込み防止 | 自動: `verify-core-company-mismatch.cjs` | M | B-25 |
| TEN-10 | 新規会社を作った直後・サービス有効化直後に、旧 `*Organization` が 1 件だけ存在するか | Phase2〜4 の間、旧 route が `organizationId=null` で壊れる | 自動: `verify-core-legacy-org-backfill.cjs` | H | A-7 |
| TEN-11 | `CompanyServiceLink` は 1 会社 N 旧組織を許し、読み替えは `isPrimary` だけを使うか | 同 owner 同サービス複数組織で移行が止まる | 手動: 移行ドライランの「同 owner 複数組織」件数を確認 | M | B-4 |
| TEN-12 | RLS を使う場合、新テーブルのみ・`SET LOCAL` がトランザクション内で発行されているか | pgbouncer transaction pooling では `SET` は漏れる | 手動: DBA が Phase4 の SQL をレビュー | M | — |
| TEN-13 | サーバ内部用ヘッダ（`x-tenant-id` 等）を middleware が削除しているか | ヘッダ偽装による内部信頼の防止 | 自動: `verify-core-route-classes.cjs` 内の middleware ユニット | M | — |

## 2. AUTH 認証・セッション（Google のみ・使い回し防止）

| ID | 確認内容 | なぜ | 確認方法 | 重大度 | 監査 |
|---|---|---|---|---|---|
| AUTH-01 | `authOptions.providers` が Google のみで、Credentials / Email provider が無いか | パスワード・メールリンクは作らない方針 | 自動: `verify-core-google-claims.cjs`（providers を検査） | H | — |
| AUTH-02 | `signIn` で `email_verified !== true` を拒否しているか | 未検証メールでの所属 | 自動: `verify-core-google-claims.cjs` | M | D-5 |
| AUTH-03 | 会社に `allowedGoogleDomains` があるとき `hd` 不一致を拒否し、owner 自身が通らない設定は保存できないか | ドメイン制限とロックアウト防止 | 自動: 同上＋`verify-core-domain-restrict.cjs` | M | — |
| AUTH-04 | セッション失効（`revokedAt`、`sessionsInvalidBefore`）は adapter の `getSessionAndUser` が `null` を返す方式か（`callbacks.session` に頼っていないか） | コールバックの戻り値で無効を表せない | 自動: `verify-core-session-revocation.cjs` | H | B-1 |
| AUTH-05 | 同時セッション上限は端末（`SessionDevice`）単位で、同一 `doya_device` は置換、超過時は同 kind の最古を失効し本人に通知するか | 使い回し抑止と誤ロックアウトの両立 | 自動: `verify-core-session-limit.cjs` | M | B-17 |
| AUTH-06 | 既定端末数は 3 で、Phase2 の通知のみ期間で失効候補件数を集計してから強制しているか | アプリ内ブラウザ・PWA は別端末に数えられる | 手動: Phase2 終了時に集計レポートを見る | M | B-17 |
| AUTH-07 | `Session` 作成と `deviceId` 設定が 1 トランザクションで、`deviceId IS NULL` の行ができないか | レースで端末不明セッションが残る | 自動: `verify-core-session-limit.cjs` | M | — |
| AUTH-08 | `Session.lastSeenAt / ipPrefix / geoCountry` の更新は 1 分に 1 回以下か | ホットテーブルの UPDATE 増加 | 自動: `verify-core-session-throttle.cjs` | M | — |
| AUTH-09 | IP は /24（IPv6 /48）に丸め、平文 IP を DB・ログに保存していないか | プライバシー | 自動: `verify-core-redact.cjs` | M | — |
| AUTH-10 | 共有検知（concurrent / geo_velocity / ip_churn）は段階対応（通知→再認証→停止）で、`false_positive` と `suppressUntil` の救済があるか | 誤検知で正当ユーザーを止めない | 手動: 運営が `SecurityEvent` 画面で救済操作を試す | M | — |
| AUTH-11 | step-up の本線がパスキー（WebAuthn、`userVerification: 'required'`）で、Google 経路は `sub` 一致までしか保証しないことを前提にしているか | Google は `prompt=login` / `max_age` を持たない | 自動: `verify-core-step-up-passkey.cjs`, `verify-core-step-up-google.cjs` | H | A-1 |
| AUTH-12 | 会社削除・ドメイン制限・サポート付与はパスキー必須で、Google 経路を許可していないか | 弱い経路で最重要操作を通さない | 自動: `verify-core-step-up-passkey.cjs` | H | A-1 |
| AUTH-13 | WebAuthn の challenge は 1 回限り（`nonceHash` unique）、`counter` 単調増加、origin / rpId を検証しているか | リプレイ・クローン認証器 | 自動: 同上 | H | A-1 |
| AUTH-14 | `ReauthChallenge.providerAuthTime` を検証条件に使っていないか（記録のみ） | Google の `auth_time` 更新挙動は要実機確認 | 自動: `verify-core-step-up-google.cjs` | M | A-1 |
| AUTH-15 | メンバーを removed にしたとき、その人の全 `Session` が即失効するか | 退職者の残存アクセス | 自動: `verify-core-access-suspended.cjs` | H | — |
| AUTH-16 | `User.sessionsInvalidBefore` の一括失効スクリプトが存在し、admin セッションも対象か | インシデント初動 | 手動: ステージングで `scripts/ops/revoke-all-sessions.ts` を実行 | M | — |
| AUTH-17 | admin JWT の秘密鍵に fallback が無く、`verifyToken` が `type==='admin'` を検査するか | 偽造 JWT | 自動: `verify-admin-secret-required.cjs` | H | D-1 |
| AUTH-18 | breakglass は使用後に自動で拒否され、有効時に Slack 通知があるか | 恒久的な裏口 | 手動: ステージングで 2 回ログインを試す | M | D-7 |
| AUTH-19 | 1 ユーザーが作れる会社数に上限（既定 3）があるか | 無料枠の増殖 | 自動: `verify-billing-seat-limit.cjs` | M | — |
| AUTH-20 | `Account.providerAccountId`（`sub`）が変わったユーザーは `SecurityEvent(auth.sub_changed)` になるか | 同メールの別人 | 自動: `verify-core-google-claims.cjs` | M | — |

## 3. AUTHZ 認可（既定拒否・ロール）

| ID | 確認内容 | なぜ | 確認方法 | 重大度 | 監査 |
|---|---|---|---|---|---|
| AUTHZ-01 | 全 route / page が 4 分類（public / cron / guest-shared / auth-required）のいずれかに機械的に分類され、スナップショットと一致するか | 手書き許可リストの取りこぼし | 自動: `verify-core-route-classes.cjs` | H | A-6 |
| AUTHZ-02 | ガード無しの route はすべてマニフェスト `routes.public` に**理由付き**で載っているか | 新設ルートの公開漏れ | 自動: `verify-core-route-classes.cjs`, `verify-service-manifest-public-reason.cjs` | H | A-6, M-3, M-4 |
| AUTHZ-03 | ゲスト共有ルート（`guestId` Cookie を読む 54 本）が `guest-shared` に分類され、「セッション or guest Cookie or `[token]`」で通るか | お試し導線の全滅防止 | 自動: 同上 | H | A-6 |
| AUTHZ-04 | メール計測（`/api/t/*`）、配信停止、`inbound-email`、`service-activity`、`operational-error`、`interviewx/public`、HR 招待確認が public に入っているか | 既定拒否で止まる実在ルート | 自動: スナップショットに含まれる | H | A-6 |
| AUTHZ-05 | middleware は Cookie / ヘッダの存在チェックのみで、DB を引いていないか | Edge で DB 不可 | 自動: `src/middleware.ts` に `prisma` import が無い（lint） | H | A-11 |
| AUTHZ-06 | `src/middleware.ts` が `src/` 配下にあり、ビルド後の `middleware-manifest.json` が空でないか | 直下に置くと一度も実行されない | 自動: `verify-core-middleware-manifest.cjs` | H | — |
| AUTHZ-07 | `auth-required` の全 route が `requireCompanyAccess` / `requireGuestToken` / `requireCron` / `requireAdmin` のいずれかを呼んでいるか | 既定拒否の実体 | 自動: `verify-core-route-guard.cjs` | H | — |
| AUTHZ-08 | `evaluateCompanyAccess`（セッション非依存）が存在し、`requireCompanyAccess` はその薄いラッパーか | Cron / 承認再開で裏口を作らない | 自動: `verify-core-access-sessionless.cjs` | H | A-8 |
| AUTHZ-09 | 実効ロール＝min(会社ロールの上限, サービスロール)で、会社 viewer は常に読み取りのみか | 二層ロールの矛盾 | 自動: `verify-core-access-role-ceiling.cjs` | H | — |
| AUTHZ-10 | サービスロール文字列は原文維持（HR 大文字、kintai `hr_admin`）で、既存 `hasMinRole` が壊れていないか | 既存 route の比較を壊さない | 自動: `verify-membership-known-roles.cjs`（既存） | M | — |
| AUTHZ-11 | `Company.status=suspended` / `CompanyMember.status in (suspended, removed)` / `CompanyServiceAccess.status=disabled` で 403 / 402 になるか | 停止の実効性 | 自動: `verify-core-access-suspended.cjs` | H | — |
| AUTHZ-12 | `User.role==='ADMIN'` のスーパーユーザー迂回が無く、運営の閲覧は `support` ロールの時限付与か | 既定拒否を運営にも適用 | 自動: grep `role === 'ADMIN'` が access 層に無い | M | — |
| AUTHZ-13 | 既存 `getXxxContext()` の export 名・戻り値の形が維持され、674 本の回帰テストが通るか | 一斉書き換えを避ける | 自動: `npm run test:security` | H | — |
| AUTHZ-14 | `getOrCreateOrganization` を 409 化せず、`ensureLegacyOrganizationForCompany` に置き換えているか | 新規ユーザーの行き止まり | 自動: `verify-core-legacy-org-backfill.cjs` | H | A-7 |
| AUTHZ-15 | `requireCron` は Bearer の `timingSafeEqual` のみ必須で、`x-vercel-cron-schedule` 等を必須にしていないか | 手動実行・ローカルで付かない | 自動: `verify-cron-timing-safe.cjs` | M | B-12 |
| AUTHZ-16 | `CRON_SECRET` を admin 代替として受理するコードが無いか | 漏洩時の権限直結 | 自動: `verify-cron-timing-safe.cjs`（guard の検査） | M | D-6 |
| AUTHZ-17 | ゲストトークン（mensetsu / aishodan / interviewx / 招待）はハッシュ保存・24 byte 以上・期限必須か | DB 漏洩時の URL 悪用 | 自動: `verify-core-invitation-token-hash.cjs` | M | D-4 |
| AUTHZ-18 | 招待受諾は `email` 一致・`email_verified`・`hd`・席上限を検査し、removed 行は復帰 upsert か | 乗っ取り・席の擦り抜け・P2002 | 自動: `verify-core-invitation-token-hash.cjs`, `verify-billing-seat-limit.cjs` | H | B-5, B-6 |

## 4. BIL 課金・席・クォータ

| ID | 確認内容 | なぜ | 確認方法 | 重大度 | 監査 |
|---|---|---|---|---|---|
| BIL-01 | Stripe webhook は単一ルートで、`StripeWebhookEvent` の claim で冪等化され、同一 event 2 回で `UsageLedger` grant が 1 行か | 二重付与・二重処理 | 自動: `verify-billing-company-webhook-idempotent.cjs` | H | — |
| BIL-02 | 会社 Checkout の metadata（`app`, `companyId`, `userId`, `planId`, `seats`）が固定され、`handleCheckoutCompleted` の冒頭で `companyId` 分岐が `userId` 検査より先か | 会社契約が無音で捨てられる | 自動: 同上 | H | B-9 |
| BIL-03 | `BillingAccount.stripeCustomerId` が unique でなく、会社の識別は `metadata.companyId` か | Customer 共有・分裂で移行が止まる | 自動: prisma validate（draft）、`verify-billing-company-webhook-idempotent.cjs` | H | A-2 |
| BIL-04 | `seats` は Stripe `quantity` を正本として webhook で同期し、DB を先に書いていないか | 席数と請求の不一致 | 自動: `verify-billing-seats-sync.cjs` | H | B-10 |
| BIL-05 | 席の削減で `active` メンバーが上回る場合は 409 か | 席数超過の黙認 | 自動: `verify-billing-seat-limit.cjs` | M | B-10 |
| BIL-06 | `current_period_*` が無い Subscription オブジェクト（basil）でも webhook が落ちないか | Stripe API 更新で NOT NULL 違反 | 自動: `verify-billing-seats-sync.cjs` | M | B-21 |
| BIL-07 | `UsageLedger` は reserve → consume / release の 3 段で、`idempotencyKey` に接尾辞規約があるか | 失敗時の残高戻し・二重計上 | 自動: `verify-billing-usage-reserve-release.cjs` | H | C-5 |
| BIL-08 | 無料枠は会社単位で数え、ユーザー・組織の作り直しでリセットされないか | 課金回避 | 自動: 同上＋`verify-billing-seat-limit.cjs`（会社数上限） | H | — |
| BIL-09 | `period` は JST で確定しているか | 月末境界のズレ | 自動: `verify-billing-usage-reserve-release.cjs` | M | — |
| BIL-10 | meter はマニフェスト `usage.meters` に宣言済みのものだけ書けるか | 野良 meter | 自動: `verify-service-manifest-meters.cjs` | M | M-15 |
| BIL-11 | `HrOrganization.plan` を読むコードが Phase4 前に 0 になっているか | HR の権利判定の正本消失 | 自動: `verify-billing-no-legacy-plan-readers.cjs` | H | B-11 |
| BIL-12 | 統一プランの Price を新設し、旧 `banner-pro` Price は price-map で読み替えているか | 価格体系の併存 | 手動: Stripe ダッシュボードと `price-map.ts` を突合 | M | — |
| BIL-13 | 手動付与（`BILLING_MANUAL_GRANT_EMAILS`）が `CompanyServiceAccess.planOverride` に移り、理由と `AuditLog` があるか | 環境変数運用の廃止 | 手動: env に当該変数が無いことを確認 | L | — |
| BIL-14 | `invoice.payment_failed` → `past_due` で席を維持し、`unpaid/canceled` でサービスを suspended にするか | 支払い失敗の扱い | 自動: `verify-billing-seats-sync.cjs` | M | B-10 |
| BIL-15 | Checkout の二重起動防止が会社キーで動くか | 二重契約 | 自動: 既存 `verify-subscription-*` の会社版 | M | — |

## 5. MIG データ移行・ロールバック

| ID | 確認内容 | なぜ | 確認方法 | 重大度 | 監査 |
|---|---|---|---|---|---|
| MIG-01 | 本番 DB のドライラン（組織数・空組織・FK 孤児・slug 衝突・同 owner 複数組織・`HrOrganization.stripe*` 非 null）を Phase0 で取り、README §13 に数値を入れたか | 推測での移行 | 手動: リードがドライラン結果を確認 | H | A-2, B-4 |
| MIG-02 | ドライラン・移行スクリプトは Prisma 経由で、生 SQL の表名を手書きしていないか | 表名の誤り | 手動: コードレビュー | M | B-23 |
| MIG-03 | FK なし Member の孤児（`userId` が存在しない）は隔離（INACTIVE）し、削除していないか | 復元可能性 | 自動: `scripts/ops/tenant-dryrun.ts` の孤児 0 件 | H | — |
| MIG-04 | `userId IS NULL` の ACTIVE 行を席に数えていないか | 課金の狂い | 自動: 同上 | M | D-8 |
| MIG-05 | 自動名寄せは 3 条件（owner 同一・名前正規化一致・メンバー包含）のときだけで、残りは人が決めるか | 誤名寄せ＝他社データ混入 | 手動: 未対応リストをリードが確認 | H | — |
| MIG-06 | 二重書き込みは**両方向**（新→旧も）か | 新規会社で旧 route が壊れる | 自動: `verify-core-legacy-org-backfill.cjs` | H | A-7 |
| MIG-07 | `core.dual_write` OFF→ON の前に `tenant-reconcile.ts` を実行する手順が書かれ、実行されたか | shadow 差分が二度と 0 にならない | 手動: 運用手順書・実行ログ | M | B-24 |
| MIG-08 | shadow mode の差分 0 件が 7 日続いてから `core.unified_access` を ON にしているか | 新旧判定のズレ | 手動: Slack の差分レポート | H | — |
| MIG-09 | middleware の report-only を本番トラフィックで 2 週間以上取り、誤分類 0 を確認したか | 計測ピクセル・配信停止の全滅 | 手動: ログ集計 | H | A-6 |
| MIG-10 | 各フェーズに「完了条件」「戻し方」「フラグ名」があり、フラグ OFF で即時に旧経路へ戻るか | ロールバック不能 | 手動: ステージングでフラグ OFF を試す | H | — |
| MIG-11 | Phase4 の削除前に `pg_dump` を取り、**別 DB へ復元してビルドとスモークが通るリハーサル**をしたか | 復元できないバックアップ | 手動: リハーサル記録 | H | — |
| MIG-12 | Phase4 は Phase3 安定後 60 日以上空けているか | 月次課金 2 サイクル | 手動: 日付 | M | — |
| MIG-13 | 会社情報の衝突解決（優先順・和集合）と `fieldSources` の出典記録があるか | 後から説明できない上書き | 自動: `verify-core-profile-merge.cjs` | M | — |
| MIG-14 | 退役サービスのデータを移行対象から外し、凍結しているか | 不要な席・meter 行 | 自動: `verify-service-manifest-ids.cjs`（active のみ） | L | — |

## 6. SCH DB スキーマ（FK・onDelete・unique・index・NULL）

| ID | 確認内容 | なぜ | 確認方法 | 重大度 | 監査 |
|---|---|---|---|---|---|
| SCH-01 | `schema-draft.prisma` を既存 schema と結合して `prisma validate` が通るか | 書いてある通りに移植できない | 自動: `verify-core-schema-draft.cjs` | H | A-3 |
| SCH-02 | 既存モデルへの追加列は merge-into の model 断片で書かれ、コメントだけになっていないか | 移植忘れ | 自動: 同上（断片 0 件なら失敗） | M | A-3 |
| SCH-03 | 課金・台帳・監査・会社所属・エージェント履歴の `onDelete` が Restrict（または FK なし）で、Cascade になっていないか | 会社削除で正本が消える | 自動: `verify-core-schema-ondelete.cjs`（draft を解析） | H | A-5, B-7 |
| SCH-04 | `Company` に物理削除経路が無く、`deletedAt` のみか | 同上 | 自動: 同上＋API に DELETE 物理削除が無い | H | A-5, C-3 |
| SCH-05 | NULL を含む複合 unique が無いか（`FeatureFlag` は `scope='*'` 番兵、`CompanyInvitation` は `activeKey`） | Postgres の NULL は一意にならない | 自動: `verify-core-feature-flag-scope.cjs`, `verify-core-invitation-token-hash.cjs` | H | A-4, B-6, D-8 |
| SCH-06 | 共通層の `userId` 参照（`CompanyMember`, `AgentRun.requestedById`, `ApprovalRequest.requestedToId`, `Notification`, `UsageLedger`）に FK があるか | 存在しない宛先への承認 | 自動: prisma validate＋`verify-core-schema-fk.cjs` | H | B-8 |
| SCH-07 | `CompanyMember @@unique([companyId, userId])` と removed 行の復帰 upsert が両立しているか | 再招待の P2002 | 自動: `verify-core-invitation-token-hash.cjs` | M | B-5 |
| SCH-08 | `ToolCall` の unique が `[stepId, attempt]` で、`idempotencyKey` に attempt が含まれないか | 再試行で二重課金 | 自動: `verify-agent-idempotent-tool-call.cjs` | H | A-9 |
| SCH-09 | 非正規化した `companyId`（`AgentStep` / `ToolCall` / `ApprovalRequest` / `AgentArtifact`）が親と一致するか | 整合性 | 自動: `verify-agent-company-consistency.cjs` | M | C-4 |
| SCH-10 | `currentPeriodStart/End`、`KnowledgeSource.rawText` など「無い状態」があり得る列が nullable か | NOT NULL 違反 | 自動: prisma validate＋レビュー | M | B-21, B-22 |
| SCH-11 | raw `UPDATE ... RETURNING` で更新する列に `@updatedAt` を使っていないか | 更新されない | 手動: レビュー | L | B-22 |
| SCH-12 | ホットテーブル（`Session`, `User`, `AuditLog`）の index は `CREATE INDEX CONCURRENTLY` で先行作成してから `db push` しているか | ロックで全ユーザーが止まる | 手動: DB 反映手順書のチェック欄 | H | B-18 |
| SCH-13 | 新テーブルは `@@map("<prefix>_...")` で、Prisma enum を使っていないか | 既存流儀との混在 | 自動: `verify-core-schema-draft.cjs` の追加検査 | L | — |
| SCH-14 | 平文トークン列（`HrInvitation.token`, `*Member.inviteToken`, `MensetsuSession.token`, `AishodanRoom.token`）に `tokenHash` が併設され、Phase4 で平文が消えているか | DB 漏洩時の URL 悪用 | 自動: `verify-core-invitation-token-hash.cjs` | M | D-4 |
| SCH-15 | 保持期間のある列（会話ログ・逐語・PII）に purge cron があり、`AuditLog` は purge 対象外か | 保持ポリシー | 自動: `verify-service-manifest-pii.cjs` | M | M-13 |
| SCH-16 | `AuditLog / SecurityEvent / LlmCallLog.companyId` が FK なし文字列か | 会社 purge 後の記録保持 | 自動: `verify-core-schema-ondelete.cjs` | M | A-5 |

## 7. AGT エージェント（承認・冪等・コスト上限・プロンプトインジェクション・停止）

| ID | 確認内容 | なぜ | 確認方法 | 重大度 | 監査 |
|---|---|---|---|---|---|
| AGT-01 | 全ツールに `reversibility`（read / reversible / irreversible）と `costClass`（none / low / high）と `estimatedPaidCalls` があるか | 承認要否の根拠 | 自動: `verify-service-manifest-tools.cjs` | H | A-10, M-7 |
| AGT-02 | `irreversible` と `costClass=high` は承認なしで実行されないか（下書きでも） | 2026-08-24 の 173 回事故の再発防止 | 自動: `verify-agent-approval-matrix.cjs` | H | A-10, M-10 |
| AGT-03 | 画像・動画・音声生成を 1 回でも含むツールは `costClass=high` か | 画像 1 枚でも承認 | 自動: 同上 | H | A-10 |
| AGT-04 | 承認画面に見込み回数・モデル・単価・合計見込み額（`ApprovalRequest.estimate`）が出るか | 従量課金の事前承認 | 自動: 同上＋手動: 承認画面を見る | H | A-10 |
| AGT-05 | 承認は `frozenInput` に対して行われ、承認後に入力を変えられないか | 承認後の差し替え | 自動: `verify-agent-approval-matrix.cjs` | H | — |
| AGT-06 | 承認文面はレジストリのテンプレートで、LLM 生成文を使っていないか | 誘導 | 自動: 同上 | M | — |
| AGT-07 | 外部影響ツールの冪等キーは `<runId>:<stepId>` で、再試行でも下流に同じキーを渡すか | 二重課金・二重作成 | 自動: `verify-agent-idempotent-tool-call.cjs` | H | A-9, M-8 |
| AGT-08 | 各ステップ実行直前に `evaluateCompanyAccess({userId: requestedById})` で再評価し、承認者が上位でも依頼者の権限で実行するか | 権限の貸与 | 自動: `verify-agent-actor-ceiling.cjs` | H | A-8 |
| AGT-09 | 依頼者のロールで使えない sensitive ツールが計画段階から除外されるか | 機微データの漏洩 | 自動: 同上 | H | — |
| AGT-10 | 外部由来テキスト（ツール結果、`fieldSources.origin='scraped'` の会社情報、`KnowledgeSource.isUntrusted`）が `<untrusted>` で包まれるか | プロンプトインジェクション | 自動: `verify-agent-untrusted-wrapping.cjs` | H | B-15 |
| AGT-11 | 計画確定後に追加できる step は `read` ツールのみか | 結果を読んで external を追加させない | 自動: 同上 | H | — |
| AGT-12 | ツール入力は zod `.strict()` で、URL は `assertUrlSafe`、id は cuid＋会社所属を検査するか | 入力経由の攻撃 | 自動: `verify-agent-tool-input-strict.cjs` | H | M-9 |
| AGT-13 | run ごとに `creditBudget` / `maxToolCalls` / `maxLlmCalls` / `wallClockLimitSec` があり、超過で `failed(budget)` になるか | コスト暴走 | 自動: `verify-agent-budget.cjs` | H | C-1 |
| AGT-14 | `estimatedPaidCalls` と `LlmCallLog` の実測が 2 倍以上乖離したら `SecurityEvent` になるか | 見積りの形骸化 | 自動: 同上 | M | B-16 |
| AGT-15 | ツールが呼ぶ lib の LLM が gateway 経由で、未移行ツールは `costClass=high` 扱いか | 計測ゼロでの運用 | 自動: `verify-service-manifest-paid-api.cjs` | H | B-16, M-11 |
| AGT-16 | advance は入口で 240s の `AbortSignal` を作り、LLM / ツールのタイムアウトは残り時間から派生するか | 関数ごと死んでリースが残る | 自動: `verify-agent-deadline.cjs` | H | B-14 |
| AGT-17 | 二重 advance が 409 になり、期限切れリースを Cron が回収し、`maxAdvanceAttempts` 超過で failed になるか | 二重実行・無限再開 | 自動: `verify-agent-run-lease.cjs` | H | C-2 |
| AGT-18 | `agent.kill_switch`（全体）/ `agent.enabled`（会社）/ `agent.tools.<key>.enabled` が advance 冒頭で効くか | 緊急停止 | 自動: `verify-agent-kill-switch.cjs` | H | — |
| AGT-19 | 全 ToolCall が `AuditLog(actor='agent:<runId>', onBehalfOf)` に残るか | 説明責任 | 自動: `verify-core-audit-append-only.cjs` | H | — |
| AGT-20 | hr / kintai / mensetsu のツール出力が集計値・氏名レベルに限定され、評価本文・給与・逐語・候補者メールを返さないか | 個人情報 | 自動: 出力 zod のスナップショット `verify-agent-sensitive-output.cjs` | H | — |
| AGT-21 | 成果物は各サービスのテーブルに作り、`AgentArtifact` はリンクのみで、retention purge が `state='deleted'` を更新するか | 二重保存・404 | 自動: `verify-agent-artifact-purge.cjs` | M | — |
| AGT-22 | 会話ログの purge cron（`agent-retention`）が会社の `retentionDays` に従うか | 保持ポリシー | 自動: 同上 | M | — |
| AGT-23 | エージェントが `guestId` 系ルートやツールを一切呼ばないか | 会社文脈の無い実行 | 自動: レジストリに guest 系が無い | M | — |
| AGT-24 | 運営 Slack の `notifyServiceActivity` がツール実行時に抑止され、顧客向け Slack は会社設定の webhook（`hooks.slack.com` のみ）か | 通知の混線・SSRF | 自動: `verify-agent-notify-slack.cjs` | M | — |
| AGT-25 | プロバイダ全断時に run が `paused` → 最大 3 回再開 → `failed(llm)` と通知になるか | 無限リトライ・無音失敗 | 自動: `verify-agent-deadline.cjs` | M | — |

## 8. EXT 外部 API・LLM（従量課金の事前承認・キーの扱い）

| ID | 確認内容 | なぜ | 確認方法 | 重大度 | 監査 |
|---|---|---|---|---|---|
| EXT-01 | 有料 API（`externalApis[].paid=true`）は gateway 経由で、`LlmCallLog` が失敗分も含めて 1 行残るか | コスト計測 | 自動: `verify-service-manifest-paid-api.cjs` | H | B-16, M-11 |
| EXT-02 | 画像・動画・音声の呼び出しは `size / quality / n` を必須引数の型にし、未指定で呼べないか | `auto` 任せで単価 4 倍 | 自動: tsc（型）＋`verify-llm-gateway-image-params.cjs` | H | — |
| EXT-03 | API キーは環境変数のみで、URL クエリに載せていないか（`?key=`） | ログ・プロキシ経由の漏洩 | 自動: grep `generativelanguage.googleapis.com.*\?key=` が 0 | H | D-3 |
| EXT-04 | サービス／用途ごとにキーを分け（`keyLabel`）、使用量ダッシュボードで分離できるか | 漏洩時の影響範囲・ローテーション | 手動: プロバイダのダッシュボード | M | — |
| EXT-05 | 429 / 5xx のリトライは指数バックオフ最大 3 回で、残り時間が安全余裕を切ったらリトライしないか | タイムアウト連鎖 | 自動: `verify-agent-deadline.cjs` | M | B-14 |
| EXT-06 | 4xx（入力不正・安全性ブロック）をリトライしていないか | 無駄な課金 | 自動: `verify-llm-gateway-retry.cjs` | M | — |
| EXT-07 | プロバイダ・フォールバック時もツール定義（JSON Schema）を同じ内容で渡しているか | フォールバック先での誤動作 | 自動: 同上 | M | — |
| EXT-08 | 外部 URL を読む機能はすべて `safe-fetch`（`assertUrlSafe`、DNS ピン留め、リダイレクト再検証）経由か | SSRF | 自動: `verify-service-manifest-ssrf-test.cjs`＋各 `verify-<svc>-private-address-rejection.cjs` | H | M-12 |
| EXT-09 | Cron / Webhook / 外部アプリの受け口は共有秘密を `timingSafeEqual` で比較しているか | タイミング攻撃・比較ミス | 自動: `verify-cron-timing-safe.cjs` | M | D-6 |
| EXT-10 | 日次の支出監視（`service-operations-cost.ts`）に `agent` と各 `keyLabel` の支出が載り、7 日平均比のスパイクで通知されるか | 暴走の早期検知 | 手動: Slack の支出レポート | M | — |
| EXT-11 | 鍵のローテーション手順（LLM・`NEXTAUTH_SECRET`・`ADMIN_JWT_SECRET`・`DATA_ENCRYPTION_KEY`・`CRON_SECRET`・Stripe webhook secret）が文書化され、年 1 回以上実施されているか | インシデント対応 | 手動: 運用記録 | M | — |
| EXT-12 | `zod-to-json-schema` / `file-type` / `@simplewebauthn/*` など新規依存は版固定で、security-regression の依存床に追加されているか | 依存の床 | 自動: 既存の依存床検査 | L | — |

## 9. PII 個人情報・機微データ（暗号化・保持期間・閲覧監査）

| ID | 確認内容 | なぜ | 確認方法 | 重大度 | 監査 |
|---|---|---|---|---|---|
| PII-01 | マニフェスト `pii.columns` に個人情報列が全て列挙され、`retentionDays` と `encrypted` が決まっているか | 保持期間の無い個人情報 | 自動: `verify-service-manifest-pii.cjs` | H | M-13 |
| PII-02 | `pii.columns` があるサービスに `purgeCron` があり、実際に動いているか（`cron/*-retention`） | 保持期間の形骸化 | 自動: 同上＋手動: Cron ログ | H | M-13 |
| PII-03 | `encrypted=true` の列はアプリ層 AES-256-GCM（`keyId` 前置）で、検索が要る列は HMAC 盲検索列を併設しているか | 列単位暗号化 | 自動: `verify-service-manifest-pii.cjs`（M-14）＋`verify-core-encryption.cjs` | H | — |
| PII-04 | hr / kintai / mensetsu の詳細 GET が `AuditLog(sensitive=true)` を必ず書くか | 閲覧の監査 | 自動: `verify-core-audit-sensitive-view.cjs` | H | — |
| PII-05 | ログ・`ToolCall.output`・`SecurityEvent.evidence` が `redact()` を通り、メール・電話・住所・トークン・Authorization・平文 IP を含まないか | ログ経由の漏洩 | 自動: `verify-core-redact.cjs` | H | — |
| PII-06 | `KnowledgeSource` に HR / 勤怠 / 面接の生テキストを取り込んでいないか | ナレッジ経由の横流し | 自動: `allowedServices` と `originService` の検査 | H | — |
| PII-07 | `AuditLog` の UA は hash、IP は /24 帯で、3 年保持に耐える粒度か | 監査ログ自体が個人情報化 | 自動: `verify-core-redact.cjs` | M | — |
| PII-08 | 会社の `agentSettings.allowSensitive=false` で sensitive ツールが除外されるか | 会社ごとのオプトアウト | 自動: `verify-agent-actor-ceiling.cjs` | M | — |
| PII-09 | エクスポート（CSV / PDF 一括）は step-up と `AuditLog(action=export)` を伴うか | 大量持ち出し | 自動: `verify-core-step-up-passkey.cjs`（purpose=export） | H | — |
| PII-10 | 会社の論理削除後、PII は purge されるが `AuditLog` は匿名化して残るか | 削除要求と説明責任の両立 | 手動: purge バッチのレビュー | M | A-5 |
| PII-11 | ゲスト（応募者・見込み客）の `guestEmail / candidateEmail` はツール出力でマスクされるか | 第三者の個人情報 | 自動: `verify-agent-sensitive-output.cjs` | H | — |

## 10. AUD 監査ログ

| ID | 確認内容 | なぜ | 確認方法 | 重大度 | 監査 |
|---|---|---|---|---|---|
| AUD-01 | `core_audit_logs` に対する `UPDATE / DELETE` が DB ロールで禁止されているか | 追記専用 | 自動: `verify-core-audit-append-only.cjs`（権限エラーを期待）＋手動: DBA | H | — |
| AUD-02 | 連鎖ハッシュは日次バッチで後埋めし、同期 `FOR UPDATE` を取っていないか | `connection_limit=3` の枯渇 | 自動: `verify-core-audit-append-only.cjs` | H | B-19 |
| AUD-03 | `audit-verify` cron が不一致を `SecurityEvent(critical)` にするか | 改ざん検知 | 自動: 同上 | M | — |
| AUD-04 | `action` 名はマニフェスト `audit.events` に宣言済みのものだけか | 野良イベント | 自動: `verify-service-manifest-audit.cjs` | M | M-16 |
| AUD-05 | 会社・メンバー・招待・課金・会社情報の変更、送信・発行・エクスポート、機微閲覧、ToolCall、承認、セッション失効、admin 操作、webhook 適用が全て記録対象か | 網羅性 | 手動: 対象一覧とマニフェストの突合 | H | — |
| AUD-06 | `actor` に `user: / agent: / cron: / admin: / stripe: / guest:` の接頭辞があり、`onBehalfOf` でエージェントの依頼者が分かるか | 誰がやったか | 自動: `verify-core-audit-append-only.cjs` | M | — |
| AUD-07 | `AuditLog.companyId` は FK なしで、会社 purge 後も行が残るか | 記録の保持 | 自動: `verify-core-schema-ondelete.cjs` | H | A-5 |
| AUD-08 | `HrAuditLog` は Phase4 で `AuditLog` へ移送され、それまで二重に書かれているか | 既存監査の継続 | 手動: Phase4 手順 | M | — |
| AUD-09 | 会社 admin が自社の `AuditLog` を期間・action・actor で検索でき、sensitive は owner のみか | 利用者側の監査 | 手動: 画面確認 | M | — |

## 11. IO 入力・通信（CSRF・SSRF・アップロード・レート制限・CSP）

| ID | 確認内容 | なぜ | 確認方法 | 重大度 | 監査 |
|---|---|---|---|---|---|
| IO-01 | 状態変更 API は `Origin` / `Sec-Fetch-Site` を検査し、cross-site を 403 にするか | CSRF | 自動: `verify-core-csrf-origin.cjs` | H | B-20 |
| IO-02 | カスタムヘッダ（`x-requested-with`）を必須にしていないか（report-only） | 既存 fetch の全滅 | 自動: 同上 | H | B-20 |
| IO-03 | Edge 段のレート制限は Vercel WAF（外部依存）で、Postgres を Edge から引いていないか | 実装不能 | 手動: WAF ルール確認 | M | A-11 |
| IO-04 | ルート段のレート制限（user / company / ip）が `RateLimitBucket` の原子的 UPDATE で動き、429 を返すか | 総当たり | 自動: `verify-core-rate-limit.cjs` | M | — |
| IO-05 | ログイン・招待受諾・ゲスト API・step-up に厳しめの制限（10/分）があるか | トークン総当たり | 自動: 同上 | M | — |
| IO-06 | アップロードはマジックバイトで MIME 判定し、画像は `sharp` で再エンコード、SVG 禁止、10MB 上限か | 悪性ファイル | 自動: `verify-core-upload.cjs` | H | — |
| IO-07 | 非公開バケット＋署名 URL で配信し、公開バケットに個人情報が無いか | 直リンク | 手動: バケット設定 | H | — |
| IO-08 | URL を読む全機能が `safe-fetch` 経由で、Slack webhook は `hooks.slack.com` のみか | SSRF | 自動: `verify-service-manifest-ssrf-test.cjs` | H | M-12 |
| IO-09 | CSP 本体（nonce 方式）が report-only 2 週間を経て強制され、`frame-ancestors` だけになっていないか | XSS の被害限定 | 手動: レスポンスヘッダ確認 | M | — |
| IO-10 | `Permissions-Policy` で camera / microphone が面接・商談ページ以外で無効か | 不要な権限 | 手動: ヘッダ確認 | L | — |
| IO-11 | 全 API body が zod `.strict()` で、未知キーを拒否するか | 入力汚染 | 自動: `verify-agent-tool-input-strict.cjs`＋各 route の `*-input.ts` | M | — |
| IO-12 | エラーレスポンスに内部エラー文字列・スタック・SQL が出ないか | 情報漏洩 | 自動: 既存 `assert-hr-private-error-responses.cjs` の流儀を core に | M | — |

## 12. OPS 運用（手動 db push の順序・Cron・maxDuration・障害対応）

| ID | 確認内容 | なぜ | 確認方法 | 重大度 | 監査 |
|---|---|---|---|---|---|
| OPS-01 | schema 変更は「`doya-db-push` で本番反映 → デプロイ」の順で、逆になっていないか | P2022 で全 500 | 手動: デプロイ前チェック欄 | H | — |
| OPS-02 | 起動時ヘルスチェックが新テーブルの存在を確認し、欠落を早期検出するか | 反映漏れ | 自動: `/api/health` の応答 | M | — |
| OPS-03 | ホットテーブルの index は `CONCURRENTLY` で先行作成しているか | ロック | 手動: 手順書 | H | B-18 |
| OPS-04 | Cron は 100 本/プロジェクト以内で、`*/15` 5 本・`*/5` 4 本の統合を検討したか | 上限と重複 | 手動: `vercel.json` | L | B-13 |
| OPS-05 | 重複起動し得る Cron（Vercel は best effort・重複あり）が DB リースで相互排他され、冪等か | 二重処理 | 自動: `verify-agent-run-lease.cjs` | H | — |
| OPS-06 | 長時間処理は 240s で自発的に返し、`maxDuration=300` の関数を使い切らないか | リース残り | 自動: `verify-agent-deadline.cjs` | H | B-14 |
| OPS-07 | SSE ルートにも `maxDuration` があり、再接続前提か | 切断 | 手動: コードレビュー | L | C-14 |
| OPS-08 | インシデント手順（全セッション失効・会社停止・鍵ローテーション・インジェクション疑い・漏洩疑い）が文書化され、ステージングで演習済みか | 初動の遅れ | 手動: 演習記録 | H | — |
| OPS-09 | `FeatureFlag` は `scope='*'` 1 行で全体既定を表し、重複行が作れないか | kill switch が効かない | 自動: `verify-core-feature-flag-scope.cjs` | H | A-4 |
| OPS-10 | フラグ切替は admin 画面＋`AuditLog` で、再デプロイ無しに戻せるか | ロールバック速度 | 手動: ステージング | M | — |
| OPS-11 | `SystemSetting` を新規のロック・台帳・キューに使っていないか | 肥大化・集計不能 | 自動: grep `systemSetting.upsert` が core/agent に無い | M | — |
| OPS-12 | breakglass・手動付与・サポートアクセスなど運営の特例が全て `AuditLog` と通知を伴うか | 内部不正 | 手動: 運用手順 | M | D-7 |
| OPS-13 | 新規 Cron（`agent-runs`, `security-scan`, `audit-verify`, `agent-retention`）が `requireCron` で守られ、`vercel.json` に登録されているか | 無防備な Cron | 自動: `verify-core-route-classes.cjs`（cron 分類） | H | — |
| OPS-14 | Phase ごとの「完了条件」をリードが確認して昇格し、記録が残っているか | 勝手な昇格 | 手動: 昇格記録 | M | — |
| OPS-15 | 追跡済みの重複コピー（`doya-ai/src/app/banner/dashboard/page.tsx`）が lint / grep 集計から除外または削除されているか | 集計の汚染 | 手動: Phase0 の削除候補報告 | L | C-13 |

## 13. UI UI・アクセシビリティ（日本語・絵文字禁止・スマホ幅）

| ID | 確認内容 | なぜ | 確認方法 | 重大度 | 監査 |
|---|---|---|---|---|---|
| UI-01 | ユーザー向け UI テキスト・通知・承認画面・メールが日本語の丁寧な敬語か | 方針 | 手動: 画面・文面レビュー | M | — |
| UI-02 | エンドユーザー向け文面に絵文字が無いか | 方針（AI っぽさの主因） | 自動: `verify-service-manifest-ui.cjs`（M-20、絵文字コードポイント） | M | — |
| UI-03 | UI アイコンが `icons.tsx` の SVG か自作ドット絵で、絵文字アイコンが無いか | 同上 | 自動: 同上 | M | — |
| UI-04 | 375px 幅で横スクロールが出ず、承認・会社切替・通知がスマホで完結するか | 経営者はスマホで承認する | 手動: 実機（iPhone SE 幅）で確認 | M | — |
| UI-05 | エラー文面が「何が起きたか・次に何をするか」で、内部文字列を出さないか | 利用者の自己解決 | 手動: 主要エラーの文面一覧 | L | — |
| UI-06 | 会社切替 UI がヘッダに常設され、現在の会社名が常に見えるか | 別会社への誤操作 | 手動: 画面確認 | M | B-25 |
| UI-07 | 承認画面に「何を・誰に・いくらで・取り消せるか」と見込み額が表示されるか | 従量課金の事前承認 | 手動: 承認画面 | H | A-10 |
| UI-08 | 失効された端末に「別の端末でログインされたため終了しました」が表示され、`/me/sessions` で自分の端末を管理できるか | 誤ロックアウト時の自己救済 | 手動: 2 端末でログイン | M | B-17 |

---

## 監査指摘との対応表

| 監査 | 再発防止するチェック項目 |
|---|---|
| A-1 | AUTH-11, AUTH-12, AUTH-13, AUTH-14 |
| A-2 | BIL-03, MIG-01 |
| A-3 | SCH-01, SCH-02 |
| A-4 | SCH-05, OPS-09 |
| A-5 | SCH-03, SCH-04, SCH-16, AUD-07, PII-10 |
| A-6 | AUTHZ-01, AUTHZ-02, AUTHZ-03, AUTHZ-04, TEN-06, MIG-09 |
| A-7 | TEN-10, AUTHZ-14, MIG-06 |
| A-8 | AUTHZ-08, AGT-08 |
| A-9 | SCH-08, AGT-07 |
| A-10 | AGT-01, AGT-02, AGT-03, AGT-04, UI-07 |
| A-11 | AUTHZ-05, IO-03 |
| B-1 | AUTH-04 |
| B-2 | TEN-02, TEN-03, TEN-04 |
| B-3 | TEN-01, TEN-05, TEN-08 |
| B-4 | TEN-11, MIG-01 |
| B-5 | AUTHZ-18, SCH-07 |
| B-6 | AUTHZ-18, SCH-05 |
| B-7 | SCH-03 |
| B-8 | SCH-06 |
| B-9 | BIL-02 |
| B-10 | BIL-04, BIL-05, BIL-14 |
| B-11 | BIL-11 |
| B-12 | AUTHZ-15 |
| B-13 | OPS-04 |
| B-14 | AGT-16, EXT-05, OPS-06 |
| B-15 | AGT-10 |
| B-16 | AGT-14, AGT-15, EXT-01 |
| B-17 | AUTH-05, AUTH-06, UI-08 |
| B-18 | SCH-12, OPS-03 |
| B-19 | AUD-02 |
| B-20 | IO-01, IO-02 |
| B-21 | BIL-06, SCH-10 |
| B-22 | SCH-10, SCH-11 |
| B-23 | MIG-02 |
| B-24 | MIG-07 |
| B-25 | TEN-09, UI-06 |
| C-1 | AGT-13 |
| C-2 | AGT-17 |
| C-3 | SCH-04 |
| C-4 | SCH-09 |
| C-5 | BIL-07 |
| C-6 | AGT-24（ツール既定値はレジストリ側。README §8.2） |
| C-7 | AGT-01（`mensetsu.createInterview` の区分根拠。README §8.2） |
| C-8 | AUTHZ-08（lib 切り出し。README §6.4 手順 4） |
| C-9 | EXT-12, IO-06 |
| C-10 | OPS-06（`waitUntil` に頼らない） |
| C-11 | EXT-09 |
| C-12 | TEN-02 |
| C-13 | OPS-15 |
| C-14 | OPS-07 |
| C-15 | AUTHZ-02（LP はマニフェスト `landing` で宣言） |
| D-1 | AUTH-17 |
| D-2 | AUTHZ-02（公開ルートの理由。410 化は README §15） |
| D-3 | EXT-03 |
| D-4 | AUTHZ-17, SCH-14 |
| D-5 | AUTH-02 |
| D-6 | AUTHZ-16, EXT-09 |
| D-7 | AUTH-18, OPS-12 |
| D-8 | MIG-04, SCH-05 |

項目数: TEN 13 / AUTH 20 / AUTHZ 18 / BIL 15 / MIG 14 / SCH 16 / AGT 25 / EXT 12 / PII 11 / AUD 9 / IO 12 / OPS 15 / UI 8 ＝ **188 項目**。監査 A〜D の 59 指摘すべてに対応項目あり（漏れ 0）。
