# 徹底チェック項目（共通テナント・課金・経営エージェント）

対象: [`README.md`](./README.md)（設計書）と、その上に載る全サービス。監査 [`AUDIT-2026-10-17.md`](./AUDIT-2026-10-17.md) の A〜D 全指摘が、いずれかの項目で再発防止されている（末尾の対応表）。

## 使い方

| 場面 | 必ず通す章 | 任意 |
|---|---|---|
| **設計を変えたとき**（README / schema-draft / マニフェスト型の変更） | **DOC**（必ず最初と最後）、SCH、TEN、AUTHZ、MIG、AGT（エージェントに触るとき）、AUD | 残り |
| **新サービスを追加するとき**（§16 のマニフェスト 1 件） | TEN、AUTHZ、BIL、SCH、EXT、PII、AUD、IO、UI。ツールを出すなら AGT | AUTH、MIG、OPS |
| **本番に出す前**（各フェーズのデプロイ、Phase 昇格） | 全章。特に RUN、MIG、BIL | — |

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
| TEN-12 | RLS は機微テーブル（マニフェスト `pii`）限定で、`withTenantTx` が対話型 tx の冒頭で `set_config('app.company_id', …, true)` を張り、`SET` セッション変数を使っていないか | pgbouncer transaction pooling では `SET` は漏れる | 自動: `verify-core-rls.cjs`（ステージング DB）＋手動: DBA が Phase4 の SQL をレビュー | M | 方針転換（二重の守り） |
| TEN-13 | サーバ内部用ヘッダ（`x-tenant-id` 等）を middleware が削除しているか | ヘッダ偽装による内部信頼の防止 | 自動: `verify-core-route-classes.cjs` 内の middleware ユニット | M | — |
| TEN-14 | `walkData` が `Prisma.dmmf` でデータを再帰走査し（upsert では `create` と `update` の両方、対象は全モデル）、NestedInput の閉じた許可リスト（to-many 11 / to-one 7 / create 側 4・3）の各キーに data 検査（テナント列の強制・書き換え禁止。ネストの `update.data / updateMany.data / upsert.update` を含む）と refs 検査（`connect / set / disconnect / delete / deleteMany / update.where / updateMany.where / upsert.where / connectOrCreate.where`）を割り当てているか | Prisma 公式: query 拡張はネスト操作に発火しない | 自動: `verify-core-access-cross-tenant.cjs`（ネスト connect で他社 id → 拒否） | H | SEC-01 |
| TEN-15 | `update / updateMany / upsert.update` の `data` にテナント列が含まれていたら throw しているか（テナント移動の禁止） | 子行の他社への移動 | 自動: 同上（`data.organizationId` 書き換え → 拒否） | H | SEC-01 |
| TEN-16 | 複合 unique セレクタ（`userId_serviceId` 等）を DMMF で `{a, b}` に展開してから `findFirst` に渡しているか | `WhereInput` に複合セレクタは無く実行時エラー | 自動: 同上（複合 unique の `findUnique` ケース） | H | SEC-02 |
| TEN-17 | raw SQL は `tenantSql(ctx)` フラグメント経由で、lint は文字列一致ではなく `tenantSql(` の有無を見るか | `"companyId" = ${anything}` で擦り抜ける | 自動: `verify-core-raw-sql-tenant.cjs` | M | SEC-04 |
| TEN-18 | `include / select` で親側 relation を辿る読みに、テナント列の `where` または post-filter を適用しているか | 他社の親レコードが返る | 自動: 同上（include 経由） | M | SEC-01 |
| TEN-19 | `upsert` は `owned()` ヘルパーで「findFirst → あれば update、無ければ create（テナント列強制）」に分解され、create 経路が所属確認で失敗しないか | upsert 全滅→直 import への逃げ | 自動: `verify-core-access-cross-tenant.cjs`（upsert の両経路） | H | FIN-02 |
| TEN-20 | query 拡張のコールバックが基底クライアントで追加クエリを発行せず、`owned(client, ctx)` 自身が `walkData` → 所属確認 → モジュール内 `ownedScope`（AsyncLocalStorage、export しない）マーカー付きで元操作を呼び、拡張はマーカー無しの update/delete/upsert/findUnique を throw するか | 分担不成立（全 update 失敗 or tx 経路で無検査） | 自動: `verify-core-access-cross-tenant.cjs` | H | FIN-03, FIN2-01 |
| TEN-21 | 拡張が tx に**乗る**モックで、`owned()` の `run` が **run の中で await する実装**であること（run の外で PrismaPromise を await するとマーカーが届かない。リード実機実験 A/B）を含めて `owned(tx).update` が成功し、`owned(tx)` のネスト connect で他社 id が拒否され、`tx.<model>.update` 直接が `UseOwnedHelperError` になるか | 分担の検証（乗る側） | 自動: `verify-core-access-cross-tenant.cjs`（ext-on） | H | FIN2-01 |
| TEN-22 | 拡張が tx に**乗らない**モックで、`owned(tx).update` が成功し、`owned(tx)` のネスト connect で他社 id が拒否され、`owned(tx).findMany` が自社行のみを返し、`OwnedTx` 型がテナントモデルの読み書き全操作（create/createMany/createManyAndReturn を含む）を Omit してコンパイルエラーにするか | 分担の検証（乗らない側） | 自動: 同上（ext-off）＋tsc | H | FIN2-01 |
| TEN-23 | `ownedScope` が export されておらず、外部モジュールからマーカーを付けて拡張を迂回できないか | マーカー偽造 | 自動: `verify-core-access-cross-tenant.cjs`（別モジュールからの `update` 直呼びが throw） | H | FIN2-01 |
| TEN-24 | `updateMany` の `data` にテナント列があるとき、拡張の `updateMany` 分岐と `owned().updateMany` の両方が `walkData` で throw するか | 自社行を他社テナントへ移す書き込み | 自動: `verify-core-access-cross-tenant.cjs`（updateMany data） | H | FIN3-01 |
| TEN-25 | tx 内の一覧・集計読みが `owned(tx, ctx)` 経由だけで、`tx.<model>.findMany` 等の直接呼び出しが型エラー＋lint エラーになるか | 拡張が乗らない tx で他社行が返る | 自動: tsc＋ESLint `core/tx-tenant-where`（error） | H | FIN3-02 |
| TEN-26 | マトリクスの読み取り行（findUnique(OrThrow)・findFirst(OrThrow)・findMany・count・aggregate・groupBy）が 5 列すべてで表どおりか（ctx.db 直接の findUnique は throw、owned は scoped、tx 直接は型エラー） | 読み取りの穴 | 自動: `verify-core-access-cross-tenant.cjs`（reads×5 列、ext-on/off） | H | FIN4-01 |
| TEN-27 | create / createMany / createManyAndReturn が ctx.db 直接では throw、owned では walkData（戻り値）＋refs 検証＋withTenant、tx 直接は型エラーか。`user.create` 等**非テナント親**の data にテナントモデルへのネストがある場合も同じか | create 経路のネスト connect・テナント列 | 自動: 同上（creates×5 列） | H | FIN4-01 |
| TEN-28 | update / updateMany / upsert / delete / deleteMany が ctx.db 直接では throw、owned では表どおり（所属確認・scoped・walkData）、tx 直接は型エラーか。`user.update({ data: { companyMemberships: { update / upsert / deleteMany } } })` 等**非テナント親経由**でも同じか | 更新・削除の穴 | 自動: 同上（writes×5 列） | H | FIN4-01 |
| TEN-29 | `$queryRaw` / `$executeRaw` が `tenantSql(ctx)` 無しで lint エラーになり、`OwnedTx` では `$tenantRaw` だけが使え、**`$queryRawUnsafe` / `$executeRawUnsafe` は呼び出し自体が lint 禁止（`scripts/ops/**` 以外）**か | raw SQL の素通り | 自動: `verify-core-raw-sql-tenant.cjs`＋tsc | H | SEC-04, FIN4-01 |
| TEN-30 | include / select の to-many relation に where が足され、to-one の親が post-filter されるか（ctx.db と owned の両方） | 親方向の他社読み | 自動: `verify-core-access-cross-tenant.cjs`（include） | H | SEC-01 |
| TEN-31 | 配列形 `$transaction([...])` が読み取り専用で、書き込み PrismaPromise（マーカー無し）が拡張で throw されるか | 配列形経由の書き込み | 自動: 同上（array tx） | M | FIN3-07 |
| TEN-32 | `walkData` が純関数で、呼び出し側が戻り値の data を必ず使い（入力を渡すと検査で検出）、テナント列違反は即 throw、ネスト対象は refs を `assertRefsOwned` が同じ client で検証して `TenantViolation` にするか（RecordNotFound に頼らない） | 書き換えの喪失・DB 依存の拒否 | 自動: 同上（walkData の戻り値を捨てた実装を検出する契約テスト、refs 0 件→拒否） | H | FIN4-02 |
| TEN-33 | `walkData` が既定拒否で、モデルのフィールドに無いキー・許可リストに無いネスト操作キーで即 throw し、入力を変更しない純関数か | 列挙漏れによる新しい穴 | 自動: `verify-core-access-cross-tenant.cjs`（未知フィールド・未知ネストキー・入力不変） | H | FIN5-01, FIN5-02 |
| TEN-34 | 非テナントモデル（User / Account / Session 等）への書き込みで data にテナントモデルへの relation があるとき、拡張の入口ゲートがマーカー無しで throw し、`OwnedTx` が非テナントモデルの書き込みを `Omit` しているか | 非テナント親経由の他社書き込み | 自動: 同上（`ctx.db.user.update` 経由 → throw、`owned(x).user.update` → 検査） | H | FIN5-01 |
| TEN-35 | `verify-core-dmmf-matrix.cjs` が `.prisma/client/index.d.ts` からモデル操作名・NestedInput キー・クライアント操作を抽出し、マトリクスの行と許可リスト 4 表に完全一致することを検査しているか（Prisma 更新で新操作が出たら CI が落ちる） | Prisma 更新時の列挙漏れ | 自動: `verify-core-dmmf-matrix.cjs` | H | 方針転換 |
| TEN-36 | `assertRefsOwned` が非テナントモデルの refs を除外し、where を正規化・重複排除して distinct 件数で比較し、`via:` 型は `scoped()` の展開を使い、refs 200 超で拒否するか | 正常系の誤拒否・非テナント参照の不通 | 自動: `verify-core-access-cross-tenant.cjs`（重複 where、User 参照、via 型） | M | FIN5-05 |
| TEN-37 | 機微テーブルの RLS ポリシーが fail-closed（`app.company_id` 未設定で 0 行）で、Cron / バッチが会社ごとに `set_config` して回り、`BYPASSRLS` ロールをアプリで使っていないか。`db push` がポリシーを保持することをステージングで確認したか | 第 2 防御の形骸化 | 自動: `verify-core-rls.cjs`＋手動: ステージング計測（p95） | M | 方針転換 |

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
| AUTH-21 | セッション Cookie と `doya_device` が `__Host-` 接頭辞か | 兄弟サブドメインからの Cookie 固定 | 自動: `verify-core-session-revocation.cjs`（Cookie 名） | M | SEC-06 |
| AUTH-22 | `access_type: 'offline'` を要求せず、`Account` に `refresh_token / access_token / id_token` を保存していないか | DB 漏洩時の長期トークン流出 | 自動: `verify-core-google-claims.cjs`（Account 行） | M | SEC-08 |
| AUTH-23 | `Session.sessionToken` と `AdminSession.token` をハッシュで保存しているか（Cookie 値は不変） | DB 読み取りでセッション乗っ取り | 自動: 同上 | M | SEC-09 |
| AUTH-24 | `createSession` の端末上限判定が advisory lock で直列化されているか | 同時 2 端末ログインの競合 | 自動: `verify-core-session-limit.cjs`（並行） | L | SEC-10 |
| AUTH-25 | メール比較（招待受諾・`User.email`）が小文字正規化されているか。同メール別 `sub` の運営手順があるか | Google は大文字小文字を区別しない | 自動: `verify-core-invitation-token-hash.cjs` | M | SEC-11 |
| AUTH-26 | `getSessionAndUser` が `sha256(doya_device) !== SessionDevice.deviceTokenHash` で null を返し、Session が端末に束縛されているか | Cookie コピーによる共有 | 自動: `verify-core-session-binding.cjs` | H | SEC-03 |
| AUTH-27 | `SessionObservation`（48h リング）を記録し、同一 Session で uaHash/ipPrefix が交互に出る `share.session_cookie_shared` を検知しているか | 最新値だけでは共有を検知できない | 自動: `verify-core-share-detection.cjs` | H | SEC-03 |
| AUTH-28 | 会社設定 `strictSharing` で desktop 1 + mobile 1 とログイン時パスキー必須（端末束縛）が選べ、pending 文脈（`__Host-doya_pending`）で未登録者の初回登録と紛失者の回復申請ができるか | 「人」を区別できる唯一の手段 | 自動: 同上＋`verify-core-step-up-passkey.cjs` | M | SEC-03 |
| AUTH-29 | パスキーの追加・削除は既存パスキーでの step-up 必須、初回登録は Google 経路＋通知＋24h クールダウン、最後の 1 本は代替登録後でなければ削除不可か | 窃取セッションでの全削除→弱い経路への降格 | 自動: `verify-core-passkey-management.cjs` | H | SEC-07 |
| AUTH-30 | 全パスキー紛失の回復が二人制御（owner＋運営 admin）＋48h 待機＋本人通知か | 社会工学の標的 | 手動: 回復演習 | H | SEC-07 |
| AUTH-31 | `rpId` が主ドメイン 1 つに固定され、`expectedOrigin` に全ホストが列挙されているか | 別ホストで assertion 不能 | 自動: `verify-core-step-up-passkey.cjs` | M | SEC-07 |
| AUTH-32 | counter の拒否条件が「保存値 > 0 かつ 新値 <= 保存値」だけか（0 固定の認証器を落とさない） | WebAuthn §6.1.1 | 自動: 同上 | M | SEC-07 |
| AUTH-33 | 使い回しは技術的に完全には防げないことが明記され、`share.*` は検知→通知→admin 判断で自動 suspend しないか（strictSharing を除く） | 誤検知で正当ユーザーを止めない | 手動: README §11.1/11.4 | M | SEC-03 |
| AUTH-34 | admin ログインのロックが IP＋username の組で、breakglass は IP ロックのみ対象、ロック中でも正しいパスワードなら通るか | ロックアウト DoS | 手動: 誤パスワード 10 回後に入れる | M | SEC-29 |
| AUTH-35 | `requireBannerAdmin` が `verifyAdminSession`（DB 照合）を使い、ログアウト済み JWT を拒否するか | 無効化済み admin の JWT が 24h 有効 | 自動: `verify-cron-timing-safe.cjs`（guard） | M | SEC-30 |
| AUTH-36 | `strictSharing` の pending 文脈で使えるルートが passkey-login / 初回登録 / 回復申請の 3 つに限定され、ON 時に未登録メンバー数を確認表示するか | 未登録者・紛失者の締め出し | 自動: `verify-core-step-up-passkey.cjs`（pending 文脈） | H | FIN-06 |
| AUTH-37 | adapter 内の `cookies()` 読み取りが try/catch で、取れない文脈では `deviceVerified=false` → mutation 401・読み取り許可になるか | 設計どおり書けない／例外 | 自動: `verify-core-session-binding.cjs`（cookies 不可の文脈） | M | FIN-14 |
| AUTH-38 | 複数会社所属で pending になる条件（ログイン直後に選ばれる会社が strictSharing）と、切替時の assertion 要求、未登録判定（`revokedAt IS NULL` 0 件）が実装されているか | 他社経由での strictSharing 迂回 | 自動: `verify-core-step-up-passkey.cjs`（switch） | M | FIN2-06 |

## 3. AUTHZ 認可（既定拒否・ロール）

| ID | 確認内容 | なぜ | 確認方法 | 重大度 | 監査 |
|---|---|---|---|---|---|
| AUTHZ-01 | 全 route / page が 5 分類（public / cron / cron-launch / guest-shared / auth-required）のいずれかに機械的に分類され、スナップショットと一致するか | 手書き許可リストの取りこぼし | 自動: `verify-core-route-classes.cjs` | H | A-6 |
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
| AUTHZ-19 | route ハンドラは `withCompanyAccess / withCompanyAccessOrCron / withGuestToken / withCron / withAdmin / withPublic(reason)` の HOF でしか export できず、文字列検査に頼っていないか | `return` し忘れ・ヘルパー内認証の誤分類 | 自動: `verify-core-route-guard.cjs`（export の形） | H | SEC-12 |
| AUTHZ-20 | ランタイム・スモーク（全 route を未認証で叩き、public 以外で 2xx なら失敗）が CI にあるか | 静的検査の取りこぼし | 自動: `verify-core-route-smoke.cjs` | H | SEC-12 |
| AUTHZ-21 | `support` ロールは 72h 上限・sensitive ツールとエクスポート禁止・`onBehalfOf` 必須・owner のパスキー step-up で付与か | 運営の裁量アクセス | 自動: `verify-core-access-role-ceiling.cjs`（support） | M | SEC-14 |
| AUTHZ-22 | `routes.public[].guard` が enum（`token-param / requireGuestToken / secret-header / none`）で、`none` に理由があり、`secret-header` は `webhooks[]` と対応しているか | 自由文字列では検査対象を特定できない | 自動: `verify-service-manifest-public-reason.cjs`, `verify-service-manifest-webhooks.cjs` | M | OPS-29 |

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
| BIL-16 | 月次クレジット付与は `invoice.payment_succeeded`（`billing_reason in (subscription_create, subscription_cycle)`）だけで、キーが `grant:<subId>:<period>` か（`customer.subscription.updated` では付与しない） | 席変更・カード更新のたびに付与される | 自動: `verify-billing-grant-period.cjs`（updated 3 連発で grant 1 行） | H | OPS-17 |
| BIL-17 | `reserve=-n / consume=+(n-実消費)≥0 / release=+n` で、冪等キーの基底が reserve ごとに新しい `reservationId` であり、consume・release の `period` を reserve 行から複製しているか。README §7.4 の数値例がテストになっているか | 二重計上・月またぎのズレ | 自動: `verify-billing-usage-reserve-release.cjs`（§7.4 の表を再現） | H | OPS-18 |
| BIL-18 | 会社経路の webhook が `stripe.subscriptions.retrieve` で live を取り直し、`event.created <= lastStripeEventCreated` を no-op にし、同一 subscription を advisory lock で直列化しているか | 順序逆転で席数が巻き戻る | 自動: `verify-billing-seats-sync.cjs`（5,5,3 の順） | H | OPS-19 |
| BIL-19 | ユーザー経路（`isDoyaSubscription` / `findActiveLikeSubscriptions` / `handleSubscriptionDeleted`）が `metadata.companyId` を持つ subscription を除外し、会社経路はそれだけを扱うか | 会社契約が `User.plan` を書き換える／個人解約が FREE に落ちない | 自動: `verify-billing-company-webhook-idempotent.cjs`（交差汚染 2 ケース） | H | OPS-20 |
| BIL-20 | 会社経路の webhook 分岐と権利判定がフラグ非依存で常時 ON、`billing.company_mode` は Checkout 入口のみか | ロールバックで支払い済みの会社が FREE | 自動: 同上（フラグ OFF でも会社契約が反映） | H | OPS-21 |
| BIL-21 | 移行時に `stripe.subscriptions.update({metadata: {companyId}})` を実行し、webhook は `CompanySubscription.stripeSubscriptionId` の逆引きも行うか | 移行契約の解約・失敗が反映されない | 自動: 同上（metadata 無し subscription の status 変更） | H | DATA-02 |
| BIL-22 | Phase2〜3 の会社経路が台帳更新後に `syncUserPlan(owner)`（max 規則の単一の書き手）を呼び、Phase3 ロールバックで権利が消えないか | 会社 Checkout 契約者が FREE 扱い | 自動: 同上 | M | DATA-14 |
| BIL-23 | 旧 Price → 統一 Price は同一 Customer 内の item 差し替え（`create_prorations`）で、再契約させず、席 item は `seatItemId` で固定か | 年額の按分・空白期間 | 手動: Stripe テストモードで差し替え | M | OPS-22 |
| BIL-24 | `billing-audit` が `CompanySubscription` 全件を Stripe と突合し、`StripeWebhookEvent.status='failed'` を報告するか | Webhook 欠落 | 手動: Slack レポート | M | OPS-23 |
| BIL-25 | 会社 Checkout が会社キーと操作者 user キーの 2 キーで予約されるか | 個人と会社の同時契約 | 自動: 既存 reservation テストの会社版 | M | OPS-24 |
| BIL-26 | 孤児 reserve（1h 以上）を日次 sweep が release し、`SecurityEvent` を出すか | 残高を食い続ける | 自動: `verify-billing-usage-reserve-release.cjs` | M | OPS-18 |
| BIL-27 | 残高判定は台帳 SUM で、`UsageBalance` を同一 tx で更新していないか | 会社行ロックで接続枯渇 | 自動: 同上 | M | DATA-13 |
| BIL-28 | paused からの再開で新しい `reservationId` で再 reserve し、`idempotencyKey` が衝突しないか | llm_outage 復帰が必ず失敗 | 自動: `verify-billing-usage-reserve-release.cjs`（再 reserve） | H | FIN-04 |
| BIL-29 | `User.plan` の書き手が `syncUserPlan`（max(個人 tier, owner 会社 tier)）だけで、ユーザー経路の解約処理も会社経路もそれを呼ぶか | 会社契約者が個人解約で FREE | 自動: `verify-billing-company-webhook-idempotent.cjs`（個人解約・会社解約の 4 ケース） | H | FIN-05 |
| BIL-30 | Stripe 返金（`charge.refunded` / `invoice.voided`）が `adjust(−m)` を書き、`refund(+m)` は運営補填にしか使われないか | 返金＋利用の二重取り | 自動: `verify-billing-grant-period.cjs`（返金） | M | FIN-09 |
| BIL-31 | 統一プランが月額のみで、年額の既存契約は移行手順 5 で月額に差し替えられるか | 付与が年 1 回 | 手動: Stripe の Price 一覧 | L | FIN-10 |

## 5. MIG データ移行・ロールバック

| ID | 確認内容 | なぜ | 確認方法 | 重大度 | 監査 |
|---|---|---|---|---|---|
| MIG-01 | 本番 DB のドライラン（組織数・空組織・FK 孤児・slug 衝突・同 owner 複数組織・`HrOrganization.stripe*` 非 null）を Phase0 で取り、README §13 に数値を入れたか | 推測での移行 | 手動: リードがドライラン結果を確認 | H | A-2, B-4 |
| MIG-02 | ドライラン・移行スクリプトは Prisma 経由で、生 SQL の表名を手書きしていないか | 表名の誤り | 手動: コードレビュー | M | B-23 |
| MIG-03 | FK なし Member の孤児（`userId` が存在しない）は隔離（INACTIVE）し、削除していないか。kintai の `pending_` 行を先に招待として除外しているか | 復元可能性・招待の誤隔離 | 自動: `scripts/ops/tenant-dryrun.ts` の**未分類 0 件**（隔離後も孤児行は残る） | H | — |
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
| MIG-15 | 新→旧の除籍で旧 `*Member` 行を物理削除し、reconcile の対応表（旧なし⇔removed、旧 PENDING⇔Invitation、旧 INACTIVE⇔suspended）があるか | 再入社が永久に 409 | 自動: `verify-core-invitation-token-hash.cjs`（再入社） | H | DATA-03 |
| MIG-16 | 孤児判定の前に kintai の `userId LIKE 'pending_%'` を招待として除外しているか | 招待中の従業員を全員隔離 | 自動: ドライランの未分類 0 | H | DATA-04 |
| MIG-17 | `Session` の index 実名・FK `NOT VALID`→`VALIDATE`・`lock_timeout` が手順書にあるか | FK 追加のロック | 手動: 手順書 | H | DATA-05 |
| MIG-18 | 自動名寄せは 3 条件のみで、代表 owner（最古 ACTIVE owner）が定義され、slug 一致だけで束ねていないか | 他社データ混入 | 手動: ドライランの未対応リスト | H | DATA-07 |
| MIG-19 | 複数系統の PENDING 招待を `(companyId, lower(email))` で 1 件に統合し、`expiresAt=createdAt+TTL`、`invitedById` のフォールバックがあるか | `activeKey` P2002 | 自動: 移行ドライラン | M | DATA-08 |
| MIG-20 | 正本は `CompanyServiceLink`、派生列は同一 tx、Phase2 初回 ON 前にも reconcile を実行したか | 正本の二重化 | 手動: 実行ログ | H | DATA-09 |
| MIG-21 | フラグに `requires` があり、依存未達は ON にできず、不可逆なフラグが明記されているか | 組合せで全停止 | 自動: `verify-core-feature-flag-scope.cjs`（requires） | H | OPS-25 |
| MIG-22 | Phase0 で 18 サービス全部の最小マニフェストがあり、allowlist を作っていないか | 未移行 allowlist の恒久化 | 自動: `verify-service-manifest-exists.cjs` | H | OPS-26 |
| MIG-23 | 所要期間・人員の見積りが前提付きで書かれ、観察期間を縮めていないか | 評価不能な計画 | 手動: README §12 | L | OPS-26 |
| MIG-24 | `billing.company_mode` の戻し方が「Checkout 入口のみ戻る。既契約は会社経路のまま」と書かれているか | 戻せない前提の誤解 | 手動: README §12 | M | OPS-21 |
| MIG-25 | `DELETE /api/admin/users/[id]` が Restrict FK を前提に改修されているか（唯一 owner は 409、`CompanyMember` 物理削除＋`AuditLog`、Agent 履歴があれば 409） | 全ユーザーの削除が不可能 | 自動: `verify-admin-user-delete.cjs` | H | DATA-01 |

## 6. SCH DB スキーマ（FK・onDelete・unique・index・NULL）

| ID | 確認内容 | なぜ | 確認方法 | 重大度 | 監査 |
|---|---|---|---|---|---|
| SCH-01 | `schema-draft.prisma` を既存 schema と結合して `prisma validate` が通るか | 書いてある通りに移植できない | 自動: `verify-core-schema-draft.cjs` | H | A-3 |
| SCH-02 | 既存モデルへの追加列は merge-into の model 断片で書かれ、コメントだけになっていないか | 移植忘れ | 自動: 同上（断片 0 件なら失敗） | M | A-3 |
| SCH-03 | 課金・台帳・監査・会社所属・エージェント履歴の `onDelete` が Restrict（または FK なし）で、Cascade になっていないか。**既存の `user.delete` 経路（`admin/users/route.ts` L301-308）が Restrict で止まる前提で改修されているか** | 会社削除で正本が消える／ユーザー削除が全員 500 | 自動: `verify-core-schema-ondelete.cjs`（draft を解析） | H | A-5, B-7 |
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
| SCH-17 | `CompanyInvitation.invitedById` が `String?` + SetNull か | 退職者が招待者だと削除不能 | 自動: prisma validate＋`verify-core-schema-ondelete.cjs` | M | DATA-01 |
| SCH-18 | `AgentStep` が `planVersion` を持ち `@@unique([runId, planVersion, ord])`、旧版は `superseded` で残るか | 再計画で `ord` 衝突・履歴消失 | 自動: `verify-agent-replan.cjs` | M | DATA-11 |
| SCH-19 | `ApprovalRequest` が `@@unique([stepId, attempt])` で、expired 後の再要求と `unknown_outcome` を同じ step に作れるか | 再要求不能 | 自動: 同上 | M | DATA-11 |
| SCH-20 | `LlmCallLog` に `@@index([refType, refId])` があり、プランナー呼び出しが `refType='agent-run'` を必須にしているか | run 単位の集計不能 | 自動: `verify-agent-budget.cjs` | M | DATA-12 |
| SCH-21 | FK 列に index があるか（`AgentRun.conversationId`、`UsageLedger.userId`、`CompanyInvitation.invitedById`、`ApprovalRequest.runId`） | SetNull・一覧で seq scan | 自動: `verify-core-schema-draft.cjs`（FK 列 index 検査） | L | DATA-18 |
| SCH-22 | `FeatureFlag` の書き込み関数が `scope≠'*' ⇒ companyId===scope` を強制しているか | 矛盾行 | 自動: `verify-core-feature-flag-scope.cjs` | M | DATA-19 |
| SCH-23 | `KnowledgeSource.allowedServices` が空＝使えない既定で、取り込み API が 1 つ以上を必須にしているか | 指定忘れで HR テキストが全サービスへ | 自動: `verify-core-knowledge-scope.cjs` | H | DATA-20 |
| SCH-24 | `AuditLog` の index が 3 本に絞られ、月次パーティションの raw SQL 手順があるか | 高頻度 INSERT 表の肥大 | 手動: 手順書 | M | DATA-21, OPS-32 |
| SCH-25 | `Company.slug` 衝突時の連番規則があるか | 移行バッチ停止 | 自動: 移行ドライラン | L | DATA-22 |
| SCH-26 | 金額の月次 SUM を BigInt で集計しているか | `Int` 桁あふれ | 自動: `verify-agent-usage-bigint.cjs` | L | DATA-23 |
| SCH-27 | ER 図のカーディナリティが draft と一致しているか（optional は `o|`、1:N は `o{`） | 文書と実装の乖離 | 自動: `verify-core-er-consistency.cjs`（draft の relation から ER を機械検査） | L | DATA-16 |
| SCH-28 | 文書間でキー名・件数・行番号が一致しているか（`grant:` キー、28 テーブル、`linkedBy` 値） | 実装者が別々の値を実装 | 手動: レビュー | L | DATA-17 |
| SCH-29 | 失効・期限切れ `Session` を 90 日で削除する cron があるか | ホットテーブルの単調増加 | 自動: `verify-core-retention.cjs` | M | DATA-06 |
| SCH-30 | 会社 purge が PII を持つ子の削除と匿名化に限定され、`Company` 行・課金系・`AuditLog` を 3 年残す定義か | Restrict で purge が失敗／台帳消失 | 自動: `verify-core-company-purge.cjs` | H | DATA-10 |
| SCH-31 | `AuditLog` が `@@id([id, createdAt])` で、パーティション化はステージングで `db push` の差分が空になることを確認してからか | 以後の db push がブロック | 自動: `verify-core-schema-draft.cjs`＋手動: ステージング | M | FIN-15 |

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
| AGT-11 | 計画確定後に追加できる step は `read` ツールのみか | 結果を読んで irreversible / high の step を追加させない | 自動: 同上 | H | — |
| AGT-12 | ツール入力は zod `.strict()` で、URL は `assertUrlSafe`、id は cuid＋会社所属を検査するか | 入力経由の攻撃 | 自動: `verify-agent-tool-input-strict.cjs` | H | M-9 |
| AGT-13 | run ごとに `creditBudget` / `maxToolCalls` / `maxLlmCalls` / `wallClockLimitSec` があり、超過で `failed(budget)` になるか | コスト暴走 | 自動: `verify-agent-budget.cjs` | H | C-1 |
| AGT-14 | `estimatedPaidCalls` と `LlmCallLog` の実測が 2 倍以上乖離したら `SecurityEvent` になるか | 見積りの形骸化 | 自動: 同上 | M | B-16 |
| AGT-15 | ツールが呼ぶ lib の有料呼び出しが gateway / image-core / realtime 経由で、未移行 lib を呼ぶツールは登録できない（M-11 が `run` の import 閉包で raw fetch / SDK 直接利用を検出）か | 計測ゼロでの運用 | 自動: `verify-service-manifest-paid-api.cjs`（import 閉包） | H | B-16, M-11 |
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
| AGT-26 | 自発解放時に必ず `nextRunAt=now()` を書き、Cron の claim 条件が `status IN ('queued','planning','running')` で `executionToken IS NULL AND nextRunAt <= now()` を含み、リース TTL が 360s（1 つ）か | ブラウザを閉じると永久に running | 自動: `verify-agent-run-lease.cjs`（解放後 1 分以内に Cron が再開） | H | OPS-01 |
| AGT-27 | `AgentRun/AgentStep/ToolCall/ApprovalRequest/UsageLedger` への全書き込みが `withAgentRunExecution(token)` のフェンス内で、ツール呼び出し前に `ToolCall(running)` を commit しているか | stale プロセスとの二重実行 | 自動: `verify-agent-write-fence.cjs` | H | OPS-02 |
| AGT-28 | `downstreamIdempotency` が `native / local-record / none` で宣言され、`local-record` の結果不明は `unknown_outcome` として人の確認（自動再試行なし、`maxAttempts=1`）か | 下流に受け口が無い再実行 | 自動: `verify-agent-unknown-outcome.cjs`、M-8/M-8b | H | OPS-03 |
| AGT-29 | DB を触る区間がセマフォ 2 で直列化され、LLM/HTTP 区間だけ 4 並列か | `pool_timeout` で P2024 | 自動: `verify-agent-deadline.cjs`（接続数） | M | OPS-04 |
| AGT-30 | 承認期限切れを Cron sweep が `expired`→step `skipped`→reserve release にし、run が続行するか | 永久 waiting_approval | 自動: `verify-agent-approval-matrix.cjs`（expiry） | H | OPS-05 |
| AGT-31 | 壁時計が `runningSeconds`（running の累積）で、承認待ち・paused を数えないか | 承認後に即 timeout | 自動: `verify-agent-deadline.cjs` | H | OPS-05, OPS-16 |
| AGT-32 | cancel / kill switch / `AgentRun.status` を各 step 開始前と各有料呼び出し直前にキャッシュ無しで読み、`AbortController` で進行中呼び出しを中断するか | 240s スライス中に 4 並列で進む | 自動: `verify-agent-kill-switch.cjs`（進行中） | H | OPS-05, OPS-34 |
| AGT-33 | kill switch 解除時に `paused(kill_switch)` を一括 `nextRunAt=now()` にし、`paused` も Cron が拾うか | 復帰経路が無い | 自動: 同上 | M | OPS-05 |
| AGT-34 | 承認 API が同期で advance を呼ばず即 200 を返し、advance の認可に `decidedById` 本人が含まれるか | スマホの承認がタイムアウト／承認者が 403 | 自動: `verify-agent-approval-matrix.cjs` | H | OPS-05 |
| AGT-35 | Cron は claim と `POST /advance?detached=1` の HTTP 起動（最大 K 件）だけを行い、自身は advance のスライスを実行しないか | 5×240s で関数が死にリースが残る | 自動: `verify-agent-run-lease.cjs`（detached） | H | OPS-06, FIN3-05 |
| AGT-36 | `advanceAttempts` が期限切れリースからの再 claim だけを数えるか | 正常な長い run が failed | 自動: 同上 | M | OPS-07 |
| AGT-37 | リース・`nextRunAt` の比較が DB `now()` / `clock_timestamp()` に統一されているか | 時計差 | 自動: 同上（raw SQL の確認） | L | OPS-08 |
| AGT-38 | SSE が `Last-Event-ID` で再開し、3s ポーリング・同時 2 接続に制限されているか | 関数 300s の占有 | 自動: `verify-agent-sse.cjs` | L | OPS-09 |
| AGT-39 | `ApprovalRequest.approvalHash` を作成時に保存し、承認 API が一致を要求し、実行直前にも再計算するか | 承認した内容と実行内容の乖離 | 自動: `verify-agent-approval-matrix.cjs`（hash） | H | SEC-15 |
| AGT-40 | `fieldSources.origin in (scraped, agent)` を untrusted 扱いにし、`company.updateProfile` を承認必須にしているか | 注入の永続化 | 自動: `verify-agent-untrusted-wrapping.cjs` | H | SEC-16 |
| AGT-41 | 依頼者が removed/suspended になった run を canceled、その人宛 pending approval を expired にしているか | 永久 pending | 自動: `verify-core-access-suspended.cjs` | M | SEC-17 |
| AGT-42 | `estimatedPaidCalls` が gateway の `budget.maxCalls` に渡され事前強制されているか | 事後検知だけ | 自動: `verify-agent-budget.cjs` | M | SEC-18 |
| AGT-43 | planner へ渡す前に氏名→社員 ID の仮名化を行い、1on1 本文を planner に渡していないか | PII の第三者提供 | 自動: `verify-agent-sensitive-output.cjs` | H | SEC-21 |
| AGT-44 | 有料ツールの入力上限が型で固定されているか（`maxCompanies ≤ 50`、`n ≤ 8`、`engines ≤ 2`、`pages ≤ 10`） | 承認の見込み額を超える実行 | 自動: `verify-agent-tool-input-strict.cjs` | H | OPS-12 |
| AGT-45 | paused 遷移時に reserve を release し、再開時に再 reserve するか | 保留中に残高を食う | 自動: `verify-billing-usage-reserve-release.cjs` | M | OPS-16 |
| AGT-46 | `AgentRun.create` が `nextRunAt=now()` を書き、`planning` 中にリースが切れた run を Cron が再 claim するか | 永久 queued / planning | 自動: `verify-agent-run-lease.cjs`（planning 期限切れ、作成直後の失敗） | H | FIN-01, FIN-11 |
| AGT-47 | Cron の処理能力式（K = ceil(max_concurrent_runs/4)+2）と HTTP 起動（`after()`）または K スロットのどちらかが実装され、同時 run 上限に対して余裕があるか | ピーク時にキューが伸びる | 手動: 負荷試験（20 run 同時） | M | FIN-08 |
| AGT-48 | `pausedReason` が 3 値で、`company_suspended` の復帰（会社復旧手順の一括 `nextRunAt`）があるか | 復旧後も paused | 自動: `verify-agent-kill-switch.cjs`（会社復旧） | L | FIN-12 |
| AGT-49 | `/api/agent/runs/[id]/advance` が cron-launch 分類（`routes.cronLaunch`）で、`withCompanyAccessOrCron` で export され、Cron が claim した `executionToken` を body で渡して advance が再 claim せず継承し、不一致で 409 になるか。`CRON_SECRET` が cron-launch の起動以外に効かないか | middleware で 401／自分の claim に阻まれて 409／秘密の過剰な到達範囲 | 自動: `verify-agent-run-lease.cjs`（detached）、`verify-core-route-classes.cjs`（cron-launch） | H | FIN2-04 |
| AGT-50 | 書き込みフェンスの status 集合が `('queued','planning','running')` で、planning 中の `AgentPlan / AgentStep` 生成がフェンス内で成功するか | planning が完了しない／フェンス穴 | 自動: `verify-agent-write-fence.cjs`（planning） | H | FIN2-02 |
| AGT-51 | `AgentRun.maxApprovals`（既定 5）を超える承認要求を含む計画が planning で `failed(budget)` になり、依頼者に分割を促すか | 承認件数上限が実装されない | 自動: `verify-agent-approval-matrix.cjs`（6 件） | M | FIN3-06 |

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
| EXT-13 | ツールの `providerName` が `^[a-zA-Z0-9_-]{1,64}$` を満たし、`key` との往復変換が gateway に閉じているか | OpenAI が最初の呼び出しで 400 | 自動: `verify-service-manifest-tools.cjs`（M-9b） | H | OPS-10 |
| EXT-14 | provider 別の schema 変換器があり、CI で全ツール schema が OpenAI strict と Gemini サブセットの両方を通るか | フォールバック先で 400 | 自動: `verify-llm-gateway-tool-schema.cjs` | H | OPS-11 |
| EXT-15 | gateway が呼び出し前に見積コストを `budget.maxCostMinor` と比較し、超えるなら呼ばずに止めるか | 承認後に予算を超えても止まらない | 自動: `verify-llm-gateway-budget.cjs` | H | OPS-12 |
| EXT-16 | 画像フォールバック時に 1 枚 2 回（timeout 行は満額）で計上し、`estimatedPaidCalls` が n×2 か | 見込み額が実際の半分 | 自動: 同上 | H | OPS-12 |
| EXT-17 | `SeoJob.originRunId` で run 終了後の支出が `GET /api/agent/usage` に載るか | run の予算外の支出 | 自動: `verify-agent-usage-bigint.cjs` | H | OPS-12 |
| EXT-18 | `image-generator.ts` の型が `quality` 必須・`size` に `'auto'` 無しに直され、呼び出し元 3 箇所が明示指定か | 核の外側だけの保証 | 自動: tsc＋`verify-llm-gateway-image-params.cjs` | H | OPS-13 |
| EXT-19 | 試行カウンタがモデル・プロバイダを跨いで 1 つ（上限 4）で、4xx はモデルを変えないか | 12 回連鎖 | 自動: `verify-llm-gateway-retry.cjs` | M | OPS-14 |
| EXT-20 | `LlmCallLog` に `unitKind / cachedTokens / reasoningTokens / priceTableVersion` があり、単価不明は最大単価で見積もるか | コスト計測の穴 | 自動: `verify-llm-gateway-budget.cjs` | M | OPS-15 |
| EXT-21 | Realtime は `via='realtime'` で宣言され、セッション終了時に `LlmCallLog(audio_sec)` を書く `usageReport` があるか | 最大の変動費が計測から消える | 自動: `verify-service-manifest-paid-api.cjs`（M-11） | H | OPS-28 |
| EXT-22 | `safe-fetch` が公開 IP でもポートを 80/443 に限定しているか | 任意ポートへの到達 | 自動: private-address テストの拡張 | L | SEC-23 |
| EXT-23 | 退役サービスの importer（tenkai, interviewx）を `safeFetchResource` に置換し、退役中も SSRF 回帰テストを残しているか | 退役解除で即 SSRF | 自動: `verify-service-manifest-ssrf-test.cjs`（retired 含む） | M | SEC-31 |
| EXT-24 | `cron/llm-cost-rollup` が `LlmCallLog` を集計し、日次上限超過で `agent.kill_switch` を自動 ON にするか | 暴走の自動停止 | 自動: `verify-ops-cost-cap.cjs` | H | OPS-33 |

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
| PII-12 | 列暗号化が `keyId || nonce || AES-GCM(..., aad=table:column:rowId)` で、盲検索 HMAC が別鍵か | 暗号文の行間・列間入れ替え | 自動: `verify-core-encryption.cjs` | H | SEC-19 |
| PII-13 | 「env 漏洩は列暗号化の対象外」が脅威モデルに明記され、鍵ローテーションに「旧 keyId 行 0 の検証」があるか | 過信 | 手動: README §10.1/10.5 | M | SEC-19 |
| PII-14 | LLM プロバイダの保持・学習不使用・DPA が付録 I に記録され、未締結なら `allowSensitive=false` が全社既定か | 第三者提供の整理 | 手動: 付録 I | H | SEC-21 |
| PII-15 | `AuditLog.diff / details` に `redact()` を適用し、削除要求時の匿名化手順（`deleted:<hash>`、hash 再計算）があるか | 3 年残る PII | 自動: `verify-core-redact.cjs`（diff） | M | SEC-22 |

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
| AUD-10 | `DATABASE_URL`（`app_rw`）と `DIRECT_URL`（owner）がロール分離され、`app_rw` が `core_audit_logs` を UPDATE/DELETE できないか | 同一ロールでは追記専用にできない | 手動: DBA が GRANT を確認 | H | SEC-20 |
| AUD-11 | `AuditChainHead.hash` が毎日外部（運営 Slack＋WORM ストレージ）にアンカーされ、検証がアンカーと突合するか | 同一ロールでハッシュごと書き換え可能 | 自動: `verify-core-audit-append-only.cjs`（アンカー） | H | SEC-20 |
| AUD-12 | `core_audit_logs` が月次パーティションで、90 日超が WORM へアーカイブされるか | 3 年で数千万行 | 手動: 手順書・cron ログ | M | OPS-32 |
| AUD-13 | パスキーの追加・削除・回復、サポートアクセス付与が `AuditLog(sensitive)` に残るか | 最弱点の操作 | 自動: `verify-core-passkey-management.cjs` | M | SEC-07, SEC-14 |

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
| IO-13 | CSRF 判定が「`Sec-Fetch-Site==='same-origin'` または欠落時に `Origin` host が許可ホスト集合と一致。どちらも無い／`null` は 403」に固定されているか | 古い Safari の誤拒否・`Origin: null` | 自動: `verify-core-csrf-origin.cjs` | M | SEC-24 |
| IO-14 | クライアント IP を `x-vercel-forwarded-for` / `request.ip` から取り、`x-forwarded-for` 先頭を使っていないか | 偽装 | 自動: grep が core 以外 0 | M | SEC-25, SEC-34 |
| IO-15 | seo の guestId に形式検証があり、ゲスト quota を `ip:/24 × 日` でも数えるか | Cookie 削除でお試し復活 | 自動: 既存 seo 回帰テスト | L | SEC-13, SEC-33 |
| IO-16 | `shodan/company-profile/logo` を含む全アップロードがマジックバイト＋sharp 再エンコードか | 申告 MIME のみ | 自動: `verify-core-upload.cjs` | M | SEC-26, SEC-32 |
| IO-17 | CSP の `style-src` について inline 16 ファイルの棚卸しと nonce 化／`'unsafe-inline'` 残置の判断が記録されているか | CSP 導入で画面崩れ | 手動: Phase2 の棚卸し | L | SEC-27 |

## 12. RUN 運用（手動 db push の順序・Cron・maxDuration・障害対応）

| ID | 確認内容 | なぜ | 確認方法 | 重大度 | 監査 |
|---|---|---|---|---|---|
| RUN-01 | schema 変更は「`doya-db-push` で本番反映 → デプロイ」の順で、逆になっていないか | P2022 で全 500 | 手動: デプロイ前チェック欄 | H | — |
| RUN-02 | 起動時ヘルスチェックが新テーブルの存在を確認し、欠落を早期検出するか | 反映漏れ | 自動: `/api/health` の応答 | M | — |
| RUN-03 | `Session` の index と FK を手順どおり（CONCURRENTLY / NOT VALID / lock_timeout）に先行作成しているか | ロック | 手動: 手順書 | H | B-18, DATA-05 |
| RUN-04 | Cron 本数が README §17.3 の数（41。K スロット代替なら 41 + K − 1）と `vercel.json` で一致し、100 本以内か | 上限と記述の不一致 | 手動: `vercel.json` | L | B-13, OPS-27 |
| RUN-05 | 重複起動し得る Cron（Vercel は best effort・重複あり）が DB リースで相互排他され、冪等か | 二重処理 | 自動: `verify-agent-run-lease.cjs` | H | — |
| RUN-06 | 長時間処理は 240s で自発的に返し、`maxDuration=300` の関数を使い切らないか | リース残り | 自動: `verify-agent-deadline.cjs` | H | B-14 |
| RUN-07 | SSE ルートにも `maxDuration` があり、再接続前提か | 切断 | 手動: コードレビュー | L | C-14 |
| RUN-08 | インシデント手順（全セッション失効・会社停止・鍵ローテーション・インジェクション疑い・漏洩疑い）が文書化され、ステージングで演習済みか | 初動の遅れ | 手動: 演習記録 | H | — |
| RUN-09 | `FeatureFlag` は `scope='*'` 1 行で全体既定を表し、重複行が作れないか | kill switch が効かない | 自動: `verify-core-feature-flag-scope.cjs` | H | A-4 |
| RUN-10 | フラグ切替は admin 画面＋`AuditLog` で、再デプロイ無しに戻せるか | ロールバック速度 | 手動: ステージング | M | — |
| RUN-11 | `SystemSetting` を新規のロック・台帳・キューに使っていないか | 肥大化・集計不能 | 自動: grep `systemSetting.upsert` が core/agent に無い | M | — |
| RUN-12 | breakglass・手動付与・サポートアクセスなど運営の特例が全て `AuditLog` と通知を伴うか | 内部不正 | 手動: 運用手順 | M | D-7 |
| RUN-13 | 新規 Cron（`agent-runs`, `security-scan`, `audit-verify`, `agent-retention`）が `requireCron` で守られ、`vercel.json` に登録されているか | 無防備な Cron | 自動: `verify-core-route-classes.cjs`（cron 分類） | H | — |
| RUN-14 | Phase ごとの「完了条件」をリードが確認して昇格し、記録が残っているか | 勝手な昇格 | 手動: 昇格記録 | M | — |
| RUN-15 | 追跡済みの重複コピー（`doya-ai/src/app/banner/dashboard/page.tsx`）が lint / grep 集計から除外または削除されているか | 集計の汚染 | 手動: Phase0 の削除候補報告 | L | C-13 |
| RUN-16 | `cron/core-retention` が Session 90 日・観測 48h・RateLimit 1h・Notification 90 日・SecurityEvent 180 日・LlmCallLog 400 日を掃除するか | 無限増加 | 自動: `verify-core-retention.cjs` | M | OPS-32, DATA-06 |
| RUN-17 | `health-alert` に §17.2 の 12 監視項目（running×リース無し 5 分、waiting_approval 24h、lease_lost 率、unknown_outcome 率、孤児 reserve、webhook failed、LLM 日次コスト、advance p95、連鎖不一致、critical、legacy カウンタ、id ドリフト）が載っているか | 無音の故障 | 手動: Slack で各アラートを 1 回ずつ発生させる | H | OPS-33 |
| RUN-18 | SLO（承認→再開 ≤2 分、read run ≤3 分 p95、リース喪失 ≤0.5%、webhook ≤5 分、kill switch ≤120s）が計測されているか | 改善の基準が無い | 手動: Phase3 の計測値 | M | OPS-33 |
| RUN-19 | kill switch の伝播が「進行中の 1 有料呼び出し」以内（≤120s）か | 暴走に気づいても止まらない | 自動: `verify-agent-kill-switch.cjs` | H | OPS-34 |
| RUN-20 | Vercel Pro 前提（毎分 Cron、`maxDuration=300`、`x-vercel-forwarded-for`）が明記され、Hobby では成立しないことが書かれているか | プラン変更で日次 Cron に | 手動: README §17.3 | L | OPS-35 |
| RUN-21 | Cron 本数の記述が全文書で一致しているか（41。K スロット代替なら 41 + K − 1） | 不一致 | 手動: grep | L | OPS-27 |
| RUN-22 | 夜間 `billing-audit` が DB distinct `serviceId` ⊆ active manifests と retired の `enabled` 無しを検査するか | 1 回きりの検査 | 自動: `verify-service-manifest-ids.cjs`＋cron | M | OPS-30 |
| RUN-23 | 完了条件のカウンタ（`legacy_access.*`、`route_class.report_only_denied`、`access_shadow.diff`）が `RuntimeCounter` にあり、`SystemSetting` を使っていないか | 測定不能な完了条件 | 自動: grep | M | OPS-25 |
| RUN-24 | 会社 purge の順序（Artifacts→Runs→Members→Profile/Assets/Knowledge→旧組織→匿名化）と「課金系・AuditLog は残す」が手順にあるか | Restrict で purge が失敗 | 自動: `verify-core-company-purge.cjs` | M | DATA-10 |
| RUN-25 | Phase0 ドライランに Session 総行数・直近 30 日ログイン数・各系統 Member 行数・owner 複数組織数・同一メール複数系統 PENDING 数が含まれるか | 影響範囲が数値で出ない | 手動: ドライラン結果 | M | DATA-E, DATA-04, DATA-07, DATA-08 |

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
| UI-09 | 承認画面に `approvalHash`（短縮表示）と見込み回数・単価・合計額が出て、承認ボタンがそのハッシュを送るか | 古い画面での承認 | 手動: 承認画面 | H | SEC-15, OPS-12 |
| UI-10 | `unknown_outcome` の確認画面が「実行済みとして扱う／未実行として再実行／中止」の 3 択で、何が起きたかを平易に説明するか | 人の判断に必要な情報 | 手動: 画面 | M | OPS-03 |
| UI-11 | 共有検知の通知文が「何を検知したか・誤検知の申告先」を書き、脅し文句や絵文字が無いか | 誤検知時の信頼 | 手動: 文面 | L | SEC-03 |

---

## 14. DOC 文書整合（同じ規則の多重記述・数値・名称）

| ID | 確認内容（はい/いいえ） | なぜ必要か | 確認方法 | 重大度 | 監査 |
|---|---|---|---|---|---|
| DOC-01 | 同じ規則が文書内の複数箇所に書かれているとき、修正前に grep で全出現を列挙し、全箇所を同時に直したか（例: 除籍の意味論＝§5.1 / §9.1 / §11.6 / MIG-15、Cron claim 条件＝§8.4 / §8.6 / §17.2 / AGT-26、Cookie 名＝§6.3 / §10.7、冪等キーの基底＝§7.4 / §8.4 / §8.6 / draft） | 取り残しが矛盾になり、読んだ箇所で実装が変わる | 自動: `verify-doc-consistency.cjs`（付録 J の「多重記述キー」ごとに正規表現で全出現を抽出し、正本の文言と一致しなければ失敗） | H | FIN-07, FIN-13 |
| DOC-02 | 件数・行番号・モデル数（merge 28 / 新規 34 / 結合 226、テーブル 28、Cron 41）が README・draft・CHECKLIST・付録で一致しているか | 検証スクリプトの期待値が決まらない | 自動: 同上（数値キー） | M | FIN-16, DATA-17 |
| DOC-03 | 名称（Cookie 名、フラグ名、cron パス、ツール key、verify スクリプト名）が全文書で同一か | 実装者が別名で作る | 自動: 同上（名称キー） | M | FIN-13 |
| DOC-04 | ER 図の実体・カーディナリティ・UK/FK 表記が draft と一致し、ER に載せた属性名が draft に存在するか（属性は draft が正本。ER は抜粋だが載せたものは一致させる） | 図を見て作ると違う | 自動: `verify-core-er-consistency.cjs` | M | FIN-17, DATA-16 |
| DOC-05 | 状態遷移図の status / pausedReason の値が draft のコメントと一致し、全状態に終端への経路と復帰主体があるか | 実装者が 2 通りに解釈 | 自動: `verify-agent-state-machine.cjs`（図から遷移表を抽出し、到達性と draft の値を検査） | H | FIN-01, FIN-12 |
| DOC-06 | 「要実機確認」と書いた外部仕様に、確認できなかった場合の代替設計が併記されているか | 片方に賭けた設計 | 手動: 付録 B の各項目 | M | FIN-03, FIN-08, FIN-14, FIN-15 |
| DOC-07 | 付録の回答表（D / F / G）に審査の全 ID の行があり、「部分的」判定が次の改訂で「反映」まで到達しているか | 取りこぼし | 自動: ID 列挙スクリプト | M | 全般 |
| DOC-08 | 改訂のたびに、付録 J の全キーについて「正本の文言 ≥1 回、禁止語 0 回（付録 J 自身を除く）」を README・CHECKLIST・schema-draft の 3 ファイルで機械検査し、結果（キーごとの出現数・禁止語の残数）を完了報告に添付したか | grep 依頼だけでは取り残しが出る（改訂 4 で 4 キー） | 自動: `verify-doc-consistency.cjs`（キー・正本語・禁止語は付録 J の表から読む） | H | FIN2-03, FIN2-05, FIN2-07 |
| DOC-09 | 新しい規則を追加したとき、それが 2 箇所以上に書かれるなら付録 J にキー・正本・禁止語を追加したか | 多重記述の増殖 | 手動: PR テンプレートのチェック欄 | M | FIN2-01, FIN2-04, FIN2-05 |

## 監査指摘との対応表

| 監査 | 再発防止するチェック項目 |
|---|---|
| A-1 | AUTH-11, AUTH-12, AUTH-13, AUTH-14 |
| A-2 | BIL-03, MIG-01 |
| A-3 | SCH-01, SCH-02 |
| A-4 | SCH-05, RUN-09 |
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
| B-13 | RUN-04 |
| B-14 | AGT-16, EXT-05, RUN-06 |
| B-15 | AGT-10 |
| B-16 | AGT-14, AGT-15, EXT-01 |
| B-17 | AUTH-05, AUTH-06, UI-08 |
| B-18 | SCH-12, RUN-03 |
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
| C-10 | RUN-06（`waitUntil` に頼らない） |
| C-11 | EXT-09 |
| C-12 | TEN-02 |
| C-13 | RUN-15 |
| C-14 | RUN-07 |
| C-15 | AUTHZ-02（LP はマニフェスト `landing` で宣言） |
| D-1 | AUTH-17 |
| D-2 | AUTHZ-02（公開ルートの理由。410 化は README §15） |
| D-3 | EXT-03 |
| D-4 | AUTHZ-17, SCH-14 |
| D-5 | AUTH-02 |
| D-6 | AUTHZ-16, EXT-09 |
| D-7 | AUTH-18, RUN-12 |
| D-8 | MIG-04, SCH-05 |

項目数: TEN 37 / AUTH 38 / AUTHZ 22 / BIL 31 / MIG 25 / SCH 31 / AGT 51 / EXT 24 / PII 15 / AUD 13 / IO 17 / RUN 25 / UI 11 / DOC 9 ＝ **349 項目**。監査 A〜D の 59 指摘、第 2 回審査の 92 指摘、最終ゲート第 1〜5 回の 17 / 7 / 8 / 7 / 5 指摘すべてに対応項目あり（漏れ 0）。

## 最終ゲート第 5 回（FIN5）との対応表

| 審査 | 再発防止するチェック項目 |
|---|---|
| 方針転換（DMMF 既定拒否・RLS） | TEN-33, TEN-34, TEN-35, TEN-12, TEN-37 |
| FIN5-01 | TEN-34, TEN-27, TEN-28 |
| FIN5-02 | TEN-14, TEN-33 |
| FIN5-03 | TEN-29 |
| FIN5-04 | AUTHZ-01, DOC-03 |
| FIN5-05 | TEN-36 |


## 最終ゲート第 4 回（FIN4）との対応表

| 審査 | 再発防止するチェック項目 |
|---|---|
| FIN4-01 | TEN-22, TEN-26, TEN-27, TEN-28, TEN-29, TEN-30, TEN-31 |
| FIN4-02 | TEN-32, TEN-14 |
| FIN4-03 | RUN-04, RUN-21, DOC-02 |
| FIN4-04 | DOC-04 |
| FIN4-05 | AGT-11, DOC-03 |
| FIN4-06 | AGT-02, DOC-05 |
| FIN4-07 | TEN-26 |


## 最終ゲート第 3 回（FIN3）との対応表

| 審査 | 再発防止するチェック項目 |
|---|---|
| FIN3-01 | TEN-24, TEN-14 |
| FIN3-02 | TEN-22, TEN-25 |
| FIN3-03 | TEN-21, TEN-20 |
| FIN3-04 | AGT-26, DOC-02 |
| FIN3-05 | AUTHZ-19, AGT-35, DOC-03 |
| FIN3-06 | AGT-51, AGT-01, DOC-04 |
| FIN3-07 | TEN-25 |
| FIN3-08 | IO-04, AGT-49 |


## 最終ゲート第 2 回（FIN2）との対応表

| 審査 | 再発防止するチェック項目 |
|---|---|
| FIN2-01 | TEN-20, TEN-21, TEN-22, TEN-23 |
| FIN2-02 | AGT-50, DOC-01 |
| FIN2-03 | BIL-22, BIL-29, DOC-08 |
| FIN2-04 | AGT-49, AUTHZ-19, AUTHZ-16 |
| FIN2-05 | AGT-15, EXT-01, DOC-08 |
| FIN2-06 | AUTH-36, AUTH-38, SCH-10 |
| FIN2-07 | DOC-02, DOC-03, DOC-04, DOC-08 |


## 最終ゲート第 1 回（FIN）との対応表

| 審査 | 再発防止するチェック項目 |
|---|---|
| FIN-01 | AGT-26, AGT-46, DOC-05 |
| FIN-02 | TEN-14, TEN-19 |
| FIN-03 | TEN-20 |
| FIN-04 | BIL-17, BIL-28 |
| FIN-05 | BIL-29 |
| FIN-06 | AUTH-28, AUTH-36 |
| FIN-07 | MIG-15, DOC-01 |
| FIN-08 | AGT-47 |
| FIN-09 | BIL-30 |
| FIN-10 | BIL-31 |
| FIN-11 | AGT-46 |
| FIN-12 | AGT-48, DOC-05 |
| FIN-13 | AUTH-21, DOC-03 |
| FIN-14 | AUTH-37 |
| FIN-15 | SCH-31 |
| FIN-16 | DOC-02 |
| FIN-17 | DOC-04 |


## 第 2 回審査（DATA / SEC / OPS）との対応表

「OPS-nn」は審査レポートの ID。本書の運用章の ID は `RUN-nn` に改名した（衝突回避）。

| 審査 | 再発防止するチェック項目 |
|---|---|
| DATA-01 | MIG-25, SCH-03, SCH-17 |
| DATA-02 | BIL-21 |
| DATA-03 | MIG-15 |
| DATA-04 | MIG-03, MIG-16 |
| DATA-05 | SCH-12, MIG-17, RUN-03 |
| DATA-06 | SCH-29, RUN-16 |
| DATA-07 | MIG-18 |
| DATA-08 | MIG-19 |
| DATA-09 | MIG-20 |
| DATA-10 | SCH-30, RUN-24 |
| DATA-11 | SCH-18, SCH-19 |
| DATA-12 | SCH-20 |
| DATA-13 | BIL-27 |
| DATA-14 | BIL-22 |
| DATA-15 | MIG-13 |
| DATA-16 | SCH-27 |
| DATA-17 | SCH-28 |
| DATA-18 | SCH-21 |
| DATA-19 | SCH-22 |
| DATA-20 | SCH-23 |
| DATA-21 | SCH-24 |
| DATA-22 | SCH-25 |
| DATA-23 | SCH-26 |
| SEC-01 | TEN-14, TEN-15, TEN-18 |
| SEC-02 | TEN-16 |
| SEC-03 | AUTH-26, AUTH-27, AUTH-28, AUTH-33, UI-11 |
| SEC-04 | TEN-17 |
| SEC-05 | SCH-03（原則との不一致のみ。反映しない理由は README 付録 F） |
| SEC-06 | AUTH-21 |
| SEC-07 | AUTH-29, AUTH-30, AUTH-31, AUTH-32, AUD-13 |
| SEC-08 | AUTH-22 |
| SEC-09 | AUTH-23 |
| SEC-10 | AUTH-24 |
| SEC-11 | AUTH-25 |
| SEC-12 | AUTHZ-19, AUTHZ-20 |
| SEC-13 | IO-15 |
| SEC-14 | AUTHZ-21 |
| SEC-15 | AGT-39, UI-09 |
| SEC-16 | AGT-40 |
| SEC-17 | AGT-41, AGT-32 |
| SEC-18 | AGT-42 |
| SEC-19 | PII-12, PII-13 |
| SEC-20 | AUD-10, AUD-11 |
| SEC-21 | AGT-43, PII-14 |
| SEC-22 | PII-15 |
| SEC-23 | EXT-22, EXT-23 |
| SEC-24 | IO-13 |
| SEC-25 | IO-14 |
| SEC-26 | IO-16 |
| SEC-27 | IO-17 |
| SEC-28 | AUTH-17 |
| SEC-29 | AUTH-34 |
| SEC-30 | AUTH-35 |
| SEC-31 | EXT-23 |
| SEC-32 | IO-16 |
| SEC-33 | IO-15 |
| SEC-34 | IO-14 |
| OPS-01 | AGT-26 |
| OPS-02 | AGT-27 |
| OPS-03 | AGT-28, UI-10 |
| OPS-04 | AGT-29 |
| OPS-05 | AGT-30, AGT-31, AGT-32, AGT-33, AGT-34 |
| OPS-06 | AGT-35 |
| OPS-07 | AGT-36 |
| OPS-08 | AGT-37 |
| OPS-09 | AGT-38 |
| OPS-10 | EXT-13 |
| OPS-11 | EXT-14 |
| OPS-12 | EXT-15, EXT-16, EXT-17, AGT-44 |
| OPS-13 | EXT-18 |
| OPS-14 | EXT-19 |
| OPS-15 | EXT-20 |
| OPS-16 | AGT-31, AGT-45 |
| OPS-17 | BIL-16 |
| OPS-18 | BIL-17, BIL-26 |
| OPS-19 | BIL-18 |
| OPS-20 | BIL-19 |
| OPS-21 | BIL-20, MIG-24 |
| OPS-22 | BIL-23 |
| OPS-23 | BIL-24 |
| OPS-24 | BIL-25 |
| OPS-25 | MIG-21, RUN-23 |
| OPS-26 | MIG-22, MIG-23 |
| OPS-27 | RUN-04, RUN-21 |
| OPS-28 | EXT-21 |
| OPS-29 | AUTHZ-22 |
| OPS-30 | RUN-22 |
| OPS-31 | TEN-01（M-6 は補助） |
| OPS-32 | AUD-12, RUN-16, SCH-24 |
| OPS-33 | RUN-17, RUN-18, EXT-24 |
| OPS-34 | AGT-32, RUN-19 |
| OPS-35 | RUN-20 |

