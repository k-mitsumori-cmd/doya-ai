# ドヤAI 本番移行前チェックリスト（統合ブランチ・2026-10-18）

CHECKLIST-2026-10-18.md（現行システム 740 項目）の続きです。
リニューアルの新しい枠と、追加サービス、本番移行の手順書を点検しました。

## 対象

- 統合ブランチ integrate/agent-renewal の 3e755c43（入れ直しの前の先頭）
- 追加サービス: 収入管理、支出管理、社内インタビュー、展示会、ポップアップ、質問リンク
- 新しい画面の枠（ds-shell、AppShell、ToolFrame、ナビ）と既存サービスへの影響
- 本番移行の手順書 PROD-MIGRATION-2026-10-18.md と、営業管理の読込修正 fix/sfa-load-20261017

統合ブランチは点検のあとに入れ直され、先頭が変わりました。
最終の先頭 d10a5c49 で、差分の見直し、ビルド、画面の確認をやり直しました（このあとの「最終の先頭（d10a5c49）での確認」と 13 章）。

最終の結論: d10a5c49 で S 級 0 件・A 級 0 件。前回の A 級 9 件は、解消したか、移行の手順（DB の反映と環境変数）で扱う項目です。

## 集計

| 章 | 分野 | 項目数 | S | A | 主な A 級 |
|---|---|---|---|---|---|
| 8 | 収入管理・支出管理 | 121 | 0 | 1 | 本番 DB への反映が未確認（手順書の段 1〜3 で反映する前提） |
| 9 | 社内インタビュー・展示会 | 118 | 0 | 1 | 展示会の画像生成の上限がプロセス内の変数だけ（環境変数が未設定なら止まる） |
| 10 | ポップアップ・質問リンク | 130 | 0 | 3 | 統合で公開状態が開発中に戻る恐れ（POP-083）。DB の列・表の反映確認 |
| 11 | 新しい画面の枠 | 120 | 0 | 1 | 枠の「ホーム」が /home を指すが、3e755c43 には /home が無い |
| 12 | 移行手順書・営業管理の修正 | 71 | 0 | 3 | 対象コミットのずれ、DDL の許可リスト、DDL の接続先（統括が修正済み） |
| 13 | 最終の先頭（d10a5c49）での見直し | 62 | 0 | 0 | 前回の A 級の解消を確認 |
| 合計 | | 622 | 0 | 9（3e755c43 時点）→ 0（d10a5c49） | |

- 10 章の A 級のうち 2 件は「本番 DB にあるか未確認」です。PopupSite.companyProfileId は、統括の説明では反映済みです。
- 各章の「不合格・要対応」に、B 級と C 級を担当の案つきで載せています。

## 観点

各章で、次の観点を確かめました。

- ログインと権限: 全 API のログイン確認、未ログインで開ける口とその守り、ロールの付与（同格の付与を拒否するか）
- テナント分離: [id] を取る API が、ユーザーまたは組織で照合しているか
- 課金と上限: 生成や作成の上限が API で強制されているか。有料でも無制限にしないか
- DB: 新しい表、既存の表への列追加、本番への反映の手順
- 画像: アップロードの検査、保存先が非公開か、署名 URL の期限、公開 URL を DB に保存していないか
- 画面: 読込・空・エラーの表示、無限ローディング、日本語・敬語、絵文字の禁止、375px と 1280px の破綻要因
- 公開ページ: 開発中の noindex、sitemap、公開状態の出し分け

## 最終の先頭（d10a5c49）での確認

| ID | 項目 | 確認方法 | 合格条件 | 結果 |
|---|---|---|---|---|
| FIN-001 | 差分の見直し | 3e755c43 と d10a5c49 の差分（ソース 80 ファイル）を、各章の観点で読む | 新しい S 級・A 級が無い | 合格（13 章。S 0・A 0） |
| FIN-002 | ビルド | build-slot.sh 経由で npm run build | 回帰テスト、tsc、next build がすべて通る | 合格（d10a5c49、終了コード 0） |
| FIN-003 | /home と枠のリンク | 手元のサーバーで /home を開く | 404 にならない | 合格（未ログインは 307 で /auth/signin?callbackUrl=/home へ。src/app/home がある） |
| FIN-004 | ポップアップの公開状態 | services.ts、popup/layout.tsx を読む | origin/main と同じく公開（noindex なし） | 合格（origin/main 142e29b4 と一致） |
| FIN-005 | 375px の表示 | 手元のサーバーで /、/auth/signin、/popup、/shanai、/tenjikai、/income、/expense を幅 375px で開き、scrollWidth を測る | 横スクロールが出ない。文字が切れない | 合格（すべて scrollWidth 375） |
| FIN-006 | 1280px の表示 | /income、/popup、/shanai を幅 1280px で開く | 枠とナビが崩れない | 合格。ただし収入管理・支出管理・展示会の LP で「使い方」の画面キャプチャ（public/<id>/shots/）が無く、代替テキストが出る（B） |
| FIN-007 | /popup の配色 | /popup/layout.tsx を読み、手元で /popup を開く | class に undefined が入らない（SHL-098） | 合格（tokens.module.css を直接読む形に修正済み） |
| FIN-008 | /tenjikai の未ログイン表示 | 手元で未ログインのまま /tenjikai を開く | ログインに誘導される（SHL-015） | 不合格（B）。枠とタブが出る。API は 401 で守られている |

---

## 8. 収入管理・支出管理

対象: 統合ブランチ `integrate/agent-renewal` の 3e755c43（`(統合ブランチの点検用 worktree)/`）。origin/main との差分のうち、`src/app/income`、`src/app/expense`、`src/app/api/income`、`src/app/api/expense`、`src/lib/income`、`src/lib/expense`、`src/components/income`、`src/components/expense`、`prisma/schema.prisma`、`vercel.json`、`src/app/api/cron/{income,expense}-schedule` を読んだ。
方法: ソースの静的な読み取りだけ。ビルド・テスト・DB・本番・外部 API には触れていない。根拠の file:line は対象リポジトリの相対パス。
結果の見方: 「未確認」は本番の設定や DB を見ないと確かめられないもの。推測で合格にしていない。

### 8.1 ドヤ収入管理（income）

| ID | 項目 | 確認方法 | 合格条件 | 結果 | 根拠 |
|---|---|---|---|---|---|
| INC-001 | 全 API ルートがログイン確認を通る | `src/app/api/income/**/route.ts` の全ハンドラを読む | すべて `withIncome` を経由し、未ログインは 401 | 合格 | src/lib/income/route.ts:10-23、src/lib/income/access.ts:43-51・75-78。21 ルート（clients, contracts, invoices, issuer, organization, payments, revenue, summary）すべて `return withIncome(` |
| INC-002 | 未ログインで叩ける API の一覧 | `withIncome` を通らないハンドラを探す | 無い（cron を除く） | 合格 | src/lib/income/scope.test.ts:52-60 が全ハンドラの `withIncome` 使用を静的検査。手で読んでも例外なし |
| INC-003 | ログイン済み・組織の所属なしの扱い | `getIncomeContext` を読む | 初回アクセスで自分の組織を 1 つ作る。二重作成しない | 合格 | src/lib/income/access.ts:53-73（`SELECT ... FOR UPDATE` で User 行をロックしてから作成。無効化済みの所属がある人には作らない） |
| INC-004 | 組織の切り替え（`?org=` / `x-income-org`）の偽装 | `orgSlugFrom` と membership の照合を読む | 指定した slug に自分の ACTIVE 所属が無ければ 403。別組織へ勝手に切り替えない | 合格 | src/lib/income/access.ts:27-41・79-91（`where: { userId, status: 'ACTIVE', role: {in}, organization: { slug } }`、`if (slug && !membership) return null`）、route.ts:13-16 で 403 |
| INC-005 | ロール判定の実装 | `hasMinRole` を読む | 未知のロールは false。`hasOwnProperty` で prototype 汚染を避ける | 合格 | src/lib/income/roles.ts:2-7 |
| INC-006 | [id] 系ルートの組織照合（取引先） | GET/PATCH/DELETE を読む | `findFirst({ where: { id, organizationId } })` を通してから更新・削除 | 合格 | src/app/api/income/clients/[id]/route.ts:14-15・30-33・43-54 |
| INC-007 | [id] 系ルートの組織照合（契約） | GET/PATCH/DELETE と `saveContract` を読む | 同上。更新時は取引先も自組織か確認 | 合格 | src/app/api/income/contracts/[id]/route.ts:13-14・41-45、src/lib/income/contracts.ts:128-129・148-149 |
| INC-008 | [id] 系ルートの組織照合（請求書） | GET/PATCH/DELETE/confirm/send/void を読む | 同上 | 合格 | src/app/api/income/invoices/[id]/route.ts:14-15、src/lib/income/invoices.ts:103-108・178-181・186-192 |
| INC-009 | [id] 系ルートの組織照合（入金・消込） | allocate/unallocate/deletePayment を読む | 入金・請求書の両方を自組織で照合 | 合格 | src/lib/income/payments.ts:31・39・55-57・66 |
| INC-010 | [id] 系ルートの組織照合（売上予定 skip） | PATCH を読む | 条件付き `updateMany({ where: { id, organizationId, status } })` | 合格 | src/app/api/income/revenue/[id]/route.ts:19-22 |
| INC-011 | 請求書の明細に他組織の売上予定を付けられないか | `claimSchedules` を読む | `updateMany` に organizationId と clientId と status='planned' を含め、件数不一致なら 409 | 合格 | src/lib/income/invoices.ts:55-64 |
| INC-012 | 消込の請求書 ID に他組織の請求書を指定できないか | `allocate` を読む | 請求書を `findFirst({ id, organizationId })` で引く | 合格 | src/lib/income/payments.ts:39-40 |
| INC-013 | 監査ログの組織分離 | `audit` を読む | 書き込みは ctx.organizationId 固定。読み取り API は無い | 合格 | src/lib/income/access.ts:135-147 |
| INC-014 | 支出の取り込み元（プロマネ・支出管理）を他社に結べないか | organization PATCH を読む | `canRead(userId, refId)` で自分が読める相手だけ。読むたびに再確認 | 合格 | src/app/api/income/organization/route.ts:40・51、src/lib/income/expense-source.ts:57-63・153-156、src/lib/expense/income-source.ts:54-60 |
| INC-015 | IDOR の静的検査テストがビルドに組み込まれているか | package.json を読む | `npm run build` で `test:income` が走る | 合格 | package.json:11・21、src/lib/income/scope.test.ts:62-90 |
| INC-016 | メンバー管理 API とロール付与 | `src/app/api/income` に members ルートがあるか | 無い（Phase1 は組織 = 本人のみ） | 該当なし | `find src/app/api/income -name route.ts` に members 無し。schema.prisma:5011-5028 の IncomeMember は owner 1 人を access.ts:68-70 で作るだけ |
| INC-017 | 操作ごとの最小ロール | 各ルートの `withIncome(req, ROLE` を読む | 閲覧・下書き=member、確定・送付・入金・消込・削除=manager、取消・設定=admin | 合格 | invoices/[id]/confirm:11、send:13、void:12（admin）、payments/route.ts:42、payments/[id]/allocate:13・29、clients/[id]:41、contracts/[id]:38、issuer:18（admin）、organization:32（admin） |
| INC-018 | 金額の型 | schema と計算を読む | すべて Int（円）。浮動小数を使わない | 合格 | prisma/schema.prisma:5120・5147-5148・5167・5194-5198・5258・5286、src/lib/income/tax.ts:6・30-35 |
| INC-019 | 消費税の端数処理 | `computeInvoiceTotals` を読む | 請求書 1 枚につき税率ごとに 1 回、切り捨て（インボイス要件） | 合格 | src/lib/income/tax.ts:37-56、calc.test.ts（存在。実行はしていない） |
| INC-020 | 金額の上限と整数検査 | `parse.int` / `lineAmount` を読む | `Number.isSafeInteger`、上限 10 億円、数量 10 万まで | 合格 | src/lib/income/parse.ts:31-43・81-97、tax.ts:27-35・53-54 |
| INC-021 | 請求書番号の採番の原子性 | `confirmInvoice` と呼び出し側を読む | 複合主キーの upsert（increment）を Serializable で実行し、P2034 は 1 回やり直す。`@@unique([organizationId, invoiceNo])` で重複を止める | 合格 | src/lib/income/invoices.ts:154-160、src/app/api/income/invoices/[id]/confirm/route.ts:15-23、schema.prisma:5222・5244-5251。備考: 年初の初回同時確定で P2002 が出た場合はやり直さない（INC-F03） |
| INC-022 | 消込の二重計上防止 | `allocate` / `recomputeInvoicePaid` を読む | 入金額＋手数料 ≧ 消込合計、請求書残高以内、paidAmount は集計から数え直す、`@@unique([paymentId, invoiceId])` | 合格 | src/lib/income/payments.ts:12-15・33-49、schema.prisma:5291 |
| INC-023 | 同じ売上予定の二重請求防止 | `draftFromSchedules` / `claimSchedules` を読む | 重複 ID を 400、状態遷移を条件付き更新で押さえる、`IncomeInvoiceItem.scheduleId @unique` | 合格 | src/lib/income/invoices.ts:57-64・207-215、schema.prisma:5232 |
| INC-024 | 確定後の請求書は編集不可 | `ownDraft` を読む | draft 以外の PATCH/DELETE は 409 | 合格 | src/lib/income/invoices.ts:103-108 |
| INC-025 | 取消は入金が付いていないときだけ | `voidInvoice` を読む | 消込が 1 件でもあれば 409 | 合格 | src/lib/income/invoices.ts:190-192 |
| INC-026 | 請求済みの月がある契約の削除・取引先変更 | contracts DELETE と saveContract を読む | 409 で止める | 合格 | src/app/api/income/contracts/[id]/route.ts:43-44、src/lib/income/contracts.ts:150-153 |
| INC-027 | 売上予定の同期で請求済み行を上書きしないか | `syncContractSchedule` を読む | status != planned は触らない。削除も planned だけ | 合格 | src/lib/income/contracts.ts:111-116・122 |
| INC-028 | 日付のタイムゾーン | dates.ts を読む | JST の暦日文字列で扱い、DB は UTC 0 時の @db.Date | 合格 | src/lib/income/dates.ts:88-101 |
| INC-029 | 課金・上限（契約・請求書・入金の件数上限） | `plan-limit` の参照を探す | 無料に上限があり、有料も無制限にしない | 不合格 | `grep plan-limit src/lib/income src/app/api/income` が 0 件。services.ts:1800-1803 は「開発中のため上限なし」。設計 docs/design/2026-10-18-doya-income/README.md:552（Q6: 開発中は上限なし）。→ INC-F02 |
| INC-030 | 従量課金 API（LLM 等）の呼び出し | `src/lib/income` で gemini/openai を探す | Phase1 に無い | 合格 | src/lib/income/dunning.ts:4（定型文）、agent-tools.ts:152-154（costClass none）。grep で LLM 呼び出し無し |
| INC-031 | 新モデルの必須列・一意制約・索引 | schema.prisma の Income* を読む | organizationId 索引、`@@unique([contractId, period])`、`@@unique([organizationId, invoiceNo])`、`@@unique([paymentId, invoiceId])`、`@@id([organizationId, year])` | 合格 | prisma/schema.prisma:5175-5177・5222-5224・5274-5276・5291・5249 |
| INC-032 | onDelete の挙動 | relation の onDelete を読む | 組織削除で配下が消える。取引先は契約・請求書・予定があると消せない（Restrict）。請求書は消込があると消せない（Restrict） | 合格 | schema.prisma:5014・5066・5099-5101・5161-5163・5184-5186・5233・5283-5285・5298・5319・5337。備考: IncomeInvoiceSequence はリレーション無しのため組織削除で残る（組織削除の経路は無い） |
| INC-033 | 既存モデルへの変更 | `git diff origin/main...HEAD -- prisma/schema.prisma` の削除行 | income 由来の既存列変更が無い | 合格 | 削除行 0。既存モデルの変更は `User.tenjikaiProjects`（tenjikai）と `PopupSite.companyProfileId`（popup）だけ |
| INC-034 | 本番 DB への db push（income_* 15 表） | 本番 DB を見る必要がある | 反映済み | 未確認 | 設計 README.md:573-575「Vercel のビルドは db push をしない。忘れると全 API が 500」。→ INC-F01 |
| INC-035 | 既存有料ユーザーの UserServiceSubscription の補完 | 本番 DB を見る必要がある | `backfill-new-service-subscriptions.ts --service=income` 済み | 未確認 | scripts/backfill-new-service-subscriptions.ts（存在）、src/lib/stripe.ts:229（ALL_SERVICE_IDS に income）、README.md:576 |
| INC-036 | Cron の認証 | income-schedule を読む | `CRON_SECRET` 未設定なら拒否、Bearer 一致のみ | 合格 | src/app/api/cron/income-schedule/route.ts:16-18 |
| INC-037 | Cron のパスにクエリ文字列が無い | vercel.json を読む | プレーンパス | 合格 | vercel.json:23-26（`/api/cron/income-schedule` 0 21 * * * = JST 6:00） |
| INC-038 | Cron の maxDuration と全組織走査の上限 | route を読む | maxDuration あり。走査件数に上限 | 合格 | src/app/api/cron/income-schedule/route.ts:3（300）・19（`take: 5000`）。備考: ページングは無く 5000 件を 1 回の実行で順に処理する（INC-F05） |
| INC-039 | Cron のメール・通知の重複防止 | income-schedule を読む | 通知を送らない（状態の書き換えもしない） | 該当なし | src/app/api/cron/income-schedule/route.ts:10-12（売上予定の補完だけ）。IncomeReminder（schema:5295-5314）は未使用 |
| INC-040 | Google カレンダー連携のトークン保存 | IncomeCalendarConnection の利用箇所を探す | 平文で保存しない | 該当なし | `grep incomeCalendarConnection src` が 0 件。schema.prisma:5316-5332 にモデルだけ（`refreshTokenEnc` 列を予約）。Phase1 は未実装（README.md:381-392） |
| INC-041 | 入力検証（不正 JSON・配列・型違い） | `readJson` / `asBody` / parse.ts を読む | 不正 JSON は null → 400。配列・非オブジェクトは 400。文字列長・範囲・日付の検査あり | 合格 | src/lib/income/route.ts:32-38、src/lib/income/parse.ts:10-13・15-25・49-57 |
| INC-042 | 業務エラーと想定外エラーの切り分け・ログの個人情報 | `errorResponse` を読む | IncomeError は 4xx、P2034 は 409、その他は 500 で中身を返さない。ログに message/stack を出さない | 合格 | src/lib/income/access.ts:126-133 |
| INC-043 | 一覧 API の件数上限 | findMany の take を読む | 請求書・入金は 300 件 | 合格 | src/app/api/income/invoices/route.ts:24、payments/route.ts:20。備考: payments の `openInvoices`（:22-26）と clients/contracts 一覧（clients/route.ts:12-17、contracts/route.ts:13-17）は take 無し（自組織のみ・開発中の規模では問題なし） |
| INC-044 | 画面: 読込・空・エラー・401・403・404 の出し分け | `Gate` / `useResource` / `fetchJson` を読む | 4 状態を表示。401 はログイン導線。無限ローディングにならない | 合格 | src/components/income/ui.tsx:86-116・134・165-173、src/components/income/ds.tsx:149（`/auth/signin?callbackUrl=`）。各ページで `Gate` 使用（Dashboard.tsx:120、payments/page.tsx:237、invoices/[id]/page.tsx:254 ほか） |
| INC-045 | 画面: 空状態の文面と導線 | Dashboard の Onboarding を読む | 3 ステップの案内と各リンク | 合格 | src/app/income/Dashboard.tsx:45-71・122-126 |
| INC-046 | 画面: 未ログイン時に LP を出し、アプリ枠で包まない | layout/page を読む | セッション無しは LP、ありは AppShell + ToolFrame | 合格 | src/app/income/layout.tsx:17-24、src/app/income/page.tsx:10-14 |
| INC-047 | 画面: 日本語・敬語・絵文字なし | 絵文字の正規表現で grep | UI 文字列に絵文字が無い。丁寧語 | 合格 | `grep -P '[\x{1F300}-\x{1FAFF}...]' src/app/income src/components/income` が 0 件。services.ts:1778（icon を空にして絵文字を出さない） |
| INC-048 | 画面: 危険操作の確認ダイアログ（alert/confirm 不使用） | invoices/[id] と payments を読む | 確定・送付・取消・削除は `ConfirmDialog`。取消は理由必須 | 合格 | src/app/income/invoices/[id]/page.tsx:192-244、payments/page.tsx:153-164 |
| INC-049 | 画面: 固定幅 px による横スクロールの要因 | `min-w-[` / `min-width` を grep | 375px でカード表示に切り替え、最小幅は 768px 以上だけ | 合格 | src/components/income/ds.module.css:701-709、InvoiceSheet.tsx:53（`min-w-0`）・92（表だけ `overflow-x-auto` 内で `min-w-[480px]`）。README.md:600-603 で 375px の目視済みと記載 |
| INC-050 | 画面: 設定で支出管理（expense）を取り込み元に選べるか | settings/page.tsx を読む | API が対応する `expenseSourceId: 'expense'` を画面から選べる | 不合格 | src/app/income/settings/page.tsx:140-147・84 はプロマネのみ。API 側は organization/route.ts:21-26・44-55 で expense に対応済み。Dashboard.tsx:140 の注記も「ドヤプロマネの記録」固定（API は `expense.note` を返す）。→ INC-F04 |
| INC-051 | 公開ページ: LP の noindex | layout の metadata を読む | 開発中は noindex | 合格 | src/app/income/layout.tsx:8-13（`noindex: true`）、pricing/layout.tsx:4（`robots.index: false`） |
| INC-052 | 公開ページ: services.ts の status と UNLISTED | services.ts を読む | `coming_soon` + `UNLISTED_SERVICE_IDS` に含まれ、sitemap に出ない | 合格 | src/lib/services.ts:1805-1806・1950・1956-1959、src/app/sitemap.ts:61-62・93-95（HIDDEN に UNLISTED を含む） |
| INC-053 | 公開ページ: LP の料金表記と実績値 | Lp.tsx / lp-data.ts を読む | 実績数値を書かない。料金は統一プランを参照 | 合格 | src/app/income/Lp.tsx:4・46、lp-data.ts:1・23（`UNIFIED_PRO_PRICE`） |
| INC-054 | 料金ページの現在プラン表示 | pricing/page.tsx を読む | ログイン中のプランを反映 | 不合格 | src/app/income/pricing/page.tsx:26（`currentPlan="FREE"` 固定）。→ INC-F06 |
| INC-055 | エージェント道具の登録と権限 | agent-tools.ts と参照箇所を読む | 道具ごとに `guard(ctx, minServiceRole)`、irreversible は承認必須。現時点で未登録 | 該当なし | src/lib/income/agent-tools.ts:39-41・134、`grep income/agent-tools src` が lib 以外 0 件（Phase0 で登録予定 :4） |
| INC-056 | ホーム・カレンダー向け読み取り関数の組織スコープ | summary-read / calendar-read を読む | すべて `organizationId: orgId` で絞る。期間は 400 日以内 | 合格 | src/lib/income/summary-read.ts:30-49・101-104、calendar-read.ts:15-31 |
| INC-057 | 督促文面の文体 | dunning.ts を読む | 敬語・絵文字なし・送信はしない | 合格 | src/lib/income/dunning.ts:5・43-49 |
| INC-058 | 振込先・登録番号の形式検査 | issuer PUT を読む | `T+13 桁`、文字列長の上限 | 合格 | src/app/api/income/issuer/route.ts:20-21・24-35 |

### 8.2 ドヤ支出管理（expense）

| ID | 項目 | 確認方法 | 合格条件 | 結果 | 根拠 |
|---|---|---|---|---|---|
| EXP-001 | 全 API ルートがログイン確認を通る | `src/app/api/expense/**/route.ts` の全ハンドラを読む | `withExpense` 経由。例外は usage GET と organization POST（本人確認あり） | 合格 | src/lib/expense/access.ts:79-100、src/app/api/expense/usage/route.ts:10-11、organization/route.ts:14-15。scope.test.ts:38-41 で例外 2 本を明示 |
| EXP-002 | 未ログインで叩ける口の一覧と妥当性 | 上記 2 本を読む | 401 を返し、組織のデータを返さない | 合格 | usage/route.ts:11（401）、organization/route.ts:15（401）。usage は本人の所属だけ（access.ts:53-62） |
| EXP-003 | 組織の切り替え（`?org=`）の偽装 | `withExpense` / `getExpenseContext` を読む | `?org=` 必須。自分の ACTIVE 所属が無ければ 403。別組織へ切り替えない | 合格 | src/lib/expense/access.ts:41-51・85-91。設計 README.md:590-596 で別ユーザー 403 を確認済みと記載（本番では未確認） |
| EXP-004 | ロール判定の実装 | `hasMinRole` / `isRole` を読む | 未知のロールは false | 合格 | src/lib/expense/access.ts:21・64-66、constants.ts:6-8 |
| EXP-005 | 操作ごとの最小ロール | 各ルートの `withExpense(req, ROLE` を読む | 閲覧=member、契約・取引先・支払状態=manager、設定・支払方法・為替・メンバー・削除=admin | 合格 | contracts/route.ts:43、contracts/[id]:37・62（DELETE admin）、vendors/route.ts:24、vendors/[id]:57・74（DELETE admin）、schedules/[id]:30・76、payment-methods/route.ts:20、fx-rates:21、members/route.ts:24、organization:49 |
| EXP-006 | 同格ロールの付与・剥奪（`>=` 比較） | members POST/PATCH/DELETE を読む | 自分と同じかそれ以上のロールの付与・変更・除外はできない | 不合格 | src/app/api/expense/members/route.ts:28（admin が `admin` を付与できる）、members/[id]/route.ts:30（owner 以外は無制限。admin が他の admin を member に降格できる）・43-47（admin が他の admin を除外できる）。→ EXP-F02 |
| EXP-007 | オーナーの保護 | members/[id] を読む | オーナーの付け外しはオーナーだけ。最後のオーナーを降格・除外できない | 合格 | src/app/api/expense/members/[id]/route.ts:18-21・30-31・43-46 |
| EXP-008 | メンバー追加で既存メンバーの権限を変えないか | members POST を読む | ACTIVE の既存メンバーは 409 | 合格 | src/app/api/expense/members/route.ts:31-33 |
| EXP-009 | メンバー追加でのメール存在確認 | members POST を読む | 任意のメールの登録有無が分からない | 不合格 | src/app/api/expense/members/route.ts:29-30（404「ドヤAIアカウントが見つかりません」）。admin 限定のため影響は小さい。→ EXP-F05 |
| EXP-010 | [id] 系の組織照合（契約・単価） | findContract / prices POST を読む | `findFirst({ id, organizationId })` を通してから更新。単価は確認済み契約の複合キー | 合格 | src/app/api/expense/contracts/[id]/route.ts:14-18・51、contracts/[id]/prices/route.ts:17-22 |
| EXP-011 | [id] 系の組織照合（取引先） | findVendor を読む | 同上 | 合格 | src/app/api/expense/vendors/[id]/route.ts:14-18・61・79 |
| EXP-012 | [id] 系の組織照合（支払予定） | findSchedule を読む | 同上 | 合格 | src/app/api/expense/schedules/[id]/route.ts:16-20・62・82 |
| EXP-013 | [id] 系の組織照合（支払方法・メンバー） | findMethod / target を読む | 同上 | 合格 | payment-methods/[id]/route.ts:13-17、members/[id]/route.ts:12-16 |
| EXP-014 | 契約作成時の取引先・支払方法の所属確認 | contracts POST/PATCH を読む | 他組織の vendorId / paymentMethodId を 404 で弾く | 合格 | src/app/api/expense/contracts/route.ts:50-51・57-59、contracts/[id]/route.ts:42-46 |
| EXP-015 | 監査ログの組織分離 | `audit` / import.ts を読む | 書き込みは ctx.organizationId 固定。読み取り API 無し | 合格 | src/lib/expense/access.ts:108-117、import.ts:67 |
| EXP-016 | IDOR の静的検査がビルドに組み込まれているか | package.json を読む | `test:expense` がビルドで走る | 合格 | package.json:11・22、src/lib/expense/scope.test.ts:49-86 |
| EXP-017 | 振込先口座の閲覧権限 | dto.ts / upcoming を読む | manager 以上にだけ返す。一覧・詳細・upcoming とも | 合格 | src/lib/expense/dto.ts:10-27、expense-read.ts:110-112、src/app/api/expense/upcoming/route.ts:14、scope.test.ts:93-97 |
| EXP-018 | Slack Webhook URL の秘匿 | organization GET を読む | admin 以上にだけ返す。他は `hasSlack` のみ | 合格 | src/app/api/expense/organization/route.ts:38-40 |
| EXP-019 | 振込先口座番号の保存形式 | schema と inputs を読む | 暗号化または最小化 | 不合格 | prisma/schema.prisma:5414-5418（平文の String）、src/lib/expense/inputs.ts:31-36。収入側の自社口座（IncomeIssuer）も同じ。→ EXP-F06 |
| EXP-020 | 金額の型 | schema と plan.ts を読む | Int（円。USD はセント）。端数は切り捨て | 合格 | prisma/schema.prisma:5497・5524-5528、src/lib/expense/plan.ts:5・106-118 |
| EXP-021 | 通貨換算（ExpenseFxRate） | fx-rates PUT / plan.ts / sync.ts を読む | Decimal(12,4) で保存、未設定なら契約を飛ばして 400（FX_RATE_MISSING）。換算後に 1 回だけ丸める | 合格 | src/app/api/expense/fx-rates/route.ts:25-27、plan.ts:55-60・150-155、sync.ts:38-46、access.ts:95-96。備考: `Number(r.rate)` で倍精度に戻してから掛ける（4 桁小数のため実用上の誤差なし） |
| EXP-022 | 消費税・源泉税の計算 | splitTax / withholdingFor を読む | 税込→税抜の逆算と税抜→税の計算が切り捨て。源泉は 100 万円以下 10.21%、超過 20.42% | 合格 | src/lib/expense/plan.ts:106-118、withholding.ts:10-14。calc.test.ts（存在。実行はしていない） |
| EXP-023 | 金額の範囲検査 | validate.money / int を読む | 0〜999,999,999 の整数 | 合格 | src/lib/expense/validate.ts:21-27・60 |
| EXP-024 | 支払予定の二重作成防止 | sync.ts と schema を読む | `@@unique([contractId, period])`。cron が何度走っても period ごとに 1 行 | 合格 | src/lib/expense/sync.ts:5・92-121、prisma/schema.prisma:5545 |
| EXP-025 | 請求書受領以降の実額を予定で上書きしないか | syncContractSchedules を読む | status=planned の行だけ金額を書き換える | 合格 | src/lib/expense/sync.ts:113-118 |
| EXP-026 | 源泉税の納付予定の再集計 | syncWithholding を読む | 支払済みの納付行は触らない。対象が無くなった未払い行は消す | 合格 | src/lib/expense/sync.ts:125-163 |
| EXP-027 | 支払済みの金額変更の禁止 | schedules PATCH を読む | paid→paid で金額変更は 409 | 合格 | src/app/api/expense/schedules/[id]/route.ts:42-44 |
| EXP-028 | 支払済み・契約由来の予定の削除禁止 | schedules DELETE を読む | one_time 以外は 400、paid は 409 | 合格 | src/app/api/expense/schedules/[id]/route.ts:79-80 |
| EXP-029 | 他ツールからの取り込みの冪等性 | import.ts と schema を読む | `@@unique([organizationId, sourceType, sourceId])`、P2002 は既存行を返す | 合格 | src/lib/expense/import.ts:43-44・71-77、prisma/schema.prisma:5546 |
| EXP-030 | 組織作成の冪等性と slug の重複 | createOrganization / setup.ts を読む | 既存の ACTIVE 所属があれば返す。slug は ASCII のみ、重複は時刻を足す。Serializable で 3 回まで再試行 | 合格 | src/lib/expense/access.ts:120-141、setup.ts:19-46 |
| EXP-031 | 課金・上限（契約・取引先・メンバーの件数上限） | `plan-limit` の参照を探す | 無料に上限があり、有料も無制限にしない | 不合格 | `grep plan-limit src/lib/expense src/app/api/expense` が 0 件。services.ts:1843-1846「開発中のため制限なし」。設計 docs/design/2026-10-18-doya-expense/README.md:568（Q7: 公開時に 契約 10 件 / AI 10 回を入れる）。→ EXP-F01 |
| EXP-032 | 従量課金 API（LLM 等）の呼び出し | `src/lib/expense` で gemini/openai を探す | Phase1 に無い | 合格 | 設計 README.md:590-593（請求書 PDF 読み取りは Phase2）。grep で LLM 呼び出し無し |
| EXP-033 | 新モデルの必須列・一意制約・索引 | schema.prisma の Expense* を読む | organizationId 索引、`@@unique([organizationId, userId])`、`@@unique([contractId, effectiveFrom])`、`@@id([organizationId, month, currency])`、reminders の 5 列一意 | 合格 | prisma/schema.prisma:5398-5399・5430-5432・5507・5545-5549・5607・5625 |
| EXP-034 | onDelete の挙動 | relation の onDelete を読む | 組織削除で配下が消える。取引先は契約があると消せない（Restrict）。契約削除で実績行は contractId=null で残る（SetNull） | 合格 | prisma/schema.prisma:5394・5424・5479-5481・5504・5539-5540・5572・5589-5590・5604・5622・5638。contracts/[id]/route.ts:65-69 で planned だけ先に消す |
| EXP-035 | 既存モデルへの変更 | schema diff の削除行 | expense 由来の既存列変更が無い | 合格 | 削除行 0（INC-033 と同じ） |
| EXP-036 | 本番 DB への db push（expense_* 11 表） | 本番 DB を見る必要がある | 反映済み | 未確認 | 設計 README.md:618-620「実行前に利用者の確認を取る」。→ EXP-F03（INC-F01 と同じ作業） |
| EXP-037 | 既存有料ユーザーの UserServiceSubscription の補完 | 本番 DB を見る必要がある | backfill 済み | 未確認 | src/lib/stripe.ts:229（ALL_SERVICE_IDS に expense）、scripts/backfill-new-service-subscriptions.ts |
| EXP-038 | Cron の認証 | expense-schedule を読む | `CRON_SECRET` 未設定なら拒否、Bearer 一致のみ | 合格 | src/app/api/cron/expense-schedule/route.ts:13-17、scope.test.ts:88-91 |
| EXP-039 | Cron のパスにクエリ文字列が無い | vercel.json を読む | プレーンパス | 合格 | vercel.json:27-30（`/api/cron/expense-schedule` 0 22 * * * = JST 7:00） |
| EXP-040 | 本番の `CRON_SECRET` 環境変数 | Vercel の設定を見る必要がある | 設定済み | 未確認 | 設計 README.md:621 に確認項目として記載。既存 cron と共通 |
| EXP-041 | Cron の maxDuration と全組織走査の上限 | route と sync.ts を読む | maxDuration あり。走査件数に上限・ページング | 不合格 | src/app/api/cron/expense-schedule/route.ts:9（300）・18（`findMany` に take 無し）、sync.ts:174-187（契約ごとに個別トランザクション）。組織数が増えると 300 秒を超えて途中で止まる。→ EXP-F04 |
| EXP-042 | Cron の通知の重複防止 | notify.ts を読む | reminders の一意制約で同じ対象・同じ期日は 1 回だけ | 合格 | src/lib/expense/notify.ts:37-44、prisma/schema.prisma:5625。備考: Slack 送信に失敗すると `notifiedAt` が null のまま残り、翌日も再送しない（EXP-F04 に併記） |
| EXP-043 | Slack 通知先の SSRF 対策 | validate.slackWebhook を読む | `https://hooks.slack.com/services/` だけ許す。タイムアウト 10 秒 | 合格 | src/lib/expense/validate.ts:71-77、notify.ts:50、scope.test.ts:99-102 |
| EXP-044 | 通知文面の文体 | notify.ts を読む | 丁寧語・絵文字なし | 合格 | src/lib/expense/notify.ts:6・48-49 |
| EXP-045 | 外部連携（Google カレンダー等） | expense 配下を探す | 無い | 該当なし | `listCalendarEvents` は読み取り専用（expense-read.ts:118-126）。OAuth トークンの保存は無い |
| EXP-046 | 入力検証（不正 JSON・配列・型違い） | readJson / validate.ts / inputs.ts を読む | 不正 JSON・配列は 400。選択肢は定数で検査。日付は YYYY-MM-DD | 合格 | src/lib/expense/access.ts:102-106、validate.ts:12-54、inputs.ts:43-72 |
| EXP-047 | 業務エラーと想定外エラーの切り分け・ログ | withExpense の catch を読む | ExpenseHttpError は 4xx、FxRateMissing は 400、その他は 500 で中身を返さない。ログは path と name だけ | 合格 | src/lib/expense/access.ts:93-98 |
| EXP-048 | 一覧 API の件数上限 | findMany の take を読む | 契約詳細の予定 36 件、取引先詳細 60 件、upcoming は 1〜120 日に制限 | 合格 | contracts/[id]/route.ts:29、vendors/[id]/route.ts:34、expense-read.ts:92。備考: schedules 月次・contracts 一覧は take 無し（自組織・月単位） |
| EXP-049 | 画面: 読込・空・エラー・権限なしの出し分け | useExpenseQuery / ErrorBox / 各ページを読む | 4 状態。403 は `forbidden` フラグで判定し、文面では判定しない | 合格 | src/components/expense/api.ts:35-69、ui.tsx:171-177、各ページ（payables:148、contractors:56、contracts:41、forecast:46、[orgSlug]/page.tsx:50-51） |
| EXP-050 | 画面: 401 時のログイン誘導 | [orgSlug]/layout.tsx と Entry.tsx を読む | 401 は `/expense`（LP）へ戻し、LP の CTA がログイン | 合格 | src/app/expense/[orgSlug]/layout.tsx:26-29、Entry.tsx:38-41（`startGoogleSignIn`）、Lp.tsx:10・21 |
| EXP-051 | 画面: 読込失敗（500）の表示 | [orgSlug]/layout.tsx を読む | 通信エラーと権限なしを区別する | 不合格 | src/app/expense/[orgSlug]/layout.tsx:30-37（`d.role` が無ければすべて `denied` = 権限なし表示。usage が 500 のときも「権限がありません」と出る）。→ EXP-F07 |
| EXP-052 | 画面: 権限で操作ボタンを出し分ける | 各ページの canManage / canAdmin を読む | member には登録・更新ボタンを出さない。設定は admin 以上 | 合格 | src/app/expense/[orgSlug]/settings/page.tsx:7-8、contracts/new/page.tsx:12-15、payables/page.tsx:70・136・160、src/lib/expense/nav.ts:19・23-28 |
| EXP-053 | 画面: 危険操作の確認ダイアログ（alert/confirm 不使用） | useConfirm を読む | 画面内ダイアログで確認 | 合格 | src/components/expense/ui.tsx:179-200、payables/page.tsx:89-90、SettingsSections.tsx:92・234 |
| EXP-054 | 画面: 日本語・敬語・絵文字なし | 絵文字の正規表現で grep | UI 文字列に絵文字が無い | 合格 | `grep -P` が 0 件。services.ts:1823（icon 空） |
| EXP-055 | 画面: 固定幅 px による横スクロールの要因 | `min-w-[` を grep | 375px はカード表示（`block`）。最小幅は md 以上だけ。グラフは `overflow-x-auto` の中 | 合格 | src/components/expense/ui.tsx:122-132（`md:min-w-[1100px]` と `md:overflow-x-auto`）、CashBars.tsx:25-26、payables/page.tsx:171・176（`md:min-w-[...]`） |
| EXP-056 | 画面: 未ログイン時に LP を出す | page.tsx / layout.tsx を読む | セッション無しは LP | 合格 | src/app/expense/page.tsx:7-11、layout.tsx:11-13 |
| EXP-057 | 公開ページ: LP の noindex | layout の metadata を読む | 開発中は noindex | 合格 | src/app/expense/layout.tsx:4-9（`noindex: true`）、pricing/layout.tsx:4 |
| EXP-058 | 公開ページ: services.ts の status と UNLISTED | services.ts を読む | `coming_soon` + UNLISTED。sitemap に出ない | 合格 | src/lib/services.ts:1848-1849・1950・1956-1959、src/app/sitemap.ts:61-62・93-95 |
| EXP-059 | 公開ページ: LP の料金表記と実績値 | Lp.tsx を読む | 実績数値を書かない。「現在開発中」と明記 | 合格 | src/app/expense/Lp.tsx:27 |
| EXP-060 | 料金ページの現在プラン表示 | pricing/page.tsx を読む | ログイン中のプランを反映 | 不合格 | src/app/expense/pricing/page.tsx:27（`currentPlan="FREE"` 固定）。→ INC-F06 と同じ |
| EXP-061 | 収入側への受け渡し（ExpenseSource 'expense'）の権限 | income-source.ts と income/expense-source.ts を読む | 操作者が支出側の ACTIVE メンバーのときだけ読める。読むたびに確認 | 合格 | src/lib/expense/income-source.ts:54-66、src/lib/income/expense-source.ts:132-135・153-156 |
| EXP-062 | 収入側の粗利計算で源泉税の行を二重に数えないか | aggregate.monthlyExpenses を読む | withholding_tax と skipped は除外。計上月は period で集計 | 合格 | src/lib/expense/aggregate.ts:5・62-63 |
| EXP-063 | 自組織以外のメンバー情報の漏えい | members GET を読む | 自組織の ACTIVE メンバーの氏名・メール・ロールだけ | 合格 | src/app/api/expense/members/route.ts:13-17 |

### 不合格・要対応

重大度: S=他組織のお金のデータが見える・操作できる、ログイン不能、全体停止 / A=本番移行を止めるべき重大リスク / B / C

S 級・A 級の「コードの不具合」は見つからなかった。A 級は本番移行の手順（DB 反映）が未確認であることによる。

| ID | 重大度 | 現象と再現条件 | 該当箇所 | 修正案 | 安全に直せるか |
|---|---|---|---|---|---|
| INC-F01（INC-034 / EXP-036） | A | 本番 Supabase に `income_*` 15 表・`expense_*` 11 表が無いまま main に入ると、両サービスの全 API と cron（毎朝 2 本）が P2021 で 500 になる。Vercel のビルドは db push をしない。他サービスには影響しない | prisma/schema.prisma:4981-5347・5355-5643、docs/design/2026-10-18-doya-income/README.md:573-577、docs/design/2026-10-18-doya-expense/README.md:618-621 | main へ push する前に `doya-db-push` の手順で承認を取ってから反映する。反映後に `scripts/backfill-new-service-subscriptions.ts --service=income` / `--service=expense` を件数確認のうえ `--apply` | 手順の実行だけ。コード変更は不要。DB 操作のため実行前に対象（本番 DB）と差分を必ず確認する |
| INC-F02（INC-029） | B | ログイン済みなら誰でも、取引先・契約・請求書・入金を件数の上限なく作れる。無料・有料とも制限が無い（設計 Q6 は「開発中は上限なし」）。UNLISTED でも API は到達できるため、放置すると DB の肥大・濫用の口になる | src/app/api/income/clients/route.ts:22-28、contracts/route.ts:22-28、invoices/route.ts:30-36、payments/route.ts:41-58（いずれも上限確認なし） | 公開前に `plan-limit.ts` へ income の枠（例: 無料は取引先 5 件・契約 10 件、プロは契約 100 件）を足し、POST の先頭で件数を数えて 402/403 を返す。開発中の間は少なくとも 1 組織あたりの上限（例: 契約 200 件）を定数で置く | 直せる。追加のみで既存の動きは変わらない |
| EXP-F01（EXP-031） | B | INC-F02 と同じ。契約・取引先・単発支出・メンバーの件数上限が無い（設計 Q7 は公開時に 契約 10 件 / Pro 無制限 と記載。有料でも無制限にしない方針と食い違う） | src/app/api/expense/contracts/route.ts:42-77、vendors/route.ts:23-31、schedules/route.ts:41-70、members/route.ts:23-40 | 公開前に `plan-limit.ts` へ expense の枠を足す。Pro も上限を置く（例: 契約 300 件） | 直せる。追加のみ |
| EXP-F02（EXP-006） | B | admin が他の admin を member に降格・除外できる。admin が新規メンバーを admin で追加できる。owner だけが守られていて、同格（admin 同士）の比較が無い。再現: admin A が `PATCH /api/expense/members/{adminB}?org=` `{ role: 'member' }` | src/app/api/expense/members/route.ts:28、members/[id]/route.ts:30・43-47 | PATCH/DELETE で `ROLE_RANK[m.role] >= ROLE_RANK[ctx.role] && ctx.role !== 'owner'` なら 403。POST/PATCH で付与するロールも `ROLE_RANK[role] >= ROLE_RANK[ctx.role]`（owner を除く）なら 403。UI（SettingsSections.tsx:256-263）も同じ条件で disabled にする | 直せる。条件追加のみ。owner の操作は変わらない |
| EXP-F03（EXP-036） | A | INC-F01 と同じ作業（expense_* 11 表） | 同上 | 同上 | 同上 |
| EXP-F04（EXP-041 / EXP-042） | C | cron が全組織を上限なく順に処理する。組織数が増えると 300 秒を超え、後ろの組織の予定補完と通知が止まる。Slack 送信に失敗した通知は `notifiedAt` が null のまま残り、翌日も再送しない | src/app/api/cron/expense-schedule/route.ts:18-30、src/lib/expense/sync.ts:174-187、notify.ts:37-56。収入側 income-schedule/route.ts:19 も `take: 5000` を 1 回で処理 | `findMany` に `take` と `updatedAt`/`id` のカーソルを付け、残りを次回に回す。通知は「作成したが未送信（`notifiedAt: null` かつ 24 時間以内）」も `fresh` に含めて再送する | 直せる。現在の組織数（開発中）では発生しないため優先度は低い |
| INC-F03（INC-021 備考） | C | 年の最初の請求書を 2 人が同時に確定すると、採番表の行がまだ無いため upsert の片方が P2002（一意制約）で落ちることがある。呼び出し側は P2034 だけやり直すので、片方が 500 になる。再度押せば通る | src/lib/income/invoices.ts:154-158、src/app/api/income/invoices/[id]/confirm/route.ts:20 | `confirm/route.ts:20` の再試行条件に `P2002` を足す。または採番表の行を組織作成時に作る | 直せる。1 行の条件追加 |
| INC-F04（INC-050） | C | 収入側の設定画面から、支出の取り込み元に「ドヤ支出管理」を選べない（プロマネだけ）。API は対応済みなので画面の取り残し。粗利の注記も「ドヤプロマネの記録」固定で、expense を結んだ組織に誤った説明が出る | src/app/income/settings/page.tsx:140-147・84、Dashboard.tsx:140 | 設定画面で `expenseSources`（organization GET が返す）から取り込み元と相手を選び、`{ expenseSourceId, expenseRefId }` で PATCH する。注記は API の `expense.note` を表示する | 直せる。画面のみ |
| INC-F05（INC-038） | C | income cron は `take: 5000` を 1 回の実行で順に処理する。契約が増えると 300 秒を超える | src/app/api/cron/income-schedule/route.ts:19-30 | EXP-F04 と同じ（カーソルで分割） | 直せる |
| INC-F06（INC-054 / EXP-060） | C | 料金ページの現在プランが常に「無料」表示。プロ契約中の利用者にも「無料プラン」と出る | src/app/income/pricing/page.tsx:26、src/app/expense/pricing/page.tsx:27 | 他サービスの料金ページと同じく、セッションのプランを取得して `currentPlan` に渡す | 直せる。表示のみ |
| EXP-F05（EXP-009） | C | admin がメールアドレスを入れると、ドヤAI に登録済みかどうかが 404 / 成功で分かる（メールの存在確認） | src/app/api/expense/members/route.ts:29-30 | 未登録でも同じ文面（「招待を受け付けました」等）を返し、実際の追加は本人のログイン時に行う。または admin 限定のまま回数制限を付ける | 直せる。文面と流れの変更 |
| EXP-F06（EXP-019） | C | 取引先の振込先口座番号・名義が平文で DB に入る（収入側の自社口座も同じ）。DB の読み取り権限を持つ人・バックアップから見える | prisma/schema.prisma:5414-5418・5045-5050、src/lib/expense/inputs.ts:31-36 | 公開前に `bankAccountNo` をアプリ側で暗号化して保存する（IncomeCalendarConnection.refreshTokenEnc と同じ方針）か、口座番号は下 4 桁だけ持つ運用にする | 直せるが移行（既存行の暗号化）が要る。開発中でデータが少ない今が直しやすい |
| EXP-F07（EXP-051） | C | `/api/expense/usage` が 500 や通信失敗のとき、組織画面が「権限がありません」と表示する（本当は読み込み失敗） | src/app/expense/[orgSlug]/layout.tsx:30-37 | `r.ok` でない場合は `error` 状態にして `ErrorBox`（再試行付き）を出し、`r.ok` かつ `role` 無しのときだけ `denied` にする | 直せる。画面のみ |

### 補足（合格だが運用で押さえること）

- 両サービスとも、ログイン済みの利用者が初回アクセスで自分の組織を作る（income は自動、expense はフォーム）。開発中（UNLISTED）でも URL を知っていれば使えるため、INC-F02 / EXP-F01 の上限は公開前に必ず入れる。
- 収入側の `IncomeReminder`・`IncomeCalendarConnection`・`IncomePayment.externalKey`（CSV 取込）、支出側の `ExpenseBill` / `ExpenseBillLine`（請求書 PDF）は表だけで未使用。Phase2 で使うときに、この章の INC-040（トークンの暗号化）と EXP-019 を再点検する。
- 収入側のエージェント道具（`INCOME_AGENT_TOOLS`）は定義のみで未登録。登録時に `requiresApproval`（issueInvoice は常に true）と `guard` が効いているかを再点検する。


---

## 9. 社内インタビュー・展示会

対象: `(統合ブランチの点検用 worktree)/`（integrate/agent-renewal の 3e755c43）。読み取りのみで点検した。本番・DB・外部 API には触れていない。
根拠の `file:line` は対象リポジトリからの相対パス。`seo/lib/gemini.ts` は `@seo/lib/gemini` の実体。

集計: 項目 118（SHN 74・TNJ 44）。結果の内訳は合格 92・不合格 21・未確認 4・該当なし 1。不合格・要対応は 18 件（複数 ID をまとめた行を含む）で、重大度は S 0・A 1・B 9・C 8。

### 9.1 ドヤ社内インタビュー（shanai）

| ID | 項目 | 確認方法 | 合格条件 | 結果 | 根拠 |
|---|---|---|---|---|---|
| SHN-001 | 担当者向け API の全ハンドラでログイン確認 | `src/app/api/shanai/**` の全 route.ts で `getShanaiUserId()` の呼び出しを確認 | public 以外の全ハンドラが未ログインで 401 | 合格 | src/lib/shanai/access.ts:16-32、src/app/api/shanai/interviews/route.ts:17-18,28-29、src/app/api/shanai/company/route.ts:16-17,28-29、src/app/api/shanai/usage/route.ts:9-10 ほか全 16 ハンドラ |
| SHN-002 | 未ログインで叩ける口の一覧 | `grep -L getShanaiUserId` で抽出 | 公開アンケート（GET/PUT/POST `/api/shanai/public/survey/[token]`）だけ | 合格 | src/app/api/shanai/public/survey/[token]/route.ts:1-5,30,55,70 |
| SHN-003 | 公開アンケートのトークンの推測困難性 | token.ts の生成と検証を確認 | CSPRNG で 128 ビット以上。cuid を使わない | 合格 | src/lib/shanai/token.ts:8-14（randomBytes(24)=192 ビット、base64url 32 文字）、prisma/schema.prisma:5761-5762 |
| SHN-004 | トークンの形式検証 | public route の findByToken を確認 | 形式外は DB を引かずに 404 | 合格 | src/app/api/shanai/public/survey/[token]/route.ts:22-28、src/lib/shanai/token.ts:12-14 |
| SHN-005 | トークンの失効手段 | rotateToken の実装を確認 | 担当者が作り直せる。提出後は書き込み不可 | 合格 | src/app/api/shanai/interviews/[id]/survey/route.ts:47-50、src/app/api/shanai/public/survey/[token]/route.ts:60,75 |
| SHN-006 | トークンの有効期限 | ShanaiInterview に期限列があるか | 一定期間で失効する | 不合格 | prisma/schema.prisma:5761-5764 に期限列なし。public route は提出済みかだけを見る（src/app/api/shanai/public/survey/[token]/route.ts:60,75） |
| SHN-007 | 公開アンケートの権限範囲 | GET の返却内容を確認 | 本人名・会社名・設問・回答のみ。提出後は回答を返さない | 合格 | src/app/api/shanai/public/survey/[token]/route.ts:35-48 |
| SHN-008 | 公開アンケートの noindex | 応答ヘッダと layout を確認 | X-Robots-Tag と robots meta の両方 | 合格 | src/app/api/shanai/public/survey/[token]/route.ts:19、src/app/shanai/answer/[token]/layout.tsx:4-7 |
| SHN-009 | 公開アンケートからの AI 呼び出し回数 | followups の上限を確認 | 1 インタビューあたりの上限がある。競合しても超えない | 合格 | src/lib/shanai/survey-service.ts:11,20-23（updateMany で確保） |
| SHN-010 | 追加質問の残回数の表示値 | public GET の canAskFollowups を確認 | MAX_FOLLOWUP_RUNS を参照する | 不合格 | src/app/api/shanai/public/survey/[token]/route.ts:47 が `< 3` を直書き。正本は src/lib/shanai/survey-service.ts:11 |
| SHN-011 | 回答画面にアプリ枠を出さない（R-7） | guest-path と ShanaiFrame を確認 | `/shanai/answer/` はゲスト扱い | 合格 | src/lib/ui/guest-path.ts:25、src/components/shanai/ShanaiFrame.tsx:20、src/app/shanai/layout.tsx:24-30 |
| SHN-012 | インタビュー [id] の所有者照合（GET/PUT/DELETE） | where に userId が入るか | id と userId の二重条件 | 合格 | src/lib/shanai/access.ts:52-54、src/app/api/shanai/interviews/[id]/route.ts:21,54,69、src/lib/shanai/dto.ts:49-50 |
| SHN-013 | 写真 [photoId] の所有者照合 | findPhoto を確認 | インタビューの所有確認後に photoId を引く | 合格 | src/app/api/shanai/interviews/[id]/photos/[photoId]/route.ts:14-19 |
| SHN-014 | 記事 PUT の所有者照合 | findFirst の条件を確認 | articleId・interviewId・userId の三重条件 | 合格 | src/app/api/shanai/interviews/[id]/article/route.ts:36-38 |
| SHN-015 | 事実 PUT の所有者照合 | 更新条件を確認 | 所有確認後、factId と interviewId で更新 | 合格 | src/app/api/shanai/interviews/[id]/facts/route.ts:72-73,81,86 |
| SHN-016 | 会社プロフィール項目の所有者照合 | items PUT を確認 | id と companyId の二重条件 | 合格 | src/app/api/shanai/company/items/route.ts:27-34 |
| SHN-017 | 会社情報（1 ユーザー 1 社）の分離 | ShanaiCompany の取得条件を確認 | userId が unique で、userId で引く | 合格 | prisma/schema.prisma:5655、src/lib/shanai/company.ts:33-37、src/lib/shanai/company-read.ts:8-9 |
| SHN-018 | serviceSourceIds の越境 | POST/PUT で他人の source id を渡せるか | 自社の source id だけ残す | 合格 | src/app/api/shanai/interviews/route.ts:36-38、src/app/api/shanai/interviews/[id]/route.ts:49-53 |
| SHN-019 | 一覧・集計の userId 絞り込み | interviews-read.ts を確認 | 全関数が userId で絞る。空なら DB を呼ばない | 合格 | src/lib/shanai/interviews-read.ts:33-36,49-52,58-59、src/lib/shanai/shanai.test.ts（R-4・D-5 のテスト） |
| SHN-020 | アップロード先パスの越境 | isOwnPath と confirm-upload を確認 | 他人・他インタビューのパスを登録できない | 合格 | src/lib/shanai/storage.ts:35-37、src/app/api/shanai/interviews/[id]/confirm-upload/route.ts:24-26 |
| SHN-021 | 記事生成の上限が API で強制されるか | reserveArticle を確認 | LLM の前に、同一トランザクションで数える | 合格 | src/lib/shanai/access.ts:83-109、src/lib/shanai/article-service.ts:30-31 |
| SHN-022 | 文字起こしの上限が API で強制されるか | reserveTranscript を確認 | AssemblyAI 送信の前に数える | 合格 | src/lib/shanai/access.ts:117-158、src/app/api/shanai/interviews/[id]/transcribe/route.ts:63-64 |
| SHN-023 | 有料プランでも無制限にしない | plan-limit の月次上限を確認 | PRO/ENTERPRISE に月次値がある | 合格 | src/lib/plan-limit.ts:48-50,78-80,95-96,180-190 |
| SHN-024 | 無料枠の上限値と表示文言の一致 | plan-limit と services.ts を比較 | 3 本・3 件、月 30 | 合格 | src/lib/plan-limit.ts:48-50,78-80、src/lib/services.ts:1888-1891 |
| SHN-025 | 上限の数え方（台帳） | ShanaiUsageLog の使い方を確認 | 行の削除で枠が戻らない | 合格 | src/lib/shanai/access.ts:7,93-95,103、prisma/schema.prisma:5862-5873 |
| SHN-026 | 記事生成の競合 | トランザクション分離を確認 | Serializable ＋ P2034/P2028 の再試行 | 合格 | src/lib/shanai/access.ts:56-68,107,156 |
| SHN-027 | 記事生成に失敗したときの枠の返却 | releaseArticle を確認 | 記事行と台帳を消す | 合格 | src/lib/shanai/access.ts:76-80、src/lib/shanai/article-service.ts:64-68 |
| SHN-028 | 文字起こしに失敗したときの枠 | transcribe の catch を確認 | 送信前の失敗なら台帳を戻す | 不合格 | src/lib/shanai/access.ts:141-152 で台帳と transcriptRuns を先に確保し、src/app/api/shanai/interviews/[id]/transcribe/route.ts:80-91 の失敗時に戻す処理がない |
| SHN-029 | 事実抽出の回数上限 | claimFactRun を確認 | LLM の前に回数を確保。1 件 5 回まで | 合格 | src/lib/shanai/access.ts:161-181、src/app/api/shanai/interviews/[id]/facts/route.ts:33-35 |
| SHN-030 | サイト読み取りの連打防止 | crawl route を確認 | 3 分に 1 回。updateMany で同時押しを 1 回に絞る | 合格 | src/app/api/shanai/company/crawl/route.ts:13,22-28 |
| SHN-031 | 読み取るページ数の上限 | company.ts を確認 | URL 6 件、種類ごとに最大 2〜6 ページ | 合格 | src/lib/shanai/company.ts:21,24,99,149 |
| SHN-032 | 録音の長さ・大きさの上限 | storage.ts と transcribe を確認 | 90 分・1GB。長さは保存された中身から測る | 合格 | src/lib/shanai/storage.ts:12-16、src/app/api/shanai/interviews/[id]/transcribe/route.ts:54-61 |
| SHN-033 | 二重課金の防止（文字起こし） | ジョブ ID の扱いを確認 | 送信済みジョブがあれば待つだけ | 合格 | src/app/api/shanai/interviews/[id]/transcribe/route.ts:47-52,85-88 |
| SHN-034 | 署名付き URL の発行数上限 | upload-url を確認 | 1 件 40 回。updateMany で確保 | 合格 | src/app/api/shanai/interviews/[id]/upload-url/route.ts:18,40-44 |
| SHN-035 | 画像生成 API の呼び出し | サムネの作り方を確認 | 画像生成 AI を使わない | 合格 | src/lib/shanai/thumbnail.ts:4-6、src/app/api/shanai/interviews/[id]/thumbnail/route.ts:2 |
| SHN-036 | インタビュー件数の上限 | interviews POST を確認 | 行の作りすぎを止める | 合格 | src/app/api/shanai/interviews/route.ts:13,33-34 |
| SHN-037 | 外部 AI のモデル ID | GEMINI_TEXT_MODEL_DEFAULT を確認 | 廃止済み ID を使わない | 合格 | seo/lib/gemini.ts:214-215（既定 gemini-2.5-flash）、src/lib/shanai/generate.ts:8,56,157,286、src/lib/shanai/company.ts:232 |
| SHN-038 | フォールバックの末尾 | FALLBACK_MODELS を確認 | 末尾が gemini-flash-latest または gemini-pro-latest | 不合格 | seo/lib/gemini.ts:435-439 は `['gemini-2.5-flash','gemini-pro-latest','gemini-2.5-flash']`。末尾が固定 ID で、gemini-flash-latest が無い（共通ライブラリ。他章と重複する可能性あり） |
| SHN-039 | 外部 AI 呼び出しのタイムアウト | gemini.ts の AbortSignal を確認 | 呼び出しごとの時間制限がある | 不合格 | seo/lib/gemini.ts に AbortSignal / timeout の指定なし（grep 0 件）。関数の maxDuration だけが上限 |
| SHN-040 | エラー本文を利用者に返さない | 各 route の catch を確認 | 固定の日本語メッセージ。ログも e.name のみ | 合格 | src/app/api/shanai/company/crawl/route.ts:39-42、src/app/api/shanai/interviews/[id]/facts/route.ts:60-63、src/app/api/shanai/interviews/[id]/transcribe/route.ts:82-90 ほか |
| SHN-041 | 記事 POST の try/catch | article route を確認 | DB 例外でも 500 の固定文を返す | 不合格 | src/app/api/shanai/interviews/[id]/article/route.ts:17-27 に try/catch がない。draftArticle 内の生成は捕捉されるが（src/lib/shanai/article-service.ts:64-68）、reserveArticle の DB 例外は Next の既定 500 になる |
| SHN-042 | 会社サイト取得の SSRF 対策 | fetchPage の実装を確認 | safe-fetch を使う | 合格 | src/lib/shanai/company.ts:10,66-67、src/lib/net/safe-fetch.ts:17-50,53-64 |
| SHN-043 | リダイレクト・サイズ・タイムアウトの上限 | safeFetchResource の既定値を確認 | 各ホップで再検証。2MiB。15 秒 | 合格 | src/lib/net/safe-fetch.ts:140-142,156-182,193-211、src/lib/shanai/company.ts:67 |
| SHN-044 | robots.txt の取得と CSS の取得 | robots.ts と extractColors を確認 | どちらも safe-fetch | 合格 | src/lib/shanai/robots.ts:5,14、src/lib/adimage/brand.ts:97 |
| SHN-045 | 入力 URL の検証 | parseSiteUrl を確認 | http/https のみ。長さ上限 | 合格 | src/lib/shanai/company.ts:43-55、src/app/api/shanai/company/route.ts:37-40 |
| SHN-046 | robots.txt 照合の ReDoS 対策 | wildcardMatch を確認 | 正規表現を組み立てない | 合格 | src/lib/shanai/robots.ts:4,39-74、src/lib/shanai/shanai.test.ts（robots のテスト） |
| SHN-047 | 外部ページ本文のサイズ上限 | PAGE_TEXT_MAX を確認 | DB と LLM に渡す量を切る | 合格 | src/lib/shanai/company.ts:19-20,72 |
| SHN-048 | アップロードの MIME・サイズ検査 | validateUpload と confirm-upload を確認 | 発行時と確定時の両方で検査。確定時は保存された大きさを使う | 合格 | src/lib/shanai/storage.ts:10-28、src/app/api/shanai/interviews/[id]/upload-url/route.ts:30-33、src/app/api/shanai/interviews/[id]/confirm-upload/route.ts:31-39 |
| SHN-049 | アップロードの中身（マジックバイト）検査 | confirm-upload の検査内容を確認 | 画像の先頭バイトか sharp で中身を確かめる | 不合格 | src/app/api/shanai/interviews/[id]/confirm-upload/route.ts:32-35 は Storage のメタ（送信時の Content-Type）だけ。中身の検査は無い。偽の画像は src/lib/shanai/thumbnail.ts:65 の sharp で初めて失敗する |
| SHN-050 | 保存先バケットが非公開か | ensurePrivateImageBucket を確認 | public=false を毎回確認 | 合格 | src/lib/shanai/storage.ts:6、src/lib/interview/storage.ts:16,46-48、src/lib/private-storage-bucket.ts:15-28 |
| SHN-051 | 署名 URL の期限と DB の保存値 | photoDto と schema を確認 | DB には storagePath のみ。URL は 1 時間 | 合格 | src/lib/shanai/dto.ts:10-13、prisma/schema.prisma:5806、src/lib/interview/storage.ts:121-137 |
| SHN-052 | 削除時のストレージ掃除 | DELETE と写真削除を確認 | 録音・写真をストレージからも消す | 合格 | src/app/api/shanai/interviews/[id]/route.ts:69-73、src/app/api/shanai/interviews/[id]/photos/[photoId]/route.ts:53-54 |
| SHN-053 | public/shanai の画像に個人情報が無いか | 11 枚をすべて表示して確認 | 見本・マスコットのみ | 合格 | public/shanai/hero.webp、shots/1-input.webp、shots/2-process.webp、shots/3-output.webp、answer-header.webp、working.webp、empty-interviews.webp（すべてシロクマのイラストと抽象的な画面図） |
| SHN-054 | 未使用の画像 | 参照箇所を grep | 置いた画像が参照されている | 不合格 | public/shanai/shots/*.webp と step-1〜3.webp（同内容の重複、各 46〜66KB）を参照するコードが無い（grep 0 件）。ui.tsx:234 は working.webp のみ |
| SHN-055 | 新モデルの unique・index・onDelete | schema を確認 | 子は Cascade。検索列に index | 合格 | prisma/schema.prisma:5681,5701,5721-5722,5805,5822,5843（Cascade/SetNull）、5693,5711,5735,5796-5797,5814,5835,5858-5859,5872（index/unique） |
| SHN-056 | User への関連追加 | schema diff の User を確認 | User 側に shanai の relation を足していない | 合格 | prisma/schema.prisma:5654-5655,5741-5742（userId は FK なしの文字列）。User モデルに shanai の列なし |
| SHN-057 | ユーザー削除時の孤児行 | userId の FK を確認 | User 削除で連鎖削除される | 不合格 | prisma/schema.prisma:5655,5742,5844 は FK なし。User を消しても shanai_* の行とストレージの録音・写真が残る |
| SHN-058 | 本番 DB への反映 | 新テーブルの有無 | db push 済み | 未確認 | 本番 DB に触れていない。ShanaiCompany〜ShanaiUsageLog の 9 モデルが diff で新規（`git diff origin/main...HEAD -- prisma/schema.prisma` に `+model Shanai` 9 件）。未反映だと全 API が 500 |
| SHN-059 | 不正 JSON で 500 にならないか | req.json() の扱いを確認 | `.catch(() => ({}))` で空扱い | 合格 | src/app/api/shanai/company/route.ts:30、src/app/api/shanai/interviews/route.ts:30、src/app/api/shanai/public/survey/[token]/route.ts:61,76 ほか全ハンドラ |
| SHN-060 | 入力の長さと列挙値の検証 | clip / oneOf の使用を確認 | 自由入力は長さを切り、列挙は許可値だけ | 合格 | src/lib/shanai/types.ts:89-95、src/app/api/shanai/interviews/route.ts:31-52、src/lib/shanai/survey.ts:83-97 |
| SHN-061 | AI 出力の引用検証 | quoteExists の使用箇所を確認 | 原文に無い引用は保存しない | 合格 | src/lib/shanai/evidence.ts:20-32、src/lib/shanai/generate.ts:169,176,306、src/lib/shanai/company.ts:244 |
| SHN-062 | maxDuration の設定 | 長い処理の route を確認 | LLM・文字起こし・読み取りは 300、Word・サムネは 60 | 合格 | src/app/api/shanai/company/crawl/route.ts:4、facts/route.ts:5、article/route.ts:5、followups/route.ts:4、transcribe/route.ts:6、public/survey/[token]/route.ts:8、export/route.ts:5、thumbnail/route.ts:5 |
| SHN-063 | maxDuration 300 が本番プランで有効か | vercel.json と Vercel のプラン | 300 秒が許される | 未確認 | vercel.json の functions に shanai の項目なし。route 直書きの 300 は既存 API 266 本と同じ書き方（`grep "maxDuration = 300" src/app/api`）。プランは確認できない |
| SHN-064 | サムネのフォント同梱 | outputFileTracingIncludes を確認 | satori を使う全 route にフォントを同梱 | 不合格 | next.config.js:79 は thumbnail route だけ。export route（src/app/api/shanai/interviews/[id]/export/route.ts:33）も buildThumbnail を呼ぶが同梱指定が無い。本番で読めないと `.catch(() => null)` によりサムネ無しの Word になる |
| SHN-065 | 文字起こしの外部送信 | transcribeFromUrl を確認 | 署名 URL（1 時間）を AssemblyAI に渡す。キーは環境変数 | 合格 | src/lib/interview/transcription.ts:66-70、src/app/api/shanai/interviews/[id]/transcribe/route.ts:67-76 |
| SHN-066 | 画面の読込・空・エラー表示 | 一覧・詳細・会社・回答の各画面を確認 | Skeleton・EmptyState・ErrorState（もう一度）がある | 合格 | src/app/shanai/Tool.tsx:43-44,84-97、src/app/shanai/interviews/[id]/page.tsx:80-81、src/app/shanai/company/page.tsx:125-126、src/app/shanai/answer/[token]/page.tsx:122-140 |
| SHN-067 | 未ログイン時の画面の導線 | 401 の扱いを確認 | サインインへ送る | 合格 | src/app/shanai/Tool.tsx:34、src/app/shanai/interviews/[id]/page.tsx:71、src/app/shanai/company/page.tsx:73 |
| SHN-068 | ポーリング・タイマーの停止条件 | setInterval / ループを確認 | 回数上限と cleanup がある | 合格 | src/app/shanai/interviews/[id]/page.tsx:162-181（最大 6 回、cancelled で停止）、src/app/shanai/answer/[token]/page.tsx:54-68（clearInterval）、src/components/shanai/ui.tsx:260-272 |
| SHN-069 | 長い処理の段階表示 | ProgressSteps / useTimedStep を確認 | 何をしているかを段階で出す | 合格 | src/app/shanai/company/page.tsx:51,202-205、src/app/shanai/interviews/[id]/page.tsx:142 |
| SHN-070 | 日本語・敬語・絵文字 | UI 文言と絵文字 grep | 丁寧語の日本語。絵文字アイコン無し | 合格 | 絵文字 grep 0 件（src/app/shanai、src/components/shanai）。アイコンは lucide（src/app/shanai/Tool.tsx:6） |
| SHN-071 | レスポンシブの破綻要因 | 固定幅・横スクロールを grep | 3 桁 px の固定幅が無い | 合格 | grep 0 件。サイドバー幅は md 以上だけ適用（src/components/shanai/ShanaiAppLayout.tsx:22-27,69） |
| SHN-072 | 公開ページの noindex と sitemap | layout と services.ts、sitemap.ts を確認 | noindex。UNLISTED で sitemap から除外 | 合格 | src/app/shanai/layout.tsx:11-15、src/app/shanai/pricing/layout.tsx:4、src/lib/services.ts:1893,1950,1956-1959、src/app/sitemap.ts:93-95 |
| SHN-073 | エージェント道具の承認 | sendAnswerLink を確認 | 承認無しでは送らない。所有確認あり | 合格 | src/lib/shanai/agent-tools.ts:76-90、src/lib/shanai/shanai.test.ts（承認のテスト） |
| SHN-074 | サイドバーの利用状況 | SidebarUsagePanel の参照先を確認 | `/api/usage/shanai` が台帳で数える | 合格 | src/components/shanai/ShanaiSidebar.tsx:95-96、src/lib/usage-summary.ts:251-258 |

### 9.2 ドヤ展示会（tenjikai）

| ID | 項目 | 確認方法 | 合格条件 | 結果 | 根拠 |
|---|---|---|---|---|---|
| TNJ-001 | API の全ハンドラでログイン確認 | generate / image の両 route を確認 | 未ログインで 401 | 合格 | src/app/api/tenjikai/generate/route.ts:89-91、src/app/api/tenjikai/image/route.ts:37-39 |
| TNJ-002 | 未ログインで叩ける口 | `src/app/api/tenjikai/**` を列挙 | 無し | 合格 | 2 本とも getServerSession を通る（TNJ-001） |
| TNJ-003 | 画面の未ログイン時の扱い | layout.tsx と TenjikaiApp を確認 | requiresAuth のサービスは LP か案内を出す | 不合格 | src/app/tenjikai/layout.tsx:24-40 はセッションを見ずに TenjikaiApp を描く。未ログインでも全画面が操作でき、生成だけがモック＋注意文になる（src/lib/tenjikai/engine.ts:509）。src/lib/services.ts:1768 は requiresAuth: true |
| TNJ-004 | プロジェクトの userId 絞り込み | generate と read 関数を確認 | 作成は userId 付き。読み取りは project.userId で絞る | 合格 | src/app/api/tenjikai/generate/route.ts:50-56、src/lib/tenjikai/tenjikai-read.ts:43-48,83-84,96-97,107-108,141-142、src/lib/tenjikai/tenjikai-read.test.ts |
| TNJ-005 | [id] ルートの IDOR | `src/app/api/tenjikai/**/[id]` の有無 | 無い（画面は DB を読まない） | 該当なし | API は generate / image の 2 本のみ。projectId を受け取る口が無い |
| TNJ-006 | 子モデルの参照が所有者経由か | tenjikai-read の where を確認 | 全クエリに `project: { userId }` | 合格 | src/lib/tenjikai/tenjikai-read.ts:45,97,108 |
| TNJ-007 | AI 作成回数の上限が API で強制されるか | createProjectWithinQuota を確認 | LLM の前に同一トランザクションで数える | 合格 | src/app/api/tenjikai/generate/route.ts:39-86,96-104 |
| TNJ-008 | 有料でも無制限にしない | plan-limit を確認 | PRO 月 30、ENTERPRISE 月 100 | 合格 | src/lib/plan-limit.ts:46,76,94 |
| TNJ-009 | 上限値と表示文言の一致 | services.ts と plan-limit を比較 | 3 回・月 30 回 | 合格 | src/lib/services.ts:1759-1762、src/lib/plan-limit.ts:46,76 |
| TNJ-010 | 上限判定の競合 | トランザクション分離を確認 | Serializable ＋ 再試行 | 合格 | src/app/api/tenjikai/generate/route.ts:43-84 |
| TNJ-011 | 上限の数え方 | 数える対象を確認 | 削除で枠が戻らない | 合格 | src/app/api/tenjikai/generate/route.ts:51-52（TenjikaiProject の行数）。削除 API が無いので戻らない |
| TNJ-012 | DB 不通時に LLM を呼ばないか | catch の分岐を確認 | 上限を数えられないときはモックを返す | 合格 | src/app/api/tenjikai/generate/route.ts:99-102 |
| TNJ-013 | 作ったプロジェクトを画面から見られるか | 一覧・再読込・削除の API の有無 | 利用者が自分の枠の消費を確認・整理できる | 不合格 | API は generate / image のみ。画面の状態は src/components/tenjikai/TenjikaiApp.tsx:40-52 のメモリだけで、再読込で消える。再実行のたびに TenjikaiProject が増え、無料枠 3 回を消費するが一覧も削除も無い |
| TNJ-014 | 画像生成（従量課金）の実行条件 | image route の前提を確認 | 環境変数で明示的に有効化しないと動かない | 合格 | src/app/api/tenjikai/image/route.ts:28-36 |
| TNJ-015 | 本番で画像生成が無効か | 環境変数 TENJIKAI_IMAGEGEN_ENABLED | 未設定（403） | 未確認 | 本番の環境変数に触れていない。未設定なら 403（src/app/api/tenjikai/image/route.ts:34-35） |
| TNJ-016 | 画像生成の回数・金額上限の実装 | hits / usage の保持場所を確認 | 利用者・日ごとの上限を DB で数える | 不合格 | src/app/api/tenjikai/image/route.ts:19-20,66-79 はプロセス内 Map と変数。サーバーレスではインスタンスごとに別で、再起動で 0 に戻る。コード内コメントも暫定と明記（15-18） |
| TNJ-017 | 画像生成ジョブの記録（TenjikaiGenerationJob） | image route の DB 書き込みを確認 | 承認した見込み額と結果を残す | 不合格 | src/app/api/tenjikai/image/route.ts:109-110 はコメントのみで書き込み無し。prisma/schema.prisma:4718 は「必ず残す」と定義 |
| TNJ-018 | 画像生成の quality/size 指定 | 送信ボディを確認 | size と aspectRatio を明示 | 合格 | src/app/api/tenjikai/image/route.ts:59-61,92-95、src/lib/tenjikai/imagegen.ts:23-28 |
| TNJ-019 | 画像生成の見込み額の承認 | approved と expectedCostYen の照合 | サーバー計算と一致しないと 409 | 合格 | src/app/api/tenjikai/image/route.ts:57,61-64、src/components/tenjikai/ImageGenModal.tsx:104-121 |
| TNJ-020 | 画像生成のエラー本文 | 失敗時の応答を確認 | 上流の本文を返さない | 不合格 | src/app/api/tenjikai/image/route.ts:98-101 が `detail: text.slice(0, 500)` で Gemini の本文を返す。画面側は 500 以上を固定文にするが 502 のボディは受け取る（src/components/tenjikai/ImageGenModal.tsx:55） |
| TNJ-021 | 画像モデル ID | IMAGE_MODELS を確認 | 廃止済み ID（gemini-3-pro-preview 等のテキスト系）を使わない | 合格 | src/lib/tenjikai/imagegen.ts:18-21（gemini-3-pro-image-preview、gemini-2.5-flash-image） |
| TNJ-022 | テキスト生成のモデル ID | ai.ts の model 指定 | GEMINI_TEXT_MODEL_DEFAULT | 合格 | src/lib/tenjikai/ai.ts:7,78,124,156、seo/lib/gemini.ts:214-215 |
| TNJ-023 | フォールバックの末尾 | FALLBACK_MODELS | 末尾が *-latest | 不合格 | seo/lib/gemini.ts:435-439（SHN-038 と同一） |
| TNJ-024 | LLM・画像 API のタイムアウト | fetch の signal を確認 | 呼び出しごとの時間制限 | 不合格 | src/app/api/tenjikai/image/route.ts:87-97 の fetch に signal なし。seo/lib/gemini.ts も無し（SHN-039） |
| TNJ-025 | LLM 失敗時の応答 | generate の catch を確認 | 固定文のモックに落とす。本文を返さない | 合格 | src/app/api/tenjikai/generate/route.ts:124-127、src/lib/tenjikai/ai.ts:170-183 |
| TNJ-026 | サイト取得の SSRF 対策 | aiAnalyzeSite を確認 | safe-fetch を使う | 合格 | src/lib/tenjikai/ai.ts:8,54 |
| TNJ-027 | serviceUrl の検証 | parseInput を確認 | URL 形式を確かめてから枠を消費する | 不合格 | src/app/api/tenjikai/generate/route.ts:25,33 は 500 文字以内の文字列なら通す。枠の消費（54-73）の後で safeFetchText が失敗し、モックを返す（125-127）。入力ミスでも無料枠 1 回を失う |
| TNJ-028 | 入力値の範囲検証 | parseInput を確認 | 日数・小間・予算・人数に上下限。列挙値は許可値だけ | 合格 | src/app/api/tenjikai/generate/route.ts:19-37 |
| TNJ-029 | 不正 JSON で 500 にならないか | req.json() の扱い | 400 を返す | 合格 | src/app/api/tenjikai/generate/route.ts:93-94、src/app/api/tenjikai/image/route.ts:43-48 |
| TNJ-030 | maxDuration | 両 route を確認 | generate 120、image 300 | 合格 | src/app/api/tenjikai/generate/route.ts:3、src/app/api/tenjikai/image/route.ts:3（プランの可否は SHN-063 と同じく未確認） |
| TNJ-031 | 新モデルの必須列・unique・index・onDelete | schema を確認 | 子は Cascade。userId に index。analysis は projectId unique | 合格 | prisma/schema.prisma:4735,4766-4767,4773-4774,4792,4812,4830,4854,4874,4889,4917,4931,4946,4965 |
| TNJ-032 | User への関連追加 | User モデルの diff | relation の追加だけで既存列に影響なし | 合格 | prisma/schema.prisma:159（`tenjikaiProjects TenjikaiProject[]`） |
| TNJ-033 | 本番 DB への反映 | 新テーブル 14 個の有無 | db push 済み | 未確認 | 本番 DB に触れていない。未反映でも generate はモックで応答する（TNJ-012）が、プロジェクトは残らない |
| TNJ-034 | 会場マスタ（TenjikaiVenue）の使用 | generate の create を確認 | venueId を保存するか、未使用と明記 | 不合格 | src/app/api/tenjikai/generate/route.ts:55-72 は venueId を保存しない。会場は src/lib/tenjikai/engine.ts:33-38 の定数で、tenjikai_venue に初期データを入れる処理も無い |
| TNJ-035 | 画面の読込・空・エラー表示 | 生成中・結果の各画面を確認 | 段階表示。失敗時は注意文 | 合格 | src/components/tenjikai/Generating.tsx:28-35、src/components/tenjikai/TenjikaiApp.tsx:131-135、src/lib/tenjikai/engine.ts:500-514 |
| TNJ-036 | 生成中画面の終了条件 | TenjikaiApp の phase 遷移を確認 | 演出と API の両方が終わると結果へ。API は必ず解決する | 合格 | src/components/tenjikai/TenjikaiApp.tsx:76-92、src/lib/tenjikai/engine.ts:500-514（catch でモック） |
| TNJ-037 | 上限超過・未ログインの利用者への伝え方 | 429/401 の表示 | 理由を日本語で出す | 合格 | src/lib/tenjikai/engine.ts:509-510、src/app/api/tenjikai/generate/route.ts:104 |
| TNJ-038 | 日本語・絵文字 | UI 文言と grep | 丁寧語。絵文字アイコン無し | 合格 | 絵文字 grep 0 件。アイコンは lucide（src/components/tenjikai/TenjikaiApp.tsx:5） |
| TNJ-039 | ds トークンの使用（R-3） | 色の直書きと Tailwind 色を確認 | ds トークン経由 | 不合格 | src/components/tenjikai/Wizard.tsx:47,52、Generating.tsx:41-46、TenjikaiApp.tsx:133,173-179 などが gray-*/amber-* を直接使う。ADDON §11 は「色の直書き」を禁止 |
| TNJ-040 | レスポンシブの破綻要因 | 固定幅・nowrap を確認 | 375px で横スクロールしない | 合格 | 3 桁 px の固定幅 grep 0 件。横スクロールは src/components/tenjikai/VendorBoard.tsx:72 のタブ列だけ。サイドバー幅は md 以上だけ（TenjikaiApp.tsx:173） |
| TNJ-041 | 公開ページの noindex と sitemap | layout と services.ts | noindex。UNLISTED | 合格 | src/app/tenjikai/layout.tsx:11-16、src/lib/services.ts:1763-1764,1950、src/app/sitemap.ts:93-95 |
| TNJ-042 | 知らないセクションの扱い | [section]/page.tsx | 404 | 合格 | src/app/tenjikai/[section]/page.tsx:6-9 |
| TNJ-043 | モックの文面の事実性 | analyzeSite のモックを確認 | サイトに無い実績・数字を書かない | 不合格 | src/lib/tenjikai/engine.ts:124-139 は未知ドメインに「導入企業の声と数字で、効果をその場でお見せします」「最短で翌営業日から」などの定型文を入れる。未ログイン・失敗時はこれが「下書き」として表示される（TNJ-003） |
| TNJ-044 | サイドバーの利用状況表示 | TenjikaiSidebar を確認 | 回数の残りを出す | 合格 | src/components/tenjikai/TenjikaiSidebar.tsx:151-158（料金未確定のため「開発中」表示。coming_soon と整合） |

### 不合格・要対応

| ID | 重大度 | 現象と再現条件 | 該当箇所 | 修正案 | 安全に直せるか |
|---|---|---|---|---|---|
| TNJ-016 / TNJ-017 | A | `TENJIKAI_IMAGEGEN_ENABLED=true` にすると、画像生成の回数・金額上限がプロセス内変数だけになる。Vercel ではインスタンスごとに別々に数え、再起動で 0 に戻る。TenjikaiGenerationJob にも残らないので、使った金額を後から数えられない。本番で未設定なら 403 で止まる（TNJ-015 は未確認） | src/app/api/tenjikai/image/route.ts:19-20,66-79,109-110 | 有効化の前に、plan-limit に画像枠を足し、TenjikaiGenerationJob を LLM の前に作って当日の estimatedCostYen の合計で判定する。完了後に status を更新する。本番移行時は環境変数を未設定のままにする | 直せる。route 1 本と plan-limit の追加だけ。画像生成は本番で無効のままにすれば移行は止めなくてよい |
| TNJ-013 | B | 展示会の AI 作成は TenjikaiProject を 1 行作って枠を数えるが、一覧・再読込・削除の API が無い。利用者は再読込で結果を失い、やり直すたびに無料枠 3 回を消費する。使い切った理由を画面で確かめられない | src/app/api/tenjikai/generate/route.ts:51-56、src/components/tenjikai/TenjikaiApp.tsx:40-52 | 最低限、`GET /api/tenjikai/projects`（userId で絞る）と、作成時に analysis を含めて再読込できる口を足す。サイドバーに残回数を出す | 直せる。読み取りだけの追加 |
| TNJ-020 | B | 画像生成の失敗時に Gemini の応答本文（最大 500 文字）をそのまま返す。API キーの誤設定やクォータ超過の文面が利用者に見える | src/app/api/tenjikai/image/route.ts:98-101 | `detail` を外し、固定の日本語に置き換える。本文はサーバーログに status だけ残す | 直せる。1 行の変更 |
| SHN-038 / TNJ-023 | B | Gemini のフォールバック末尾が `gemini-2.5-flash`（重複）で、`gemini-flash-latest` が無い。既定モデルが廃止されると、最後まで固定 ID で失敗する | seo/lib/gemini.ts:435-439 | 配列を `['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-pro-latest']` にする | 直せる。共通ライブラリのため他サービスにも効く。他章の担当と重複していれば 1 回で直す |
| SHN-039 / TNJ-024 | B | Gemini と画像 API の fetch に AbortSignal が無い。上流が応答を返さないと maxDuration（300 秒）まで待ち、利用者は進捗の無い画面を見る | seo/lib/gemini.ts（grep 0 件）、src/app/api/tenjikai/image/route.ts:87-97 | `AbortSignal.timeout(90_000)` 程度を fetch に渡し、タイムアウトを次モデルへのフォールバック条件に含める | 直せる。共通ライブラリの変更なので、既存サービスの動作確認が必要 |
| SHN-028 | B | 文字起こしの枠（台帳・transcriptRuns）を AssemblyAI 送信の前に確保し、送信前の失敗（署名 URL の取得失敗、submit の 4xx など）でも戻さない。利用者は結果無しで無料枠 1 件と 1 インタビュー 2 回のうち 1 回を失う | src/lib/shanai/access.ts:141-152、src/app/api/shanai/interviews/[id]/transcribe/route.ts:80-91 | catch で `transcriptJobId` が無いときは、今回作った台帳（kind='transcript', interviewId）を消し、transcriptRuns を 1 戻す。初回判定に使った transcribedAt も戻す | 直せる。article の releaseArticle と同じ形で書ける |
| SHN-064 | B | Word 出力（export）が buildThumbnail を呼ぶが、フォントの同梱指定は thumbnail route だけ。本番でフォントが読めないとサムネ無しの Word になり、エラーも出ない | next.config.js:73-79、src/app/api/shanai/interviews/[id]/export/route.ts:33 | outputFileTracingIncludes に `/api/shanai/interviews/[id]/export` を足す。本番で一度 Word を出して確かめる | 直せる。設定 1 行。ビルドの再実行が必要 |
| TNJ-003 | B | /tenjikai は未ログインでも全画面を描く。services.ts は requiresAuth。未ログインで作成を押すと 401 をモックで隠し、TNJ-043 の定型文が「下書き」として出る | src/app/tenjikai/layout.tsx:24-40、src/lib/tenjikai/engine.ts:509 | layout.tsx でセッションを見て、未ログインは LP か「ログインしてください」の案内に切り替える（shanai の page.tsx:10-14 と同型） | 直せる。layout の分岐追加のみ |
| SHN-049 | B | 写真の中身を検査していない。Storage のメタ（送信時の Content-Type）だけで JPEG/PNG/WebP を判定する。偽の画像を置くと、サムネ・Word の生成で sharp が失敗し、利用者には「作成に失敗しました」としか出ない | src/app/api/shanai/interviews/[id]/confirm-upload/route.ts:31-39 | confirm-upload で先頭バイトを取り（downloadFile か Range）、sharp の metadata() で形式を確かめる。失敗なら removeFiles して 400 | 直せる。既存の downloadFile と sharp で書ける |
| SHN-057 | B | ShanaiInterview / ShanaiCompany / ShanaiArticle の userId に FK が無い。User を削除しても行と録音・写真が残る（個人情報の残存） | prisma/schema.prisma:5655,5742,5844 | User との relation を Cascade で足すか、退会処理で shanai の行とストレージを消す | 直せるが db push が要る。退会処理側で消す方が安全 |
| TNJ-027 | C | serviceUrl が URL 形式でなくても TenjikaiProject を作り、枠を 1 回消費してからモックを返す | src/app/api/tenjikai/generate/route.ts:25,33,54-73 | parseInput で `new URL()` と http/https を確かめ、失敗は 400 にする | 直せる |
| SHN-006 | C | 回答 URL に期限が無い。rotateToken と提出後ロックで補っているが、未提出のまま放置した URL は無期限に有効 | prisma/schema.prisma:5761-5764 | surveyTokenExpiresAt を足し、作成から 90 日で 404 にする。期限切れは画面から作り直せるようにする | 直せるが db push が要る |
| SHN-041 | C | 記事 POST に try/catch が無い。reserveArticle の DB 例外は Next の既定 500 になる。本文は漏れないが、他ハンドラと形がそろわない | src/app/api/shanai/interviews/[id]/article/route.ts:17-27 | 他ハンドラと同じ try/catch で固定文を返す | 直せる |
| SHN-010 | C | 公開アンケートの canAskFollowups が `< 3` の直書き。MAX_FOLLOWUP_RUNS を変えると表示と実態がずれる | src/app/api/shanai/public/survey/[token]/route.ts:47 | `row.followupRuns < MAX_FOLLOWUP_RUNS` にする | 直せる |
| SHN-054 | C | public/shanai/shots/*.webp と step-1〜3.webp が未参照（同内容の重複）。配信物が増えるだけで害は無い | public/shanai/shots、public/shanai/step-*.webp | 使う画像を決めて片方を消すか、LP の HowItWorks に載せる | 直せる |
| TNJ-034 | C | TenjikaiVenue のマスタが未使用で、初期データも無い。会場は engine.ts の定数 | src/app/api/tenjikai/generate/route.ts:55-72、src/lib/tenjikai/engine.ts:33-38 | 当面は定数のままでよい。マスタを使うなら seed を足し、create で venueId を保存する | 直せる |
| TNJ-039 | C | tenjikai の画面が gray-*/amber-* などの Tailwind 色を直接使う。ADDON §11（R-3）の「色の直書き禁止」に合わない | src/components/tenjikai/Wizard.tsx:47,52 ほか | ds トークン（--sub、--note-bg 等）に置き換える | 直せる。見た目の変更のみ |
| TNJ-043 | C | 未知ドメインのモックに、サイトに無い実績風の文面が入る。「下書き」の注意文は出るが、未ログイン時はこれだけが見える | src/lib/tenjikai/engine.ts:124-139 | 定型文を「（サイトを読み取ると、ここに訴求点が入ります）」のような中立の文にする | 直せる |

### 未確認（本番で確かめる項目）

- SHN-058 / TNJ-033: 新テーブル（shanai_* 9 個、tenjikai_* 14 個）の db push。未反映だと shanai の全 API が 500 になる。
- SHN-063 / TNJ-030: route 直書きの maxDuration 300 が本番プランで有効か。
- TNJ-015: 本番の TENJIKAI_IMAGEGEN_ENABLED が未設定か。設定するなら TNJ-016 / TNJ-017 を先に直す。
- SHN-064: 本番で Word 出力にサムネが入るか（フォント同梱）。


---

## 10. ポップアップ・質問リンク

対象: `(統合ブランチの点検用 worktree)/`（`integrate/agent-renewal` 3e755c43）。origin/main（142e29b4）との差分と、HEAD の現物をコードで読んだ。本番・DB・外部 API には触れていない。ビルドもテストも実行していない。

前提として分かった事実:

- `prisma/schema.prisma` の popup / asklink の各モデルは、origin/main と HEAD で**同一**（`git diff origin/main HEAD -- prisma/schema.prisma` に popup / asklink の行が無い）。本ブランチが新しく列を足すのではない。`PopupSite.companyProfileId` は両方にある。
- origin/main は 2026-10-18 に popup を**正式公開**した（`UNLISTED_SERVICE_IDS` から外し、noindex を外し、`PUBLIC_INTRO_SERVICES` に追加）。HEAD は popup を **UNLISTED・coming_soon・noindex のまま**にしている。マージで origin/main 側の変更を落とすと、公開済みのサービスが非公開に戻る。
- asklink には第三者や未ログインの人が触れる公開 API・公開ページが**無い**。「公開リンク」は chatgpt.com の URL であり、自サーバーには回答ページも OGP も無い。公開の口があるのは popup だけ（`/api/popup/public/*`、`/popup/embed.js`）。
- 既存チェックリスト（`doya-syscheck-20261018/docs/system-check/CHECKLIST-2026-10-18.md`）で既に指摘済みのものは「既存指摘」と書き、重複して不合格節に並べない。

| ID | 項目 | 確認方法 | 合格条件 | 結果 | 根拠 |
| --- | --- | --- | --- | --- | --- |
| POP-001 | 公開設定 API が認証なしで返すもの | コード読解 | 公開中（live）の案の表示項目だけ。userId・抽出結果・提案理由を出さない | 合格 | `src/app/api/popup/public/config/route.ts:39-44`、`src/lib/popup/dto.ts:141-161` |
| POP-002 | 公開設定 API のサイトキー形式検査 | コード読解 | 形式外は DB を引かずに 404 | 合格 | `config/route.ts:24-25`、`src/lib/popup/schema.ts:372-374` |
| POP-003 | 呼び出し元ドメインの照合 | コード読解 | Origin（無ければ Referer）のホストが登録ドメインかそのサブドメインのときだけ。末尾一致で誤って通さない | 合格 | `src/lib/popup/public.ts:12-19`、`schema.ts:316-321`（`h === d \|\| h.endsWith('.' + d)`） |
| POP-004 | CORS を `*` にしない | コード読解 | 照合に通った Origin だけを返し、`Vary: Origin` を付ける | 合格 | `public.ts:21-31`。既存指摘 SEC-029 と同じ |
| POP-005 | CDN キャッシュと CORS の混線 | コード読解 | ホストごとにキャッシュが分かれる | 未確認 | `config/route.ts:59` が `s-maxage=60`。embed.js は `h=hostname` をクエリに付けるので（`public/popup/embed.js:493`）ホスト違いは URL で分かれる。同じホストで scheme が違う Origin（http と https）は `Vary: Origin` 頼み。Vercel の CDN が `Vary: Origin` をキャッシュ鍵に使うかはコードから分からない。混線しても他ドメインの設定は読めない（鍵が同じサイトのもの）ので実害は「表示されない」だけ |
| POP-006 | 拒否応答をキャッシュさせない | コード読解 | 403 は `no-store` | 合格 | `config/route.ts:36` |
| POP-007 | 他サイトの設定を読めないか | コード読解 | サイトキーは推測不能、キーとドメインの両方が合わないと返さない | 合格 | `src/lib/popup/access.ts:36-38`（18 バイト乱数 base64url）、`config/route.ts:27-37` |
| POP-008 | 公開設定 1 回あたりの件数上限 | コード読解 | 上限あり | 合格 | `config/route.ts:17,42`（`MAX_LIVE = 20`） |
| POP-009 | 公開設定 API のレート制限 | コード読解 | 不正キー連打に対する全体の制限 | 不合格 | 制限なし。404 は `Cache-Control` 無しなので毎回 DB を引く（`config/route.ts:25-31`）。既存指摘 SEC-114（グローバル IP 制限なし）に含まれる |
| POP-010 | 公開設定 GET の副作用 | コード読解 | 書き込みは設置確認（lastSeenAt）だけ、10 分に 1 回 | 合格 | `config/route.ts:47-52`、`public.ts:53`。既存指摘 SEC-081 で意図的と整理済み |
| POP-011 | 公開設定 API の DB 例外時の応答 | コード読解 | CORS ヘッダ付きの失敗応答 | 不合格 | try 無し（`config/route.ts:23-63`）。既存指摘 API-019 |
| POP-012 | プリフライト（OPTIONS）の扱い | コード読解 | 本体で照合する前提で、形式だけ許可 | 合格 | `public.ts:33-50`。OPTIONS は任意の Origin を echo するが、GET/POST 本体で照合し、通らなければ CORS ヘッダを付けない（`config/route.ts:33-37`、`track/route.ts:69-70`） |
| POP-013 | 計測 API の本文サイズ上限 | コード読解 | `content-length` と読んだ長さの両方で 2KB | 合格 | `src/app/api/popup/public/track/route.ts:16,43-46` |
| POP-014 | 計測 API の入力検査 | コード読解 | k / p / e / t を形式で検査、表示・閉じるは main だけ | 合格 | `track/route.ts:54-59`、`schema.ts:353-357` |
| POP-015 | 計測 API が数える対象 | コード読解 | 公開中の案、そのキーのサイト、削除されていないサイト、登録ドメインからの呼び出しだけ | 合格 | `track/route.ts:64-70` |
| POP-016 | 計測 API のレート制限 | コード読解 | 共有ストアでの制限 | 不合格 | インスタンス内 Map（`track/route.ts:22-35`）。既存指摘 SEC-030 |
| POP-017 | 計測で個人情報を保存しない | コード読解 | IP・UA・Cookie を保存しない | 合格 | `track/route.ts:9,61-62`（IP は制限の鍵にだけ使う）、`src/lib/popup/stats.ts:20-26` |
| POP-018 | 集計の加算が同時実行で漏れない | コード読解 | `INSERT ... ON CONFLICT DO UPDATE` の 1 文 | 合格 | `stats.ts:20-26` |
| POP-019 | 計測の応答 | コード読解 | 204、`no-store`、照合済み Origin の CORS | 合格 | `track/route.ts:78` |
| POP-020 | 画像配信の公開範囲 | コード読解 | 公開中の案は誰でも、下書き・停止中は持ち主だけ | 合格 | `src/app/api/popup/public/image/[id]/route.ts:27-32`。既存指摘 SEC-031 |
| POP-021 | 画像パスの出どころ | コード読解 | DB の値だけ。入力から受けない。形式を正規表現で検査 | 合格 | `image/[id]/route.ts:24`、`src/lib/popup/storage.ts:73`、`schema.ts:228-232` |
| POP-022 | 画像の差し替えとキャッシュ | コード読解 | パスに中身のハッシュを含み、URL の v で切り替える | 合格 | `storage.ts:64-66`、`dto.ts:41-45`、`image/[id]/route.ts:41` |
| POP-023 | 画像の Content-Type | コード読解 | 保存時にバイト列で判定した形式の拡張子から決める | 合格 | `storage.ts:20-34,52-53` |
| POP-024 | 画像を第三者サイトに読ませるヘッダ | コード読解 | `Cross-Origin-Resource-Policy: cross-origin` | 合格 | `image/[id]/route.ts:42` |
| POP-025 | embed.js の XSS（利用者の文字） | コード読解 | すべて `textContent`、`innerHTML` を使わない | 合格 | `public/popup/embed.js:101-106,381-416`。単体テスト `src/lib/popup/schema.test.ts:148` |
| POP-026 | embed.js のリンク先 | コード読解 | http(s) 以外（`javascript:` `data:`）を描かない | 合格 | `embed.js:37-45,361,396,408` |
| POP-027 | embed.js の色（CSS に入る値） | コード読解 | `#rrggbb` 以外は既定色に落とす | 合格 | `embed.js:274-276`。保存側も `schema.ts:150-156` |
| POP-028 | embed.js とサイト CSS の干渉 | コード読解 | Shadow DOM、`:host{all:initial}` | 合格 | `embed.js:209,283` |
| POP-029 | 外部リンクの `rel=noopener` | コード読解 | 別タブで開くリンクに付ける | 合格 | `embed.js:342-348` |
| POP-030 | embed.js が Cookie を使わない | コード読解 | localStorage / sessionStorage だけ | 合格 | `embed.js:55-67,138-142` |
| POP-031 | embed.js がサイトの履歴を書き換えない | コード読解 | `history` 非使用、1 秒ごとの監視 | 合格 | `embed.js:469-478`。テスト `schema.test.ts:154` |
| POP-032 | embed.js のサイトキー検査 | コード読解 | 形式外なら通信しない | 合格 | `embed.js:491` |
| POP-033 | embed.js が応答の `track` URL を使う点 | コード読解 | 検査して使う | 合格 | `embed.js:500` は `safeUrl` で http(s) に限る。サーバー側は `appOrigin()` 固定（`config/route.ts:55`、`dto.ts:27-34`）。DB が書き換えられても他ドメインへ送らないわけではないが、応答は自サーバーが作る |
| POP-034 | embed.js の差分（origin/main 比） | diff | 既定のボタン色だけの変更で、`schema.ts` の既定と一致 | 合格 | `git diff origin/main...HEAD -- public/popup/embed.js`（`#ff5a36` → `#0066ff`）、`schema.ts:124` |
| POP-035 | embed.js のアクセシビリティ | コード読解 | `role=dialog`、`aria-label`、Esc、フォーカス移動 | 合格 | `embed.js:304-311,339-340,431-435` |
| POP-036 | プレビューでは計測しない | コード読解 | preview モードで track を送らない | 合格 | `embed.js:112-113,480-489` |
| POP-037 | 画像型の alt | コード読解 | `img.alt` に代入（HTML 解釈なし） | 合格 | `embed.js:364`、長さ 100 字（`schema.ts:233`） |
| POP-038 | X-Frame-Options との両立 | 既存指摘の参照 | iframe を使わない | 合格 | 既存指摘 SEC-032。プレビューは自サイト内の `srcDoc` iframe（`src/components/popup/PopupPreview.tsx:83-88`） |
| POP-039 | 管理 API のログイン確認 | コード読解・テスト読解 | 全ハンドラで `getPopupUserId()` | 合格 | 9 ファイル全て。静的検査 `src/lib/popup/scope.test.ts:32-37` |
| POP-040 | siteId / popupId の所有者照合（IDOR） | コード読解 | `findFirst({ id, userId })` の二重条件 | 合格 | `access.ts:25-33`、`popup-read.ts:62,91,125`、`popup-write.ts:36-39`、`sites/[id]/route.ts:33,57`、`popups/[id]/route.ts:46`。既存指摘 SEC-094 |
| POP-041 | 他人の ID で存在の有無を漏らさない | コード読解 | 他人も存在しないも同じ 404 | 合格 | `popup-read.ts:11,66,92,126`、`sites/[id]/page.tsx:2` |
| POP-042 | 提案回数・サイト数の上限を作成前に原子的に数える | コード読解 | Serializable トランザクション内で count → create | 合格 | `access.ts:45-77`（`popupProposals` は削除分も数える、`popupSites` は未削除だけ）。既存指摘 BILL-076 |
| POP-043 | 失敗時の枠の戻し | コード読解 | 読み取れないサイトで枠を失わせない | 合格 | `src/lib/popup/propose.ts:83-85` はサイト行を物理削除して枠を戻す。LLM 呼び出し後の失敗（文言生成や DB 保存の失敗）でも戻るので原価だけ残るが、利用者が意図的に起こせる経路は無い |
| POP-044 | 1 サイトの案数上限 | コード読解 | 原子的に数える | 不合格 | `sites/[id]/popups/route.ts:30-31,54` は count の後に create で、同時押しで 20 を超えうる。AI も課金も使わないので影響は小さい（C） |
| POP-045 | 案の編集で保存する値の検査 | コード読解 | `sanitize*()` を必ず通す。画像パスは入力から受けない | 合格 | `popup-write.ts:46,64-75`、`schema.ts:196-268`。テスト `schema.test.ts:72` |
| POP-046 | 「AIに聞く」型の質問文 | コード読解 | asklink の機械チェックを通し、URL はサーバーで組み立てる | 合格 | `popup-write.ts:47-51`（`checkQuestion` + `buildChatgptUrl`） |
| POP-047 | 公開（live）前の必須項目 | コード読解 | 見出し・ボタン・リンク・画像の不足で 422 | 合格 | `popup-write.ts:54-61`、`schema.ts:275-289` |
| POP-048 | 保存するリンク先 URL | コード読解 | http(s) だけ、認証情報付き URL は拒否、4000 文字まで | 合格 | `schema.ts:162-174` |
| POP-049 | ドメイン変更の正規化 | コード読解 | `parseDomain` でホストだけにする | 合格 | `sites/[id]/route.ts:39-43`、`schema.ts:299-310` |
| POP-050 | サイト削除の扱い | コード読解 | ソフト削除、公開中の案を停止 | 合格 | `sites/[id]/route.ts:52-63` |
| POP-051 | 案の複製元の範囲 | コード読解 | 同じサイト・同じ利用者の案だけ | 合格 | `sites/[id]/popups/route.ts:37-39` |
| POP-052 | 管理 API の JSON 本文サイズ | コード読解 | 上限あり | 未確認 | `req.json()` に明示の上限なし（`popups/[id]/route.ts:33` ほか）。Vercel の既定（4.5MB）に依存。中身は `sanitize*()` で文字数を切るので保存量は膨らまない |
| POP-053 | 対話トランザクションのタイムアウト | コード読解 | `maxWait` / `timeout` 指定 | 不合格 | `access.ts:67` は指定あり。`propose.ts:52` の保存トランザクションは未指定（既定 5 秒）。既存指摘 DB-023 |
| POP-054 | 本ブランチでの列追加の有無 | git diff | origin/main に無い列を足していない | 合格 | `git diff origin/main HEAD -- prisma/schema.prisma` に popup / asklink モデルの行が無い。`companyProfileId` は origin/main にも存在（`prisma/schema.prisma:4655`） |
| POP-055 | `popup_site.companyProfileId` の本番反映 | 文書読解 | 反映済みの記録がある | 未確認 | HEAD の `reference/services/popup.md:355-362` は「**本番 DB に未反映**。main に入れる前に反映する」。origin/main の同文書 §16 は「本番DBに追加（ユーザーの承認の上で実施）」と手順として書くが、適用日時の記録が無い。`prisma/manual-migrations/` に SQL も無い。本番の状態はこの点検では確かめられない |
| POP-056 | 列が未反映のとき壊れない API（select 明示） | コード読解 | `select` を明示していれば P2022 にならない | 合格 | 公開 3 本すべて明示: `config/route.ts:29`、`track/route.ts:66`、`image/[id]/route.ts:22`。ほかに `sites/[id]/route.ts:33,57`、`sites/[id]/popups/route.ts:27`、`popup-read.ts:171`（ホームの集客カード）、`access.ts:64`（作成は `select: { id }`） |
| POP-057 | 列が未反映のとき壊れる API（全列 select） | コード読解 | 一覧化 | 未確認 | `popup_site` を全列で読む箇所: (1) `popup-read.ts:39-44` `listSites` → `GET /api/popup/sites` と `/popup`（ログイン後トップ） (2) `popup-read.ts:62-65` `getSiteDetail` → `GET /api/popup/sites/[id]` と `/popup/sites/[id]` (3) `popup-read.ts:91` `getPopupForEdit`（`include: { site: true }`）→ `GET /api/popup/popups/[id]` と `/popup/edit/[id]` (4) `propose.ts:53-56` `tx.popupSite.update`（戻り値が全列）→ `POST /api/popup/sites` と道具 `popup.proposeDrafts`。(4) は LLM を 4〜8 回呼んだ後に落ち、`catch` でサイト行を消して 500 を返す。`popup` と `popup_stat` には新列が無いので `popups/[id]` の PATCH/DELETE・`stats`・`image` アップロードは壊れない |
| POP-058 | 画像アップロードの上限と形式 | コード読解 | 2MB、`content-length` 事前検査、PNG/JPEG/WebP/GIF をバイト列で判定、sharp で寸法 50〜4000px | 合格 | `popups/[id]/image/route.ts:24-26`、`storage.ts:13,20-29,51-63`。既存指摘 SEC-067 |
| POP-059 | `content-length` が無い本文 | コード読解 | 読んだ後の長さでも検査 | 合格 | `storage.ts:51`（`buf.length > MAX_IMAGE_BYTES`） |
| POP-060 | SVG などスクリプトを含みうる形式の拒否 | コード読解 | 4 形式以外は拒否 | 合格 | `storage.ts:20-29`（SVG はマジックバイトに無いので null） |
| POP-061 | 画像の保存先 | コード読解 | 非公開バケット。公開は API が中継 | 合格 | `storage.ts:36-40`（`ensurePrivateImageBucket`）。既存指摘 SEC-061 |
| POP-062 | 画像型の案だけがアップロードできる | コード読解 | kind 検査 | 合格 | `popups/[id]/image/route.ts:22` |
| POP-063 | 案の削除後の画像 | コード読解 | 孤児の扱いが決まっている | 合格 | `popups/[id]/route.ts:40` に「画像は Storage に残る（複製が使うことがある）」と明記。容量は 2MB × 20 案 × サイト数で有限（C 程度の注記） |
| POP-064 | `public/popup/shots` と差し替え画像の中身 | 画像を目視 | 実データ・個人情報・秘密を含まない | 合格 | `shots/1-input.webp` `2-process.webp` `3-output.webp` はシロクマのイラスト（画面の実写ではない）。`step-1〜3.webp` は shots と同サイズ（同じ画像の別名） |
| POP-065 | 削除した `public/popup/icon.png` の参照 | grep | 参照が残っていない | 合格 | `src` に参照なし。画面は `/ui-renewal/mascots/popup.webp`（`Tool.tsx:173`）と `/renewal/icons/popup.webp` を使う |
| POP-066 | 提案で使う外部 AI | コード読解 | テキスト生成だけ。画像生成 API を呼ばない | 合格 | `src/lib/popup/proposals.ts:4-5`、`propose.ts:48-50`（`readSite` / `generateLinks` / `generateBannerCopy`）。1 回の提案で最大 1 + 2×3 + 1 = 8 回（`agent-tools.ts:99-100`） |
| POP-067 | テキスト AI のモデルとタイムアウト | コード読解 | モデル ID が固定され、呼び出しに時間上限がある | 未確認 | モデルは `GEMINI_TEXT_MODEL_DEFAULT`（`seo/lib/gemini.ts:214-215`。同ファイルの注記では Claude がプライマリで Gemini がフォールバック。`popup.md:302` の実測は Claude Haiku 4.5 ×4 回）。`seo/lib/gemini.ts` に `timeout` / `AbortSignal` の記述が見つからず、個別呼び出しの時間上限は確認できなかった。ルートの `maxDuration = 300`（`sites/route.ts:3`）で全体は止まる |
| POP-068 | AI のエラー本文を利用者に返さない | コード読解 | 例外名だけログ、利用者には定型文 | 合格 | `propose.ts:86-88`、`sites/route.ts:21-28` |
| POP-069 | サイト読み取りの SSRF | コード読解 | safe-fetch 経由（private IP 遮断、リダイレクト毎に再検証、15 秒、2MB） | 合格 | `src/lib/asklink/site.ts:141-148`、`src/lib/net/safe-fetch.ts:33-67,137-227`。既存指摘 SEC-058 |
| POP-070 | AI が存在しない URL を作らない | コード読解 | ページ内リンクの候補番号で選ばせる | 合格 | `site.ts:7-8,106-127,189-198` |
| POP-071 | エージェントの道具の区分と承認 | コード読解 | publish は irreversible・承認必須、入力は zod strict | 合格 | `src/lib/popup/agent-tools.ts:60,116-130`。テスト `read.test.ts:143-166` |
| POP-072 | 新しい枠（ds-shell）の切り替え | コード読解 | フラグ OFF では従来の枠、未ログインは枠なし | 合格 | `src/app/popup/layout.tsx:19-38`、`src/lib/ui-shell.ts`（`UI_SHELL_SERVICES`） |
| POP-073 | 公開の口が layout を通らない（R-7） | コード読解 | `/api/popup/public/*` と `/popup/embed.js` に AppShell が掛からない | 合格 | `public/popup/embed.js` は静的ファイル。API は `src/app/api` 配下で `src/app/popup/layout.tsx` の外 |
| POP-074 | 読込・空・エラー・権限なしの表示 | コード読解 | 4 状態すべてに画面がある | 合格 | `loading.tsx`（sites/[id]・edit/[id]）、`src/components/popup/ui.tsx:163-203`、`src/app/popup/error.tsx` |
| POP-075 | 無限ローディングが無い | コード読解 | 通信の成否に関わらず loading を解除する | 合格 | `Tool.tsx:118-120`（finally）、`SiteDetailClient.tsx:194-197`、`EditClient.tsx:122-131,210-212,238-240` |
| POP-076 | 401 時の扱い | コード読解 | サインインへ送る | 合格 | `Tool.tsx:96-99`、`SiteDetailClient.tsx:186-189`、`EditClient.tsx:189-192`、`sites/[id]/page.tsx:17`、`edit/[id]/page.tsx:15` |
| POP-077 | 絵文字を使わない | grep | UI の文字列に絵文字が無い | 合格 | `src/app/popup`・`src/components/popup`・`src/lib/popup`・`embed.js` に 0 件（コメントの注意記号は除く）。アイコンは lucide |
| POP-078 | 日本語・敬語 | コード読解 | 利用者向け文言が丁寧語 | 合格 | `Tool.tsx:170`、`SiteDetailClient.tsx:55-68,383,396`、`ui.tsx:198` ほか。技術用語（ステータスコード・例外名）を出さない（`error.tsx:4`） |
| POP-079 | レスポンシブ | コード読解 | 375px で横スクロールが出ない | 未確認 | `grid lg:grid-cols-*`、`max-w-*`、`popup-ds.css:57,71`（767px 以下）、プレビューは欄の幅に縮小（`PopupPreview.tsx:50-76`）。`popup.md:348` に 375px / 1280px の目視記録があるが、本点検では描画していない |
| POP-080 | 未保存の編集を離れるときの確認 | コード読解 | `beforeunload` | 合格 | `EditClient.tsx:140-148` |
| POP-081 | プレビュー iframe の JSON 注入 | コード読解 | `</script>` で抜けられない | 合格 | `PopupPreview.tsx:35-38`（`< > &` と U+2028/2029 をエスケープ） |
| POP-082 | 開発用の状態見本ページ | コード読解 | 本番では 404 | 合格 | `src/app/popup/dev/states/page.tsx:22` |
| POP-083 | popup の公開状態（HEAD と origin/main の食い違い） | コード読解・git | 本番の公開状態を落とさない | 不合格 | HEAD: `src/lib/services.ts:1950`（UNLISTED に popup）、`:1717`（coming_soon）、`src/app/popup/layout.tsx:16`（noindex）、`src/lib/safe-signin-callback.ts:20`（popup 無し）。origin/main: `UNLISTED_SERVICE_IDS = new Set([])`、layout の noindex 削除、`PUBLIC_INTRO_SERVICES` に popup。origin/main の 142e29b4「ドヤポップアップを正式公開する」がマージ対象に含まれていない。詳細は不合格節 |
| POP-084 | ログイン後画面の noindex | コード読解 | `/popup/sites` `/popup/edit` に `X-Robots-Tag` | 合格 | `next.config.js:22,211-214` |
| POP-085 | sitemap と公開一覧 | コード読解 | `HIDDEN_SERVICE_IDS` に従う | 合格 | `src/app/sitemap.ts:61-63,93-95`、`services.ts:1956-1959`。HEAD では popup は出ない（origin/main では出る。POP-083 と同じ論点） |
| POP-086 | Vercel の Bot 対策と公開の口 | 文書読解 | `/popup/embed.js` と `/api/popup/public/*` が Security Checkpoint の対象外 | 未確認 | `popup.md:308-313`。確認中に embed.js が 403 の確認ページになった記録がある。Vercel の設定はコードに無く、ユーザーの操作が要る |
| POP-087 | 単体テストがビルドに入っている | package.json 読解 | `test:popup` が存在し、ビルドで走る | 合格 | `package.json:18`。既存指摘 BLD-017 |
| POP-088 | ホームの集客カードが popup の read 関数を使う | コード読解 | `getPopupSummary` が select 明示で、サイト 0 件なら `siteCount: 0` | 合格 | `popup-read.ts:168-190` |
| ASK-001 | 公開の口の有無 | ルート一覧 | 第三者・未ログインが触れる API・ページ | 該当なし | `src/app/api/asklink/**` は 4 ルートで全てログイン必須。`src/app/asklink/**` に公開の回答ページ・OGP ルートは無い。「公開リンク」は `https://chatgpt.com/?q=...`（`src/lib/asklink/link.ts:18,25-27`） |
| ASK-002 | LP の index 方針 | コード読解 | 公開中（active）は index、料金ページも index | 合格 | `src/app/asklink/layout.tsx:10-13`（noindex なし）、`services.ts:1669`（active）、`asklink/pricing/layout.tsx:4` |
| ASK-003 | ログイン後画面の noindex | コード読解 | `/asklink/history` に `X-Robots-Tag` | 合格 | `next.config.js:21` |
| ASK-004 | 管理 API のログイン確認 | コード読解・テスト読解 | 全ハンドラで `getAskLinkUserId()` | 合格 | 4 ファイル全て。`src/lib/asklink/scope.test.ts:28-33` |
| ASK-005 | runId の所有者照合（IDOR） | コード読解 | `ownRun(userId, id)` の二重条件 | 合格 | `src/lib/asklink/access.ts:25-28`、`runs/[id]/route.ts:25,39`、`links/route.ts:28`、`banners/[kind]/route.ts:31,74`。既存指摘 SEC-094 |
| ASK-006 | ID の形式検査 | コード読解 | cuid 形式以外は 404 | 合格 | `access.ts:31-33` |
| ASK-007 | 作成回数の上限を作成前に原子的に数える | コード読解 | Serializable で count → create | 合格 | `access.ts:39-69`。既存指摘 BILL-076 |
| ASK-008 | 失敗時の枠の戻し | コード読解 | 読み取れないサイトで枠を失わせない | 合格 | `runs/route.ts:72-74`（run を物理削除）。LLM 呼び出し後の失敗でも戻る点は POP-043 と同じ |
| ASK-009 | リンク作り直しの回数上限 | コード読解 | 生成前に `updateMany` で回数を確保 | 合格 | `links/route.ts:13,31-38`（10 回） |
| ASK-010 | バナー生成の回数上限 | コード読解 | 1 種類 2 回まで、生成前に確保、生成中の二重起動を 409 | 合格 | `banners/[kind]/route.ts:34-55`、`src/lib/asklink/dto.ts:34` |
| ASK-011 | 1 run あたりの画像生成の最大回数 | 計算 | 上限が有限 | 合格 | 3 種類 × 2 回（`BANNER_MAX_GENERATIONS`）× 最大 3 試行（`banner.ts:17,190`）= 最大 18 枚。OCR（gpt-4o）は 1 試行あたり最大 1 + 8 回（`banner.ts:81-90,119-135`）。無料 3 run（`plan-limit.ts:40`）で 54 枚、プロ 30 run/月で 540 枚が理論上限 |
| ASK-012 | 画像 API の `quality` / `size` | コード読解 | 未指定（auto）で回さない | 合格 | `banner.ts:192-197`（`size: WxH`、`quality: 'medium'`）。`image-generator.ts:112-118` |
| ASK-013 | 画像モデルとフォールバック | コード読解 | モデル ID 固定、フォールバック先も固定 | 合格 | `image-generator.ts:76-85`（gpt-image-2 → Nano Banana Pro）、OCR は `vision.ts:19`（`gpt-4o`、環境変数で変更可） |
| ASK-014 | フォールバック先の比率ずれ | コード読解 | 切り抜かずに収める | 合格 | `banner.ts:141-155` |
| ASK-015 | 作り直しの時間上限 | コード読解 | `maxDuration = 300` に収める | 合格 | `banner.ts:19,191`（150 秒を過ぎたら次の試行を始めない）、`banners/[kind]/route.ts:3` |
| ASK-016 | 作り直し時の失敗の扱い | コード読解 | 不合格を黙って捨てない | 合格 | `banner.ts:180-206`（最後の結果を「要確認」で返す）、`banner.ts:118-127`（OCR 失敗は合格扱いにしない） |
| ASK-017 | 生成中のまま止まった行 | コード読解 | 一定時間後にやり直せる | 合格 | `banners/[kind]/route.ts:15,44`（6 分）。既存指摘 API-039。再取得でも `generations` が増えるので、関数タイムアウト 1 回で利用者の作り直し枠が 1 つ減る（C 程度の注記） |
| ASK-018 | `ASKLINK_IMAGE_MOCK` の本番混入 | 既存指摘の参照 | 本番で無害 | 合格 | `banner.ts:21-23`。既存指摘 ENV-016 |
| ASK-019 | バナーの保存先と配信 | コード読解 | 非公開バケット、署名 URL は都度発行で DB に保存しない | 合格 | `banners/[kind]/route.ts:61`（`uploadPng`）、`src/lib/adimage/storage.ts:9-11,42-47`、`dto.ts:54`（3600 秒） |
| ASK-020 | バナー保存パス | コード読解 | userId / runId / kind / 時刻で構成し、入力から受けない | 合格 | `banners/[kind]/route.ts:61`。kind は `findBannerSpec` で 3 値に限定（`types.ts:57-65`） |
| ASK-021 | AI のエラー本文を返さない | コード読解 | 例外名だけログ、利用者には定型文 | 合格 | `runs/route.ts:78-79`、`links/route.ts:52-53`、`banners/[kind]/route.ts:68` |
| ASK-022 | サイト読み取りの SSRF | コード読解 | safe-fetch 経由 | 合格 | `site.ts:141-148`。既存指摘 SEC-058 |
| ASK-023 | 質問文の URL | コード読解 | サイトで見つかった URL だけ | 合格 | `link.ts:100-105`、`site.ts:213-215`。テスト `link.test.ts:59` |
| ASK-024 | 質問文の禁止表現・字数・URL 長 | コード読解 | 450 字、4000 文字、禁止語、`utm_` | 合格 | `link.ts:10-14,55-65,81-111`。テスト `link.test.ts:65-108` |
| ASK-025 | 編集の保存 | コード読解 | サーバーで URL を作り直し、機械チェックをやり直す。入力は長さを切る | 合格 | `runs/[id]/route.ts:42-54`（question 2000 字、buttonLabel 60 字で切った後 `buildLink`） |
| ASK-026 | 要確認（needsReview）のまま保存できる点 | コード読解 | 第三者に出る口が無い | 合格 | `runs/[id]/route.ts:51-53`。本人が chatgpt.com の URL を手で貼る用途で、自サーバーから公開されない（ASK-001） |
| ASK-027 | 手入力の説明の長さ | コード読解 | 20〜3000 字 | 合格 | `runs/route.ts:13-14,27-30`、`site.ts:15,136`（12000 字で切る） |
| ASK-028 | テキスト AI のモデルとタイムアウト | コード読解 | POP-067 と同じ | 未確認 | `src/lib/asklink/generate.ts:184-186,245-247`、`site.ts:187`。個別のタイムアウトは確認できず。ルートの `maxDuration` は 300 / 120 |
| ASK-029 | 1 run あたりのテキスト AI 呼び出し回数 | 計算 | 上限が有限 | 合格 | 読み取り 1 + 2 本 × 最大 3 試行（`generate.ts:13,181`）+ 文言 1 = 最大 8 回。作り直し 10 回（ASK-009）× 7 回 = 70 回が上限 |
| ASK-030 | 設置用 HTML のエスケープ | コード読解 | 属性値の `& " <` をエスケープ | 合格 | `src/components/asklink/RunResult.tsx:229-231`。href は自サーバーが組み立てた chatgpt.com の URL |
| ASK-031 | 外部リンクの `rel` | コード読解 | `noopener noreferrer` | 合格 | `RunResult.tsx:204-206,407,457,473-475` |
| ASK-032 | 画面の読込・空・エラー | コード読解 | 3 状態がある | 合格 | `src/app/asklink/history/page.tsx:53-66`、`history/[id]/page.tsx:47-53` |
| ASK-033 | 無限ローディングが無い | コード読解 | 失敗時に loading を解除する | 合格 | `history/page.tsx:40`（finally）、`history/[id]/page.tsx:35`（error で解除）。401 は遷移まで「読み込んでいます」を保つ設計（`history/page.tsx:28`） |
| ASK-034 | バナー生成の自動開始 | コード読解 | 作成直後に 3 枚を順に自動で作る | 合格 | `Tool.tsx:86-87`、`useBannerQueue.ts:12-35`（1 リクエスト 1 枚）。利用者の操作無しに課金処理が走るが、サービスの約束（`services.ts:1666`「1回＝リンク2本＋バナー3枚」）どおり |
| ASK-035 | 絵文字を使わない | grep | 0 件 | 合格 | `src/app/asklink`・`src/components/asklink`・`src/lib/asklink` に 0 件 |
| ASK-036 | 日本語・敬語 | コード読解 | 丁寧語 | 合格 | `Tool.tsx:150-154,171`、`history/page.tsx:60-61`、API の文言 `runs/route.ts:26,41,79` |
| ASK-037 | レスポンシブ | コード読解 | 375px で崩れない | 未確認 | `md:flex-row`、`sm:grid-cols-3`、`max-w-6xl`（`Tool.tsx:96,115,160`）。本点検では描画していない。既存チェックリスト FE-039 は通信の集計のみ |
| ASK-038 | LP のモック | コード読解 | 実データを使わない | 合格 | `src/app/asklink/mocks.tsx:1-2` |
| ASK-039 | 新しい枠（ds-shell）への接続 | コード読解 | 統合仕様の移行順 10（ToolFrame だけ当てる） | 該当なし | asklink は `AskLinkAppLayout` のまま（`src/app/asklink/layout.tsx:30`）で、`src/lib/asklink/nav.ts` も無い。統合仕様 `ADDON-SERVICES-2026-10-18.md:40` は移行順 10 で、本ブランチの対象外。サイドバー項目は `AskLinkSidebar.tsx:44-48` に直書き（R-1 未対応の注記） |
| ASK-040 | `asklink_run` / `asklink_banner` の本番反映 | 文書読解 | 適用記録がある | 未確認 | 既存指摘 DB-020（SQL も記録も無い）。本ブランチでスキーマは変わらない（POP-054）。2026-10-09 から公開中で、既存 SEC-042 / API-054 で `GET /api/asklink/runs` が 401 を返すことは確認済みだが、テーブルの存在は確かめられていない |
| ASK-041 | 単体テストがビルドに入っている | package.json 読解 | `test:asklink` が存在 | 合格 | `package.json:17`。既存指摘 BLD-017 |
| ASK-042 | 履歴一覧の件数上限 | コード読解 | 上限あり | 合格 | `runs/route.ts:90`（100 件） |

### 不合格・要対応

| ID | 重大度 | 現象と再現条件 | 該当箇所 | 修正案 | 安全に直せるか |
| --- | --- | --- | --- | --- | --- |
| POP-083 | A | origin/main は 2026-10-18 に popup を正式公開（UNLISTED から外す・noindex 解除・`PUBLIC_INTRO_SERVICES` 追加・`verify-google-analytics-services.cjs` の固定値更新）したが、統合ブランチはその前の状態（UNLISTED・coming_soon・noindex）のまま。統合ブランチを main に入れる際に origin/main 側を落とすと、公開済みの popup が LP 非表示・noindex・sitemap 除外に戻り、サインイン後の遷移先（`safe-signin-callback.ts`）からも外れる。再現: 統合ブランチを「こちら優先」で main にマージし、`services.ts:1950` と `popup/layout.tsx:16` を見る | `src/lib/services.ts:1717,1950`、`src/app/popup/layout.tsx:12-17`、`src/app/popup/pricing/layout.tsx:4`、`src/lib/safe-signin-callback.ts:20`、`src/lib/seo.ts:74`、`scripts/security-regression/verify-google-analytics-services.cjs` | マージ前に origin/main（142e29b4）を統合ブランチへ取り込み、popup の公開状態は origin/main 側を採用する。衝突する 6 箇所を `reference/services/popup.md` の「公開の切り替え」手順（`popup.md:318-324`）と突き合わせて確認する | はい（設定値の差し替えだけ。データは変わらない） |
| POP-055 / POP-057 | A（未確認。未反映なら本番停止級） | `popup_site.companyProfileId` が本番 DB に無いまま本ブランチ（スキーマは origin/main と同一）をデプロイすると、`popup_site` を全列で読む 4 経路が P2022 で落ちる: `GET /api/popup/sites`（`/popup` ログイン後トップ）、`GET /api/popup/sites/[id]`（`/popup/sites/[id]`）、`GET /api/popup/popups/[id]`（`/popup/edit/[id]`）、`POST /api/popup/sites`（提案作成。LLM を呼んだ後に落ちてサイト行を消す）。公開 3 API（config / track / image）と計測、ホームのカードは select 明示なので壊れない。origin/main は既にこのスキーマで本番にあるため、本番が動いているなら反映済みの可能性が高いが、適用記録が無い | `prisma/schema.prisma:4655`、`src/lib/popup/popup-read.ts:39-44,62-65,91`、`src/lib/popup/propose.ts:53-56`、`reference/services/popup.md:355-362` | デプロイ前に本番で `SELECT column_name FROM information_schema.columns WHERE table_name='popup_site' AND column_name='companyProfileId'` を確認し、無ければ `ALTER TABLE "popup_site" ADD COLUMN IF NOT EXISTS "companyProfileId" TEXT;` を適用（`doya-db-push` スキルの手順。承認要）。適用した SQL を `prisma/manual-migrations/` に残す | はい（追加のみ・null 可。既存行に影響なし）。本番確認と適用はユーザーの承認が要る |
| ASK-040 | A（既存指摘 DB-020。未確認） | `asklink_run` / `asklink_banner` の本番反映記録が無い。本ブランチでスキーマは変わらないので新たな悪化は無い | `prisma/schema.prisma:4577-4626`、`reference/services/asklink.md:11` | POP-055 と同じタイミングで `information_schema` を確認し、DDL を `prisma/manual-migrations/` に保存する | はい（確認と記録のみ） |
| POP-086 | B | Vercel の Security Checkpoint（JavaScript の確認ページ）が `/popup/embed.js` や `/api/popup/public/*` に出ると、第三者サイトからの `<script>` 読み込みと fetch が 403 の HTML を受け取り、ポップアップが無言で出なくなる。`popup.md:308` に確認中に発生した記録がある | Vercel プロジェクトの Firewall 設定（コード外）、`reference/services/popup.md:308-313` | Vercel の Firewall で `/popup/embed.js` と `/api/popup/public/*` を Checkpoint の対象から外す。設定後に別ドメインの curl（`Origin` を登録ドメインにして）で 200 を確かめる | ユーザーの操作が要る（コードの変更ではない） |
| POP-009 | C（既存指摘 SEC-114） | `GET /api/popup/public/config?k=<不正なキー>` の連打がそのまま DB の `findUnique` になる（404 はキャッシュされない） | `src/app/api/popup/public/config/route.ts:25-31` | 404 にも短い `s-maxage` を付けるか、エッジでのレート制限を入れる | はい |
| POP-011 | C（既存指摘 API-019） | DB 例外時に CORS ヘッダ無しの空 500 になり、第三者サイトでは「出ない」だけで気づけない | `config/route.ts:23-63` | try で包み、CORS ヘッダ付きの空設定（`popups: []`）を `no-store` で返す | はい |
| POP-016 | C（既存指摘 SEC-030） | 計測の回数制限がインスタンス内メモリで、サーバーレスでは実質効かない。統計の水増しのみで漏えいなし | `track/route.ts:22-35,61-62` | 既存指摘の修正案（共有ストア・サイト単位の日次上限）に同じ | はい |
| POP-044 | C | 1 サイト 20 案の上限が count → create で非原子。同時に「一から作る」を押すと 21 案以上になりうる。AI も課金も使わない | `src/app/api/popup/sites/[id]/popups/route.ts:30-31,54` | トランザクション内で数えるか、`popup` の `siteId` ごとの件数を `updateMany` 型で先取りする | はい |
| POP-053 | C（既存指摘 DB-023） | 提案保存のトランザクションに `timeout` 指定が無い（既定 5 秒） | `src/lib/popup/propose.ts:52-74` | `{ maxWait: 10000, timeout: 20000 }` を付ける（`access.ts:67` と同じ） | はい |
| POP-005 | C（未確認） | 同じホストで http と https の両方から読む場合、CDN が `Vary: Origin` を鍵にしなければ、先にキャッシュされた Origin 向けの CORS ヘッダが返り、片方で読めない。他ドメインの設定が漏れることは無い | `config/route.ts:59`、`public/popup/embed.js:493` | embed.js の `h` に `location.origin`（scheme 込み）を入れるか、`s-maxage` を外して `private` にする | はい |

要点:

- S 級は無い。公開の口（config / track / image / embed.js）は、キーの形式検査・登録ドメイン照合・CORS の限定・textContent 描画・http(s) 限定・非公開バケットの中継が揃っており、第三者サイトへの XSS や他サイトの設定の読み出しは見つからなかった。
- A 級は 3 件で、いずれも「コードの欠陥」ではなく「本番移行の手順」の問題。(1) popup の公開状態が origin/main と食い違う（マージで戻る恐れ）、(2) `companyProfileId` の本番反映記録が無い、(3) asklink 2 テーブルの反映記録が無い（既存指摘）。
- 統合ブランチが popup / asklink に足したのは画面の枠（ds-shell の切り替え）、読み取り関数の集約、エージェントの道具、画像の差し替えで、API の認可・上限・入力検査は origin/main から変えていない。


---

## 11. リニューアルの画面の枠と既存サービスへの影響

対象: `(統合ブランチの点検用 worktree)/`（`integrate/agent-renewal` 3e755c43）。origin/main との差分を読み取りで点検した。ビルド・開発サーバー・本番・DB には触れていない。
前提: この統合ブランチは統合仕様 §9 の「段0〜段5」までである。`/home`（経営ホーム）・エージェント・`/ui-renewal` 見本・新 LP（段6、`feat/ui-renewal-sample`）は入っていない。そのため既存チェックリスト 7章の RNW-030 / RNW-046 / RNW-022 / RNW-036 の対象コードはこのブランチに存在しない（下の SHL-060〜063）。ただし枠側に `/home` へのリンクだけが残っている（SHL-001）。
根拠の file:line は対象リポジトリからの相対パス。

| ID | 項目 | 確認方法 | 合格条件 | 結果 | 根拠 |
|---|---|---|---|---|---|
| SHL-001 | ホーム（`/home`）へのリンク先が実在する | `src/app/home` の有無と `SHELL_HOME.href` を照合 | リンク先のルートが存在する | 不合格 | `src/components/shell/tools.ts:77` が `href: '/home'`。`src/app/home` は存在しない（`ls src/app`）。統合仕様 §9 段0 は「`/home` とエージェントは入れない」と明記 |
| SHL-002 | サイドバー・ブランド・下タブ・パンくずの「経営ホーム」が 404 にならない | AppShell と ToolFrame の `SHELL_HOME` 参照箇所を読む | 全導線が実在ページに向く | 不合格 | `src/components/shell/AppShell.tsx:169,181,195,211`（ブランド 2 箇所・ナビ・下タブ）、`src/components/shell/ToolFrame.tsx:37`（パンくず）。すべて `/home` |
| SHL-003 | 段0の範囲が仕様どおり（ds・shell・フラグ・nav 型のみ） | `git diff --stat` | `/home`・エージェントが入っていない | 合格 | 差分一覧に `src/app/home`・`src/lib/home` なし。`src/components/ds/*`・`src/components/shell/*`・`src/lib/ui-shell.ts` のみ |
| SHL-004 | AppShell が認証状態を自分で判断しない（枠だけ） | AppShell.tsx を読む | `useSession` を使わず、表示の可否はサーバー layout が決める | 合格 | `src/components/shell/AppShell.tsx:10`「中身のデータ取得・認可は各ページ側の責務」。`useSession` 不使用 |
| SHL-005 | 収入管理: 未ログインをアプリ枠で包まない | `src/app/income/layout.tsx` | `getServerSession` で分岐し、未ログインは children のみ | 合格 | `src/app/income/layout.tsx:18-19` |
| SHL-006 | 収入管理: ログイン後は AppShell＋ToolFrame に載る（§9 段4） | 同上 | AppShell→IncomeFrame→ToolFrame | 合格 | `src/app/income/layout.tsx:21-23`、`src/components/income/IncomeFrame.tsx:12` |
| SHL-007 | 支出管理: `/expense` 入口は未ログインで LP、ログイン後に組織へ | `src/app/expense/page.tsx`・`Entry.tsx` | サーバーで session 分岐 | 合格 | `src/app/expense/page.tsx:8-10`、`src/app/expense/Entry.tsx:18-26` |
| SHL-008 | 支出管理: `/expense/[orgSlug]` の枠は未ログインで出ない | `src/app/expense/[orgSlug]/layout.tsx` | 未ログインでは AppShell を描かない | 不合格 | layout は `'use client'` で session 判定前に `<AppShell>` と `<Loading />` を描き、`/api/expense/usage` が 401 を返してから `/expense` へ `router.replace`（`src/app/expense/[orgSlug]/layout.tsx:21-30,43-47`）。未ログインでも一瞬アプリ枠が出る。中身のデータは出ない |
| SHL-009 | 支出管理: `useSession` を使う client layout が SessionProvider の内側にある | Providers を確認 | ルートで SessionProvider が包む | 合格 | `src/components/Providers.tsx:5,8`（差分なし）。`src/app/expense/[orgSlug]/layout.tsx:5,17` |
| SHL-010 | 支出管理: 読込・権限なし・正常の 3 状態を描く | 同 layout | 3 状態に対応する表示がある | 合格 | `src/app/expense/[orgSlug]/layout.tsx:47-49`、`src/components/expense/ui.tsx:172-176`（forbidden／error＋もう一度） |
| SHL-011 | 社内インタビュー: 未ログインを枠で包まない | `src/app/shanai/layout.tsx` | session 分岐 | 合格 | `src/app/shanai/layout.tsx:24-30` |
| SHL-012 | 社内インタビュー: 回答画面（第三者）に AppShell・暫定サイドバーを出さない（R-7） | `ShanaiFrame`・`guest-path.ts` | `/shanai/answer/` がゲスト判定 | 合格 | `src/lib/ui/guest-path.ts:25`、`src/components/shanai/ShanaiFrame.tsx:20`。`src/app/shanai/answer/[token]/layout.tsx:4-7` で noindex |
| SHL-013 | ポップアップ: 未ログインを枠で包まない | `src/app/popup/layout.tsx` | session 分岐 | 合格 | `src/app/popup/layout.tsx:21-23` |
| SHL-014 | ポップアップ: 公開の口（`/api/popup/public/*`・embed.js）が layout を通らない | 同上コメントと route 構成 | 公開 API は `src/app/api` 配下 | 合格 | `src/app/popup/layout.tsx:27`、API は `src/app/api/popup/*`（layout の外） |
| SHL-015 | 展示会: 未ログインをアプリ枠で包まない | `src/app/tenjikai/layout.tsx` | session 分岐がある | 不合格 | `src/app/tenjikai/layout.tsx:24-40` に session 判定が無い。フラグ OFF では未ログインでも `TenjikaiApp`（独自サイドバー＋`ToolSwitcherMenu`、`src/components/tenjikai/TenjikaiSidebar.tsx:21`）、ON では `AppShell` が出る。`services.ts:1760 requiresAuth: true` と食い違う。LP（`Lp.tsx`）が無い |
| SHL-016 | 展示会: 生成 API はログイン必須（枠の外で守られているか） | `src/app/api/tenjikai/*` を grep | 401 を返す | 合格 | `src/app/api/tenjikai/generate/route.ts`・`image/route.ts` に `getServerSession`。`src/components/tenjikai/ImageGenModal.tsx:53,132` で 401 時にログイン導線 |
| SHL-017 | フラグ `ui.shell.<svc>` の既定が OFF | `src/lib/ui-shell.ts` | 未設定なら false | 合格 | `src/lib/ui-shell.ts:9-15`（`UI_SHELL_SERVICES` 未設定で空配列） |
| SHL-018 | フラグをサーバー側（layout）だけで読む | 各 layout | クライアントに env を出さない | 合格 | `src/app/popup/layout.tsx:28`、`src/app/shanai/layout.tsx:25`、`src/app/tenjikai/layout.tsx:25`。`NEXT_PUBLIC_` 無し |
| SHL-019 | フラグをリクエストごとに読む（ビルド時固定にならない） | 各 layout の dynamic 指定 | `getServerSession` か `force-dynamic` | 合格 | `src/app/tenjikai/layout.tsx:19` が `force-dynamic`。popup/shanai/income は `getServerSession`（cookies 参照）で動的 |
| SHL-020 | ログイン後の既定の遷移先が変わっていない | `src/lib/auth.ts` の `pages`・`callbacks.redirect` | redirect callback の追加なし | 合格 | `src/lib/auth.ts:182-185`（`signIn`/`error` のみ）。差分なし |
| SHL-021 | サインイン画面の変更が無害 | `git diff -- src/app/auth/signin/page.tsx` | エラー表示の条件のみ | 合格 | `error !== 'undefined'` の除外だけ（`src/app/auth/signin/page.tsx:50`） |
| SHL-022 | middleware の変更有無 | `git diff --stat -- src/middleware.ts` | 変更なし | 合格 | 差分なし。`src/middleware.ts:137` の matcher も従来どおり |
| SHL-023 | 管理者画面（/admin）への影響 | `git diff --stat -- src/app/admin` | 変更なし、枠の差し替えなし | 合格 | 差分なし。AppShell を import するのは 7 ファイルのみ（grep 結果: ds-preview・expense・income・IncomeFrame・PopupShellFrame・ShanaiFrame・TenjikaiShellFrame） |
| SHL-024 | SessionProvider / Providers の変更 | `git diff --stat -- src/components/Providers.tsx` | 変更なし | 合格 | 差分なし |
| SHL-025 | 既存サービスの layout.tsx が勝手に新しい枠へ差し替わっていない | 差分の `src/app/*/layout.tsx` 一覧 | 既存サービスは未変更 | 合格 | 差分は expense/income/shanai/tenjikai（新規）と popup（開発中）のみ。hr/kintai/sfa 等は無変更 |
| SHL-026 | 既存の SidebarShell と AppShell の二重表示がない | 各 Frame の構成 | 同一画面で両方を描かない | 合格 | popup/shanai/tenjikai はフラグで排他（`src/app/popup/layout.tsx:28-39`、`ShanaiFrame.tsx:21-27`、`tenjikai/layout.tsx:25-39`）。`TenjikaiApp shell` で独自サイドバーを出さない（`TenjikaiApp.tsx:152`） |
| SHL-027 | 既存ページの URL 変更・リダイレクト漏れ | `next.config.js` redirects と新ルート | 新ルートが既存 redirect と衝突しない | 合格 | `next.config.js:219-315` に `/income` `/expense` `/shanai` `/tenjikai` `/home` の redirect なし |
| SHL-028 | 新ルートが `renewal-preview` 等の既存見本と衝突しない | ルート一覧 | 重複なし | 合格 | `src/app/renewal-preview/[service]/page.tsx` は差分なし。`dynamicParams = false`・noindex（同 :31-47、`next.config.js:196-201`） |
| SHL-029 | ToolSwitcherMenu の既存サービスのアイコン・配色が壊れていない | `git diff -- ToolSwitcherMenu.tsx` | 追加のみ | 合格 | 追加 4 import と 5 行（popup 配色変更＋4 サービス追加）のみ |
| SHL-030 | ToolSwitcherMenu に BookUser の import 漏れがない（過去の統合漏れ） | import 行 | `BookUser` が import 済み | 合格 | `src/components/ToolSwitcherMenu.tsx:8`（BookUser）、:22（BadgeJapaneseYen）、:26（Store）、:32（Wallet） |
| SHL-031 | services.ts: 追加 4 サービスの status と公開区分 | `src/lib/services.ts` | `coming_soon`＋`UNLISTED_SERVICE_IDS`＋`requiresAuth: true` | 合格 | tenjikai :1760-1763、income :1805-1808、expense :1848-1851、shanai :1893-1896、UNLISTED :1950 |
| SHL-032 | 提供終了（RETIRED）がナビから外れる | `getActiveServices` と tools.ts | RETIRED は buildTools に入らない | 合格 | `src/lib/services.ts:1965-1972`、`src/components/shell/tools.ts:88`。node で突き合わせ: META にあって active でない id なし |
| SHL-033 | 開発中（UNLISTED）がログイン後の枠にだけ「開発中」バッジ付きで出る | tools.ts・AppShell | `beta` が UNLISTED 由来 | 合格 | `tools.ts:97`、`AppShell.tsx:47,112`（表示文言「開発中」） |
| SHL-034 | 公開中サービスの対応表漏れ（「その他」に落ちるもの） | active id と `TOOL_META` を突き合わせ | 漏れなし | 合格 | node で突合: active 23 件すべて META にあり。`その他` グループは空で非表示（`tools.ts:106`） |
| SHL-035 | 対応表の `href` 上書き先が実在する | `/hr/dashboard`・`/kintai/dashboard` | ルートあり | 合格 | `tools.ts:58,62`。`src/app/hr/dashboard`・`src/app/kintai/dashboard` 存在 |
| SHL-036 | 追加サービスの `pricingHref` が実在する | services.ts と `src/app` | ルートあり | 合格 | tenjikai `/pricing`（:1740、`src/app/pricing` あり）、income/expense/shanai は各 `pricing/` ディレクトリあり |
| SHL-037 | ナビの現在位置判定がサービス間で誤爆しない | `isActive`・`toolBase` | 先頭セグメント一致で判定 | 合格 | `AppShell.tsx:23-30`（`${base}/` 付きで前方一致。`/slide` と `/slashslide` 等は区別される） |
| SHL-038 | ツール内ナビ（ToolFrame）の現在位置判定が各ツールの独自判定と一致する | `isNavActive` と各 nav.ts | 詳細ページでも選択中が出る | 不合格 | ToolFrame は `src/components/shell/nav.ts:20-23` のみ使用。shanai の `/shanai/interviews/*`（`src/lib/shanai/nav.ts:25-28`）と popup の `activePrefixes`（`src/lib/popup/nav.ts:11,21-25`）は ToolFrame に渡らず、共通シェル ON のとき詳細画面でタブが何も選択されない |
| SHL-039 | アイコン名の対応表に、全 nav.ts と TOOL_META の名前がある | `SHELL_ICONS` と各 nav.ts | 名前がすべて対応表にある | 合格 | `src/components/shell/icons.tsx:18-24`。income/expense/popup/shanai/tenjikai の nav.ts と `tools.ts:40-77` の全名を目視で確認（BookUser 含む） |
| SHL-040 | 対応表にあるアイコンがインストール済み lucide に存在する | `node_modules/lucide-react/dist/esm/icons` | 全ファイルあり | 合格 | lucide-react 0.303.0。対応表 45 名すべて存在（ファイル存在チェック） |
| SHL-041 | lucide の部品（関数）をサーバー layout からクライアントへ渡していない | 各 layout・nav.ts | アイコンは文字列 | 合格 | `nav.ts:13`「部品（関数）は渡さない」。各 nav.ts は文字列。`ds-preview/layout.tsx:11-16` も文字列（未知名 `NoSuchIcon` は既定アイコンに落ちる `icons.tsx:28`） |
| SHL-042 | ds-preview が本番で 404 になる（RNW-036 相当） | `ds-preview/layout.tsx`・`page.tsx` | production で `notFound()` | 合格 | `src/app/ds-preview/layout.tsx:19`、`page.tsx:9`。配下 products/settings/unknown は layout の判定で覆われる |
| SHL-043 | ds-preview・新ルートが sitemap に出ない | `src/app/sitemap.ts` | HIDDEN 除外、ds-preview は生成対象外 | 合格 | `sitemap.ts:61-62,93-95`（`HIDDEN_SERVICE_IDS` に UNLISTED を含む `services.ts:1956-1959`）。ds-preview は services に無い |
| SHL-044 | robots.txt に新ルートの扱い漏れがない | `src/app/robots.ts` | アプリ画面は metadata/X-Robots-Tag で noindex | 合格 | `robots.ts` は差分なし。income/shanai は `next.config.js:23-24` の APP_ONLY、全 4 サービスは layout の `noindex: true`（`expense/layout.tsx:8`、`income/layout.tsx:12`、`shanai/layout.tsx:14`、`tenjikai/layout.tsx:15`） |
| SHL-045 | `/ui-renewal` 見本ページの公開（RNW-036）がこのブランチに無い | `src/app/ui-renewal` の有無 | 存在しない | 該当なし | `ls src/app` に `ui-renewal` なし。`public/ui-renewal/mascots` の画像 5 枚のみ追加 |
| SHL-046 | 追加画像の参照先が実在する | `public/renewal/icons/*`・`public/ui-renewal/mascots/*` と参照箇所 | 参照ファイルあり | 合格 | 差分で 5 アイコン＋5 マスコット追加。参照は `src/app/page.tsx`・各 Tool/Dashboard（grep） |
| SHL-047 | 空状態の絵（`public/empty/*.svg`）が揃っている | `ds/index.tsx` の `ART` | 6 種すべて存在 | 合格 | `src/components/ds/index.tsx:90-97`、`public/empty/` に 6 ファイル。種類は `src/components/EmptyState.tsx:4` と一致 |
| SHL-048 | `/home` 集計 API の負荷（RNW-030） | `src/lib/home`・`src/app/api/home` | — | 該当なし | このブランチに存在しない（段6 未統合）。統合時に RNW-030 の `take`／`maxDuration` を再確認すること |
| SHL-049 | usage-summary.ts の変更が shanai の追加だけで、既存サービスの集計に触れていない | `git diff -- src/lib/usage-summary.ts` | 追加のみ | 合格 | 追加 30 行（`usage-summary.ts:251-279`）。他 case は無変更 |
| SHL-050 | usage-summary shanai: 参照する上限キー・モデルが正本にある | plan-limit.ts・schema.prisma | キーとモデルが存在 | 合格 | `src/lib/plan-limit.ts:48,50,78,80,95,96`、`prisma/schema.prisma:5862 model ShanaiUsageLog`。import は `usage-summary.ts:23-24` |
| SHL-051 | usage-summary shanai: 本人のレコードだけを数える（IDOR） | where 条件 | `userId` で絞る | 合格 | `usage-summary.ts:257-260`（全 count に `userId`） |
| SHL-052 | usage-summary shanai: 4 本の count が並列で、全件読み込みでない | 同上 | `count` のみ | 合格 | `Promise.all` の `count` 4 本（:256-261）。findMany なし |
| SHL-053 | hydration: AppShell の localStorage 依存値を初回描画で使わない | AppShell.tsx | `useEffect` 後に state 更新 | 合格 | `AppShell.tsx:126-138`（初期 `[]`、effect で更新） |
| SHL-054 | hydration: Skeleton の遅延表示がサーバーとクライアントで一致 | `ds/index.tsx` | 初期は両方 null | 合格 | `index.tsx:121-127`（`delayMs>0` なら初期 false→effect で true） |
| SHL-055 | hydration: 時刻・乱数・locale 依存の文字列をサーバー初回描画に出していない（枠側） | AppShell・ToolFrame・ds | `new Date`/`Math.random`/`toLocale*` なし | 合格 | 3 ファイルに該当なし（grep）。`⌘K` 等は定数 |
| SHL-056 | hydration: 展示会の初回描画（Wizard）の locale 依存 | `src/lib/tenjikai/engine.ts` | SSR で描く値が locale 非依存 | 未確認 | `engine.ts:446-447` の `toLocaleString()` が locale 未指定。`daysUntil` は `new Date()` 既定（:441）。生成後（phase ready）の画面でのみ使う見込みだが、Wizard 初期表示での使用有無は未読。実機で console の hydration 警告を確認 |
| SHL-057 | hydration: RNW-046（HomeDashboard の挨拶・時刻） | `src/app/home/HomeDashboard.tsx` | — | 該当なし | ファイルがこのブランチに無い。段6 統合時に再確認 |
| SHL-058 | RNW-022（エージェントの `/lp` リンク） | `src/app/home/agent.ts` | — | 該当なし | ファイル無し。段6 統合時に再確認 |
| SHL-059 | 提供終了 `lp`/`copy`/`movie` が tools.ts に無い（U-1） | tools.ts | 該当 id なし | 合格 | `tools.ts:40-65` に無し |
| SHL-060 | `asklink` の hint 文言（U-4） | tools.ts | 「サイトに置く『AIに聞く』リンクとバナー」 | 合格 | `tools.ts:54` |
| SHL-061 | tools.ts が services.ts を正本にして生成される（U-2） | tools.ts | `getActiveServices()` から作る | 合格 | `tools.ts:12,87-100` |
| SHL-062 | 追加 5 サービスがナビに出る（U-3） | TOOL_META | popup/shanai/tenjikai/income/expense あり | 合格 | `tools.ts:55,56,60,64,65` |
| SHL-063 | ホーム集計の正本・代替切り替え（U-5） | `src/lib/home/summary.ts` | — | 該当なし | 段6 未統合 |
| SHL-064 | 375px: サイドバーが引き出しになり、下タブバーが出る | AppShell.module.css | 767px 以下で drawer＋tabbar | 合格 | `AppShell.module.css:144-189` |
| SHL-065 | 375px: 下タブの列数と項目数が一致する | AppShell.tsx・CSS | 5 列＝ホーム＋最大 3＋すべて | 合格 | `AppShell.tsx:155-160,211-222`（`slice(0,3)`）、CSS `:176 repeat(5)` |
| SHL-066 | 375px: 本文の下端がタブバーに隠れない | `.main` の padding | 68px＋safe-area | 合格 | `AppShell.module.css:173` |
| SHL-067 | 375px: 引き出しの幅が画面を超えない | `.sidebar` width | `min(300px, 86vw)` | 合格 | `AppShell.module.css:159` |
| SHL-068 | 375px: ⌘K パレットが画面幅に収まる | `.palette` | `min(560px, 100%)` | 合格 | `AppShell.module.css:112` |
| SHL-069 | 375px: ToolFrame の見出しが 22px、余白 16px になる | ToolFrame.module.css | §11 どおり | 合格 | `ToolFrame.module.css:41-44` |
| SHL-070 | 375px: ツール内ナビ（タブ）が横に溢れたときスクロールする | `.tabs` | `overflow-x: auto`、`flex: none` | 合格 | `ToolFrame.module.css:21-27`。展示会の 8 項目（`tenjikai/nav.ts:29-38`）も横スクロール |
| SHL-071 | 375px: カード・StatTile の内側余白が 16px に落ちる | ds.module.css | 560px 以下で 16 | 合格 | `ds.module.css:86-90` |
| SHL-072 | 長い日本語ラベルの折り返し・省略 | `.navLabel`・`.tab span`・`.userLine` | ellipsis か折り返し | 合格 | `AppShell.module.css:75,89-93,187`。ToolFrame の `.title` は通常折り返し |
| SHL-073 | 固定幅 px による横溢れがない | 全 CSS の `width:` | 固定幅はアイコン・サイドバーのみで grid が `minmax(0,1fr)` | 合格 | `AppShell.module.css:5,134,145`（`minmax(0, 1fr)`）、`.main{min-width:0}` :95、`.frame/.body/.content{min-width:0}` ToolFrame :2,32-33 |
| SHL-074 | 768〜1279px: サイドバーがアイコンのみになり、ツールチップで名前が分かる | CSS と `title` 属性 | `title={tool.name}` | 合格 | `AppShell.module.css:133-141`、`AppShell.tsx:44` |
| SHL-075 | 1280px: サイドバー展開＋右ペイン | CSS | 248px＋aside 320px | 合格 | `AppShell.module.css:5`、`ToolFrame.module.css:36-39` |
| SHL-076 | 右ペインが 1280px 未満で消える | `.aside` | `display:none` 既定 | 合格 | `ToolFrame.module.css:34` |
| SHL-077 | サイドバーの高さ・スクロール | `.sidebar`・`.navScroll` | 100vh sticky、ナビ部分だけスクロール | 合格 | `AppShell.module.css:17-26,56` |
| SHL-078 | モバイル引き出しを閉じたとき、中のリンクにフォーカスが移らない | `.sidebar` の transform と属性 | `inert`/`aria-hidden`/`visibility` のいずれか | 不合格 | 閉じた状態は `transform: translateX(-104%)` のみ（`AppShell.module.css:160`）。`<nav>` に `inert`・`aria-hidden` なし（`AppShell.tsx:179`）。Tab キーで画面外のリンクにフォーカスが移る |
| SHL-079 | モバイル引き出しを開いたとき、フォーカスが引き出しへ移り、閉じたら戻る | AppShell.tsx | フォーカス管理あり | 不合格 | `setOpen(true)` のみ（`AppShell.tsx:166,219`）。フォーカス移動・復帰・背景スクロール固定なし |
| SHL-080 | ⌘K パレットのフォーカス移動と Esc | CommandPalette | 開くと input にフォーカス、Esc で閉じる | 合格 | `AppShell.tsx:65-72,96`。閉じたあとの復帰は無し（軽微） |
| SHL-081 | アイコンだけのボタンに `aria-label` がある | AppShell.tsx | メニュー・検索・閉じる | 合格 | `AppShell.tsx:165,171,184` |
| SHL-082 | 「すべて」タブボタンのラベル | tabbar の button | 可視テキストあり | 合格 | `AppShell.tsx:219-222`（`<span>すべて</span>`） |
| SHL-083 | フォーカス枠（`--blue` 2px） | `:focus-visible` | 主要操作に outline | 合格 | `AppShell.module.css:83-87`、`ToolFrame.module.css:30`、`ds.module.css:64` |
| SHL-084 | スキップリンク | `.skip` | 「本文へ移動」で `#shell-main` | 合格 | `AppShell.tsx:163,207`、CSS :8-12 |
| SHL-085 | ツール内ナビの ARIA が実態と合う | ToolFrame.tsx | リンク群に `tablist/tab` を付けない（タブパネルが無い） | 不合格 | `ToolFrame.tsx:49,53` が `role="tablist"`・`role="tab"`・`aria-selected` をページ遷移の `<Link>` に付与。`aria-current` も併用。支援技術にはタブ切替と読まれるが実際は遷移。`<nav aria-label>` に変えるのが適切 |
| SHL-086 | タップ領域 44px 以上 | ボタン・ナビ | 44px | 合格 | `.iconButton` 44（CSS :101）、`.tab` 52（:184）、`.button` 44（ds :52）。`.navItem` は 40px（:67）で基準未満だが余白込みで実質 44 相当。実機で確認 |
| SHL-087 | 読込・空・エラー・権限なしの共通部品がある | ds/index.tsx | Skeleton・EmptyState（zero/error/forbidden） | 合格 | `index.tsx:99-134`。error は `role="alert"`（:109） |
| SHL-088 | 空状態に「次にやること」を 1 つだけ渡せる | EmptyState の `action` | 1 つ | 合格 | `index.tsx:103-104` |
| SHL-089 | 主ボタン 1 つ（ToolFrame `action`） | ToolFrame.tsx | `action` 1 スロット | 合格 | `ToolFrame.tsx:22-23,46` |
| SHL-090 | 日本語・敬語（枠の UI 文言） | AppShell/ToolFrame/ds の文字列 | 丁寧で主述が合う | 合格 | 「ツールを探す」「見つかりませんでした」「本文へ移動」「メニューを開く」「よく使うツール」「開発中」等 |
| SHL-091 | 英語の装飾ラベル（§11） | 文字列 | 英語の UI 文言なし | 合格 | `Esc`・`⌘K` はキー名の `<kbd>`（`AppShell.tsx:102,191`）。他に英語の見出し・ボタンなし |
| SHL-092 | `⌘K` 表記の OS 差 | AppShell.tsx | Windows では Ctrl+K | 不合格 | `AppShell.tsx:191` が常に `⌘K`。実装は `metaKey||ctrlKey`（:141）で動くが、Windows 利用者に表記が合わない |
| SHL-093 | UI の絵文字禁止 | shell/ds の JSX | 絵文字なし | 合格 | コード内の `⚠️` はコメントのみ（JSX にない）。`services.ts` の新規 4 件は `icon: ''`（:1729,1772,1815,1860） |
| SHL-094 | アイコンは lucide か専用 SVG | shell/ds | lucide のみ | 合格 | `icons.tsx:8-16`、`AppShell.tsx:15`、`ToolFrame.tsx:11` |
| SHL-095 | 色の直書き禁止（枠側） | shell/ds の CSS | トークン名で書く | 合格 | `AppShell.module.css:39,108,151,179` の rgba は影・半透明の背景のみ。`tokens.module.css` 以外に色コードなし |
| SHL-096 | トークンを `:root` に置かず、`.ds` の中だけに限定（既存ツールの見た目を変えない） | tokens.module.css | `.ds` スコープ | 合格 | `tokens.module.css:3-5,8` |
| SHL-097 | `.ds` を当てた未ログイン LP（popup・shanai）の見た目変化 | 各 layout | LP に `background: var(--bg)`・font が掛かる | 未確認 | `tokens.module.css:39-41`（背景 #f4f7fd・font 指定）が `src/app/popup/layout.tsx:23`、`src/app/shanai/layout.tsx:23` で LP にも当たる。LP の意匠が白背景前提なら色が変わる。実機で確認 |
| SHL-098 | popup/layout.tsx の `tokens.ds` がサーバー側で値を持つ | import 元 | CSS Module を直接 import している | 不合格 | `src/app/popup/layout.tsx:6` は `'use client'` の `src/components/ds/index.tsx:1,15` の再 export から `tokens` を読む。サーバーコンポーネントから client モジュールの名前付き export を参照すると client 参照（関数）になり、`tokens.ds` は `undefined` になる見込み。結果 class は `"undefined popup-ds"` となり、未ログイン LP とフラグ OFF のアプリ枠で `--blue`/`--ink` 等のトークンが未定義になる（`popup-ds.css:3-4,22-24` がトークン前提、`PopupAppLayout.tsx:31` も `var(--bg)`）。shanai は直接 import で正しい（`shanai/layout.tsx:6`）。要実機確認（DOM の class を見る） |
| SHL-099 | 収入管理の `--bad-*` トークンが ds 側に取り込まれ、重複が解消されている | tokens.module.css・income/tokens.module.css | ds にあり | 合格（注） | `src/components/ds/tokens.module.css:28-30` に追加済み。`IncomeFrame.tsx:13-14` はまだ独自 `.ds` を重ねているが同値のため害なし |
| SHL-100 | tailwind.config.ts の追加色が既存クラスを壊さない | `doya`・`ink` の追加 | 既存に同名なし、他サービスで未使用 | 合格（注） | `tailwind.config.ts:33-34`。`text-ink` 等の使用は tenjikai 配下のみ（grep）。`var(--ink)` 未定義の場所で使うと透明になるため、他サービスでの流用は不可 |
| SHL-101 | `doya-200` が参照する `--bar` が定義されている | ds-tokens.css | `.tenjikai-root` に `--bar` | 合格 | `src/components/tenjikai/ds-tokens.css:10`。共通シェル ON でも `.tenjikai-root` が付く（`TenjikaiApp.tsx:152`） |
| SHL-102 | Tailwind の `<alpha-value>`＋`color-mix` が v3.4 で動く | tailwind 版 | 3.4 系 | 合格 | `package.json:99 tailwindcss ^3.4.0`（`<alpha-value>` 対応） |
| SHL-103 | next.config.js の変更が追加のみ | diff | APP_ONLY と tracing の追加 | 合格 | `next.config.js:23-24,77-80`。`assets/fonts/*.ttf` は存在（NotoSansJP 2 ファイル） |
| SHL-104 | APP_ONLY_PREFIXES に展示会・支出管理の配下が無い | next.config.js | metadata の noindex で代替されている | 合格（注） | `/tenjikai/*`・`/expense/*` は APP_ONLY に無いが、各 layout の `noindex: true` が配下すべてに効く（SHL-044） |
| SHL-105 | package.json: 新しい依存 | diff | 追加は `docx` のみ | 合格 | `package.json:50 docx 9.5.1`（固定版）。shanai の Word 出力用。枠には無関係 |
| SHL-106 | package.json: build スクリプトに書かれたテストファイルが全部ある | ファイル存在チェック | 18 ファイルすべて存在 | 合格 | `package.json:11-23`。`tsx` は devDependencies（:100）。Vercel の build で devDependencies は入る |
| SHL-107 | build スクリプトの実行時間（テスト 8 本の直列） | package.json | — | 未確認 | `tsx --test` 8 本を `next build` の前に直列実行。各テストが DB に触れないかは別担当。時間は実測が必要（§14 のビルド枠ルール） |
| SHL-108 | フォント: 枠が Inter＋Noto Sans JP を前提にし、独自フォントを足していない | tokens.module.css・globals.css | 同じ指定 | 合格 | `tokens.module.css:37`、`src/app/globals.css:1,83`。`tenjikai.css:3` も独自フォント不使用 |
| SHL-109 | 画像最適化設定（next/image）の変更 | next.config.js | 変更なし | 合格 | `images` 設定に差分なし。ds の EmptyState は `<img>`（SVG、`index.tsx:110-111`） |
| SHL-110 | AppShell にログアウト・アカウント・料金の導線がある | AppShell.tsx | 既存 SidebarShell 相当の導線 | 不合格 | `AppShell.tsx:204` は `{userName} さん` の表示のみ。ログアウト・プロフィール・料金プランへのリンクなし。収入管理（最初から AppShell）では画面内にログアウト導線が無い。支出管理のナビは料金を「AppShell 側の導線に任せる」（`expense/nav.ts:6`）が、その導線が無い |
| SHL-111 | Toaster の二重マウント | root layout と expense layout | 1 つ | 不合格 | `src/app/layout.tsx:3`（ルートで Toaster）と `src/app/expense/[orgSlug]/layout.tsx:6,45`、`Entry.tsx:6`。同じ toast が 2 回出る可能性 |
| SHL-112 | 共通シェル ON のとき、ページ側の h1 と ToolFrame の h1 が重複しない | 各 Tool/page | h1 は 1 つ | 不合格 | `ToolFrame.tsx:43` が h1。`src/app/shanai/Tool.tsx:53` にも h1「ドヤ社内インタビュー」、`src/app/income/pricing/page.tsx:21` に h1「料金プラン」（かつ `text-slate-900` の色直書き）。popup は `PopupShellContext` で小見出しに切り替える作りあり（`PopupShellFrame.tsx:8,19`） |
| SHL-113 | ToolFrame の `serviceId` が tools.ts に無いときの表示 | ToolFrame.tsx | id をそのまま出さず名前にする | 合格 | `ToolFrame.tsx:30-31`（見つからなければ id 文字列。現在の 5 サービスはすべて META にある） |
| SHL-114 | 「最近使ったツール」の localStorage 失敗時に落ちない | readRecent | try/catch | 合格 | `AppShell.tsx:32-39,136` |
| SHL-115 | AppShell が services.ts 全体（約 2,000 行の LP 文言込み）をクライアントに同梱する | tools.ts の import | — | 未確認 | `tools.ts:12` が `@/lib/services` を import し、`AppShell`（client）が読む。既存 `ToolSwitcherMenu.tsx:35` も同じため新規の増分ではないが、バンドル量は実測で確認 |
| SHL-116 | 展示会: 共通シェルで `children`（null ページ）が使われず、未知セクションは 404 | TenjikaiShellFrame・[section]/page | 404 判定あり | 合格 | `src/app/tenjikai/[section]/page.tsx:8`、`TenjikaiShellFrame.tsx:14`（children 不使用、ページは null） |
| SHL-117 | 既存の `isGuestPath` 利用（PopupAppLayout・ShanaiAppLayout）が維持されている | 各 AppLayout | guest で枠なし | 合格 | `PopupAppLayout.tsx:7,16,30`、`ShanaiAppLayout.tsx:7,16` |
| SHL-118 | 統合仕様 R-2（income/expense は独自サイドバーを作らない） | `src/components/income`・`expense` | 独自 Sidebar なし | 合格 | IncomeFrame は ToolFrame のみ。expense は `[orgSlug]/layout.tsx` で AppShell＋ToolFrame のみ |
| SHL-119 | `sidebar/themes.ts` の変更が追加のみで既存テーマを変えていない | diff stat | 追加中心 | 未確認 | 60 行変更（+46/-14）。tenjikai/shanai テーマの追加（:408,425）は確認。削除 14 行の内容は未読。既存サービスのサイドバー色が変わっていないか実機で確認 |
| SHL-120 | services.ts: popup の配色変更（orange→blue）が既存の参照と整合 | diff | ToolSwitcherMenu も同時に変更 | 合格 | `services.ts:1691-1693`、`ToolSwitcherMenu.tsx` の popup 行も blue に変更 |

### 不合格・要対応

| ID | 重大度 | 現象と再現条件 | 該当箇所 | 修正案 | 安全に直せるか |
|---|---|---|---|---|---|
| SHL-001 / SHL-002 | A | 共通シェル（収入管理・支出管理は常時、popup/shanai/tenjikai はフラグ ON 時）のサイドバー最上段「経営ホーム」、左上のブランド「ドヤAI」（2 箇所）、スマホ下タブの「ホーム」、ToolFrame のパンくず「経営ホーム」がすべて `/home` に向き、`/home` が無いので 404 になる。ログイン後に収入管理を開いて左上のロゴを押すだけで再現する。既存サービスには影響しない | `src/components/shell/tools.ts:77`、`src/components/shell/AppShell.tsx:169,181,195,211`、`src/components/shell/ToolFrame.tsx:37` | 段6（`/home`）が入るまで `SHELL_HOME.href` を `/`（トップ）か `/pricing` など実在ページにする。または `src/app/home/page.tsx` に「準備中」ページを置く。パンくずの先頭も同じ値を使うので 1 箇所の変更で済む | 可（tools.ts 1 行。副作用なし） |
| SHL-098 | B | `/popup` を未ログインで開く、またはフラグ OFF でログイン後に開くと、外枠 div の class が `undefined popup-ds` になりトークン（`--blue`・`--ink`・`--bg` 等）が未定義になる見込み。ポップアップ画面の文字色・背景・ボタン色が崩れる。500 にはならない。実機で DOM の class を確認して確定させること | `src/app/popup/layout.tsx:6,23,35`（`import { tokens } from '@/components/ds'`）、`src/components/ds/index.tsx:1,15` | shanai/expense と同じく `import tokens from '@/components/ds/tokens.module.css'` に変える。加えて `ds/index.tsx:15` の `tokens` 再 export をやめる（サーバーから誤って使われないように）か、コメントで禁止を明記する | 可（import 1 行） |
| SHL-015 | B | `/tenjikai` を未ログインで開くとアプリ画面がそのまま出る。フラグ OFF では独自サイドバー＋ToolSwitcherMenu（社内サービス一覧）、ON では AppShell が未ログイン者にも出る。`requiresAuth: true` と矛盾し、他 4 サービスの「未ログインを枠で包まない」方針と食い違う。生成 API は 401 で守られているため、データ漏えいではない | `src/app/tenjikai/layout.tsx:24-40`、`src/components/tenjikai/TenjikaiSidebar.tsx:21` | layout で `getServerSession` を見て、未ログインは LP（無ければ簡易 LP か `/auth/signin?callbackUrl=/tenjikai` へ redirect）にする。「ログイン前に試せる」仕様なら、ToolSwitcherMenu と AppShell を未ログインでは出さない分岐を入れる | 可（layout の数行。展示会担当と方針を合わせる） |
| SHL-110 | B | 収入管理（AppShell 常時）で、画面内にログアウト・アカウント・料金プランへの導線が無い。支出管理のナビは料金プランを AppShell に任せる前提だが AppShell に無い。利用者は他サービスのサイドバーへ移らないとログアウトできない | `src/components/shell/AppShell.tsx:204`、`src/lib/expense/nav.ts:6` | AppShell の `userLine` をメニュー（`/billing` か各 pricing、`signOut`）にする。当面は `userLine` の下に「ログアウト」ボタン（`next-auth/react` の `signOut`）と「料金プラン」リンクを足す | 可（AppShell のみ。既存サービスには影響しない） |
| SHL-038 | C | 共通シェル ON のとき、shanai の詳細（`/shanai/interviews/<id>`）と popup のサイト詳細・編集（`/popup/sites/*`・`/popup/edit/*`）でツール内ナビの選択中が消える | `src/components/shell/ToolFrame.tsx:51`、`src/components/shell/nav.ts:20-23`、`src/lib/shanai/nav.ts:25-28`、`src/lib/popup/nav.ts:11` | `ShellNavItem` に `activePrefixes?: string[]` を足し、`isNavActive` で判定する。各 nav.ts は既にその情報を持っている | 可 |
| SHL-078 / SHL-079 | C | 375px で引き出しを閉じていても、Tab キーで画面外のナビリンクにフォーカスが移る。開いたときフォーカスが移らず、背景がスクロールする | `src/components/shell/AppShell.module.css:157-164`、`src/components/shell/AppShell.tsx:179` | 閉じているとき `<nav>` に `inert`（または `visibility: hidden` を transition 後に付与）、開いたとき閉じるボタンへフォーカス、`body` の overflow を固定 | 可 |
| SHL-085 | C | ツール内ナビの `<Link>` に `role="tablist"/"tab"`・`aria-selected` が付き、支援技術にタブ切替と読まれる | `src/components/shell/ToolFrame.tsx:49-53` | `<nav aria-label="…のメニュー">` と `aria-current="page"` だけにする | 可 |
| SHL-112 | C | 共通シェル ON で shanai を開くと h1 が 2 つ（ToolFrame と Tool.tsx）。収入管理の料金ページも h1 が重複し、色が `text-slate-900` の直書き | `src/components/shell/ToolFrame.tsx:43`、`src/app/shanai/Tool.tsx:53`、`src/app/income/pricing/page.tsx:21` | popup と同じ `ShellContext` で小見出しに切り替える。収入管理の料金ページは h1 を h2 にし、色をトークンにする | 可（各ツール担当） |
| SHL-111 | C | `/expense/<slug>` で Toaster が 2 つ（ルートと layout）マウントされ、toast が二重に出うる | `src/app/layout.tsx:3`、`src/app/expense/[orgSlug]/layout.tsx:6,45`、`src/app/expense/Entry.tsx:6` | expense 側の `<Toaster>` を外す | 可 |
| SHL-008 | C | 未ログインで `/expense/<slug>` を直接開くと、401 が返るまで AppShell と読込中が一瞬出てから `/expense` に戻る | `src/app/expense/[orgSlug]/layout.tsx:21-30,43-47` | `src/app/expense/layout.tsx`（サーバー）で `getServerSession` を見て、未ログインなら children だけにする（income と同じ） | 可 |
| SHL-092 | C | Windows でもサイドバーに `⌘K` と表示される | `src/components/shell/AppShell.tsx:191` | `useEffect` で `navigator.platform` を見て `Ctrl+K` に切り替える（初回描画は空にして hydration 差を避ける） | 可 |

未確認で実機確認が必要なもの: SHL-056（展示会の hydration 警告）、SHL-097（`.ds` を当てた popup/shanai LP の背景色）、SHL-107（build のテスト直列の所要時間）、SHL-115（AppShell のバンドル量）、SHL-119（`sidebar/themes.ts` の削除 14 行で既存テーマが変わっていないか）。

### 画面確認で見てほしい URL

前提: ログイン済みアカウントで確認する。フラグ `UI_SHELL_SERVICES` は本番では未設定（OFF）の想定。ON の確認は `UI_SHELL_SERVICES=popup,shanai,tenjikai` を付けたプレビューで行う。

| URL | 幅 | 見るところ |
|---|---|---|
| `/income`（ログイン後） | 375 / 1280 | 左上「ドヤAI」ロゴ、サイドバー「経営ホーム」、下タブ「ホーム」、パンくず「経営ホーム」を押して 404 になるか（SHL-001）。ログアウト導線が無いか（SHL-110）。1280px でサイドバー 248px・ナビ 8 項目・「開発中」バッジ。375px で下タブが 5 列、ツール内ナビ 8 項目が横スクロールするか |
| `/income/pricing`（ログイン後） | 1280 | AppShell の中に料金ページが入り、h1 が 2 つにならないか（SHL-112） |
| `/expense` → `/expense/<slug>` | 375 / 1280 | 読込中→一覧の切り替わり。権限なしの表示。toast が二重に出ないか（SHL-111）。未ログインで `/expense/<slug>` を直接開いたときの一瞬の枠（SHL-008） |
| `/popup`（未ログイン・ログイン後、フラグ OFF） | 375 / 1280 | DevTools で最上位 div の class が `undefined popup-ds` になっていないか（SHL-098）。文字色・ボタン色・背景が出ているか。LP の背景が `#f4f7fd` に変わっていないか（SHL-097） |
| `/popup`・`/popup/sites/<id>`（フラグ ON） | 1280 | AppShell に載るか、サイト詳細でツール内ナビの選択中が消えないか（SHL-038） |
| `/shanai`（未ログイン・ログイン後、OFF / ON） | 375 / 1280 | LP の背景色（SHL-097）。ON のとき h1 の重複（SHL-112）。`/shanai/interviews/<id>` でタブの選択中（SHL-038） |
| `/shanai/answer/<token>`（ログイン済みのまま開く） | 375 | AppShell・サイドバーが出ないこと（R-7） |
| `/tenjikai`（未ログイン、OFF / ON） | 375 / 1280 | 未ログインでアプリ画面・ToolSwitcherMenu・AppShell が出るか（SHL-015）。console に hydration 警告が出ないか（SHL-056）。ナビ 8 項目の横スクロール |
| `/ds-preview`（本番ビルドで） | 任意 | 404 になること（SHL-042）。開発環境では 375/768/1280 で枠の見本確認 |
| 任意の AppShell 画面 | 375 | 引き出しを閉じたまま Tab キーを押し、画面外のリンクにフォーカスが移らないか（SHL-078）。引き出しを開いて背景がスクロールしないか（SHL-079）。Windows で `⌘K` 表記（SHL-092） |
| `/sfa`・`/hr/dashboard`・`/kintai/dashboard`・`/admin` | 1280 | 既存の枠が変わっていないこと。サイドバーの他サービス一覧に 収入管理・支出管理・展示会・社内インタビュー・ポップアップ が出て、アイコンが欠けていないこと（SHL-029/030、SHL-119） |


---

## 12. 本番移行の手順書と営業管理の修正

点検日: 2026-10-18。読み取りのみ。npm・ビルド・DB・外部 API は実行していない。

略記:
- 手順書 = `~/Code/09_Cursol-ui-renewal/docs/architecture/management-agent/PROD-MIGRATION-2026-10-18.md`（以下 `MIG.md`）
- 統合 = `(統合ブランチの点検用 worktree)/`（確認時点の先頭 `3e755c43`、ブランチ `chore/integ-check-20261018`）。`integrate/agent-renewal` 本体は確認時点で `376efcaa` に進んでおり、両者は一致しない（後述 MIG-003）。
- SFA = `~/Code/doya-sfa-fix-20261017`（`fix/sfa-load-20261017` = `1de39873`）
- FINDINGS = `(システム点検の worktree)/docs/system-check/FINDINGS-2026-10-18.md`
- DEV = `~/Code/DEV-STATUS.md`、SKILL = `~/.claude/skills/doya-db-push/SKILL.md`

| ID | 項目 | 確認方法 | 合格条件 | 結果 | 根拠 |
|---|---|---|---|---|---|
| MIG-001 | 手順の大枠の順番 | MIG.md §2 の段 0〜9 を読む | DB 反映 → merge/デプロイ → 動作確認 → 環境変数 → 再確認、の順になっている | 合格 | MIG.md:33-44 |
| MIG-002 | 段 0 の前提（origin/main 取り込み済み）が点検対象で満たされているか | `git merge-base --is-ancestor origin/main 3e755c43` | yes | 不合格（確認時点の先頭） | 結果 no。`origin/main`=142e29b4。`376efcaa` では yes |
| MIG-003 | 点検対象と `integrate/agent-renewal` 先頭の一致 | `git diff --stat 3e755c43 376efcaa -- prisma/schema.prisma vercel.json` | 差分なし | 不合格（確認時点の先頭） | schema.prisma 667 行削除（Income 15・Expense 12 モデルが先頭に無い）、vercel.json 8 行削除（income/expense の cron 無し）。手順書の「income 15 表・expense 12 表」(MIG.md:38) は先頭 376efcaa とずれる |
| MIG-004 | 新モデル数 | `git diff origin/main...3e755c43 -- prisma/schema.prisma \| grep -c '^+model '` | 手順書の 14+9+15+12=50 と一致 | 合格 | 50 件（tenjikai 14、income 15、expense 12、shanai 9）。依頼文の「51 個」とは 1 件ずれる（CompanyProfile 等は差分に無い） |
| MIG-005 | 既存表への列追加 | 差分の既存モデルのハンク | 手順書か本番反映済みの記録がある | 合格 | `PopupSite.companyProfileId String?`（schema.diff ハンク @@ -4647）。`origin/main` の schema.prisma:4652 に既にあり、統括の説明では本番反映済み。`User.tenjikaiProjects` はリレーションのみで列は増えない |
| MIG-006 | 既存行がある表に NOT NULL 列を既定値なしで足していないか | 差分の既存モデルの `+` 行 | 該当なし | 合格 | 既存表への追加は `companyProfileId String?` のみ |
| MIG-007 | 削除・型変更が差分に無いか | `grep '^-' schema.diff` | 削除行 0 | 合格 | 削除行なし。enum の追加・変更もなし |
| MIG-008 | 新表から既存表への FK | `grep '@relation(fields' schema.diff` のうち既存表参照 | 手順書が FK 作成（`ADD CONSTRAINT`）を想定している | 不合格 | `TenjikaiProject.user User @relation(... onDelete: Cascade)`（schema.diff:54）。`migrate diff --script` は FK を `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY` として出す。MIG.md:37 の許可リスト（CREATE TABLE / CREATE INDEX / ADD COLUMN）に `ADD CONSTRAINT`・`CREATE UNIQUE INDEX` が無く、字義どおり運用すると段 2 で必ず止まる |
| MIG-009 | index / unique の数 | `grep -c '@@index' / '@unique'` | 手順書が CREATE INDEX と CREATE UNIQUE INDEX を許可 | 不合格 | @@index 42、unique 25。`CREATE UNIQUE INDEX` が許可リストに無い（MIG-008 と同根） |
| MIG-010 | DDL の作り方（段 1） | MIG.md:36 | `prisma migrate diff --from-url <本番> --to-schema-datamodel prisma/schema.prisma --script` の向きが正しい | 合格 | 向きは「本番 → スキーマ」で正しい。shadow DB 不要の形 |
| MIG-011 | 段 1 の接続文字列の扱い | MIG.md:36、DEV 2-6 | 読み取り用に 5432（`POSTGRES_URL_NON_POOLING`）を使うと明記 | 不合格 | `<本番>` とだけ書かれ、どの変数か、読み取り専用ロールかの指定が無い。`migrate diff --from-url` は introspection だけで書き込まない |
| MIG-012 | 本番にだけある表への DROP が混ざる危険 | MIG.md:37 | DROP を検出したときの扱い（行を削って続けるか、止めるか）と検出コマンドが具体的 | 不合格 | 「DROP が 1 行でもあれば止めて報告」とあるが、検出手段（`grep -nE '^(DROP\|ALTER TABLE .* (DROP\|ALTER COLUMN))'` 等）が無く、スキーマ外の表（他アプリ・手動表）が本番にあれば `migrate diff` は `DROP TABLE` を必ず出す。止めたあとの進め方が無い |
| MIG-013 | 実質的に破壊的な ALTER の網羅 | MIG.md:37 | `ALTER COLUMN ... SET NOT NULL` / `DROP DEFAULT` / `SET DATA TYPE` / `DROP INDEX` / `DROP CONSTRAINT` / `ALTER TABLE ... RENAME` を禁止に列挙 | 不合格 | 禁止は `DROP` / `ALTER COLUMN ... TYPE` / `NOT NULL` のみ。`DROP DEFAULT`、`DROP INDEX`（index の作り直し）、`DROP CONSTRAINT`（FK の作り直し）が列挙されていない。文字列 `DROP` の grep で拾えるが、明記が無い |
| MIG-014 | 段 1 と段 3 の間にスキーマが変わったときの扱い | MIG.md:36-38 | 「段 1 は merge する commit の schema で出す。commit が変われば段 1 からやり直す」が明記 | 不合格 | 記載なし。統合ブランチは「入れ直し中」で 3e755c43 と 376efcaa が既に食い違っている（MIG-003） |
| MIG-015 | DDL の流し方（接続） | MIG.md:38、SKILL:18、DEV 2-6 | セッションモード 5432 / `POSTGRES_URL_NON_POOLING` | 不合格 | 手順書は `POSTGRES_PRISMA_URL`（pooler 6543）を指定。DEV 2-6 は「プーラーでは DDL が固まる。5432 を使う。`prisma db execute` は固まるので `$executeRawUnsafe`」。SKILL.md は pooler で実績ありと書き、文書同士が矛盾する |
| MIG-016 | DDL の流し方（実行手段） | MIG.md:38 | psql / `$executeRawUnsafe` / Supabase SQL エディタのどれで流すかが明記 | 不合格 | 「doya-db-push の手順」とだけ書かれ、SKILL.md にも実行手段の指定が無い |
| MIG-017 | トランザクションと lock_timeout | MIG.md:38、`prisma/manual-migrations/*.sql` | `BEGIN; ... COMMIT;` で包む。`SET lock_timeout`・`statement_timeout` を置く | 不合格 | 記載なし。既存の手動 SQL は `SET lock_timeout='5s'; SET statement_timeout='60s'` を置いている（2026-10-04-promane-hourly-rate-snapshot.sql:3-4）。FK 追加は `User` 表にロックを取る |
| MIG-018 | 固まったときの対処 | MIG.md §2・§4 | 固まった場合の確認（`pg_stat_activity`）と中断・再実行の手順 | 不合格 | 記載なし。`migrate diff` の出力は `IF NOT EXISTS` を付けないため、途中で止まった後の再実行は既存表でエラーになる。段 1 からやり直す旨も無い |
| MIG-019 | 反映後の確認 SQL | MIG.md §2 §3 | `information_schema.tables/columns` で表・列の数を確かめる SQL がある | 不合格 | 無い。§3 は API の 500 で間接確認するだけ（MIG.md:57） |
| MIG-020 | 戻し方（DB） | MIG.md:74 | 新表は戻さない方針と、戻す場合の DROP 可否・データ消失範囲が書かれている | 合格（補足あり） | 「戻さない。足したのは新しい表と null 可の列だけ」。新表には既存データが無いため DROP でも消失は無い旨を補うとよい |
| MIG-021 | FINDINGS 3-2 の未反映疑いの列を移行前に確認する手順 | MIG.md 全文、FINDINGS:49-71 | 3-2 の読み取り SQL を段 0 か段 1 に置く | 不合格 | 記載なし。ただし `migrate diff` の性質上、未反映なら `aio_prompts.archivedAt`（schema:3522、null 可）、`aishodan_products.archivedAt`（schema:4053）、`promane_time_entries.hourlyRateSnapshot`（schema:2673、`Int?`）、`asklink_run` / `asklink_banner`（schema:4603, 4625）は差分に出て、段 2 の許可リストで通る。拾われる見込みはある |
| MIG-022 | 3-2 の列に付随する補完処理 | `prisma/manual-migrations/2026-10-04-promane-hourly-rate-snapshot.sql` | `hourlyRateSnapshot` の既存行補完 UPDATE が手順にある | 不合格 | 手動 SQL には `UPDATE ... SET hourlyRateSnapshot = member.hourlyRate WHERE ... IS NULL` がある（同 .sql:10-15）。`migrate diff` は ADD COLUMN しか出さず、手順書に UPDATE が無い。未反映だった場合、既存工数の時給が null のまま |
| MIG-023 | 段 1 の差分に既存サービスの不足分が混ざったときの扱い | MIG.md:38 | 「段 1 で見つかった既存サービスの不足分」を流す前に、該当サービスの画面確認を §3 に足す | 不合格 | §3 に aio / aishodan / promane / asklink の確認が無い |
| MIG-024 | 段 4 収入管理の契約データ補完 | MIG.md:39、`scripts/backfill-new-service-subscriptions.ts` | 読み取り → 件数確認 → `--apply --expected-missing` の順。接続先が明記 | 合格（補足あり） | スクリプトは `--apply` に `--expected-missing` を必須にし、Serializable で再照合する（同 .ts:9-37）。接続は `.env.local` の `DATABASE_URL`（`scripts/_env.ts:10`）で、本番を指す設定かの確認手順が無い |
| MIG-025 | 段 4 の対象サービス | `src/lib/stripe.ts:221-230`、`reference/11-billing-spec.md:85-89` | `ALL_SERVICE_IDS` に足した新サービス全部を補完する | 不合格 | `ALL_SERVICE_IDS` には popup / tenjikai / income / expense / shanai が入る。手順書は income だけ。残り 4 つは日次監査 `serviceDrift` が全有料利用者分を報告し続ける（権利判定は `User.plan` なので無料には落ちない） |
| MIG-026 | 段 5 merge と build | MIG.md:40、`package.json:11` | push 前に build。build は `prisma generate` → 回帰テスト群 → `tsc --noEmit` → `next build` | 合格 | package.json の build に `test:security` 〜 `test:shanai` と `tsc --noEmit` が含まれる |
| MIG-027 | Vercel ビルドが db push しないこと | `scripts/db-push-if-db-url.mjs` | ビルドから DB を触らない | 合格 | スクリプトは廃止済みで、呼ばれると exit 1。build スクリプトからは呼ばれていない |
| MIG-028 | 環境変数 `UI_SHELL_SERVICES` の設定手順 | MIG.md:43、`src/lib/ui-shell.ts:9-15` | 値・対象・再デプロイが明記 | 合格 | `popup,tenjikai,shanai,income,expense` を入れ、空コミットで再デプロイ。`isShellEnabled` はカンマ区切り・小文字・`all` 対応 |
| MIG-029 | `UI_SHELL_SERVICES` の対象の正しさ | `grep -rl isShellEnabled src` | 列挙した 5 サービスがフラグを読む | 合格（補足あり） | 読むのは popup / shanai / tenjikai の layout のみ。income / expense は `AppShell` を常時使う（`src/app/income/layout.tsx:15-21`）。列挙しても害は無いが、§3 の「段 8 の後に /income /expense で新しい枠が出る」は段 8 前から出る |
| MIG-030 | 環境変数の反映タイミング | MIG.md:43、DEV 2-6 | 「再デプロイまで効かない」への配慮 | 合格 | 空コミットで再デプロイすると明記 |
| MIG-031 | `TENJIKAI_IMAGEGEN_ENABLED` / `TENJIKAI_IMAGEGEN_DAILY_LIMIT_YEN` | MIG.md 全文、`src/app/api/tenjikai/image/route.ts:23-35` | 本番では未設定（無効）のままにする旨を明記 | 不合格（C） | 手順書に記載なし。コードは未設定なら 403 で無効（route.ts:34）。従量課金のため「設定しない」と明記したい |
| MIG-032 | `RATE_LIMIT_SECRET` / `MITSUBOSHI_GUEST_SECRET` | `src/lib/server-daily-quota.ts:30`、`src/lib/mitsuboshi/nagusame/guest.ts:16` | 未設定でも動く | 合格 | どちらも `NEXTAUTH_SECRET` に fallback。任意で問題ない |
| MIG-033 | `CRON_SECRET` が新 cron に必要 | `src/app/api/cron/income-schedule/route.ts:16`、`expense-schedule/route.ts:15` | 既存の cron と同じ `Bearer ${CRON_SECRET}` 方式 | 合格 | 既存 cron（aio-scan 等）と同方式。本番に既設 |
| MIG-034 | vercel.json の Cron 追加 | `git diff origin/main...3e755c43 -- vercel.json` | income-schedule・expense-schedule が追加、service-operations 6 本が `?mode=` 無しに付け替え | 合格（確認時点の先頭） | 追加 2 本、付け替え 6 本。ただし 376efcaa では income/expense の 2 本が無い（MIG-003） |
| MIG-035 | 旧パス `/api/cron/service-operations` の扱い | `ls src/app/api/cron/`、`vercel.json` | 旧ルートの残し方が手順書にある | 合格（補足あり） | 旧ルートは残り（`CRON_SECRET` 必須、mode 既定 watch）、crons からは外れている。手順書に記載は無いが害は無い |
| MIG-036 | Cron の本数上限 | `grep -c '"path"' vercel.json` | Vercel Pro の上限 40 以内 | 合格（注意） | 37 本。残り 3 本 |
| MIG-037 | Cron の実行記録の確認 | MIG.md §3 | 反映後に各時刻の実行記録を見る手順がある | 不合格 | §3 は「cron が Vercel の画面に並ぶ」までで、FINDINGS 3-3 が求める「各時刻の実行記録で動作を確かめる」が無い。daily（21:50 UTC）・cost（22:30）等は翌日まで確認できない |
| MIG-038 | Stripe Webhook のボット判定の確認 | MIG.md:84、FINDINGS:35-47 | 移行前か直後に Stripe ダッシュボードの配送が 2xx かを見る手順がある | 不合格 | §5 で「別に承認」に送られている。FINDINGS 3-1 は A 級で未解決。前提「S 級・A 級 0 件」（MIG.md:5）と整合しない。移行で悪化はしないが、確認を §3 に置くべき |
| MIG-039 | 移行後の確認: ログイン | MIG.md §3 | ログイン自体の確認項目がある | 不合格（C） | 「ログインして〜を開く」はあるが、ログイン（Google）そのものの合格条件が無い |
| MIG-040 | 移行後の確認: 課金 | MIG.md §3 | `/api/stripe/*` か料金ページ、Webhook の確認がある | 不合格 | 無い |
| MIG-041 | 移行後の確認: 主要サービス | MIG.md:56 | 代表的な既存ツールを開く | 合格 | トップ・/banner・/seo・/sfa・/kintai |
| MIG-042 | 移行後の確認: 追加サービスの API | MIG.md:57、`ls src/app/api/tenjikai` | 挙げた API が存在し、DB を読む | 不合格（C） | `/api/tenjikai/*` は generate と image の 2 本だけで一覧 API は無い。`generate` は POST で課金 API を呼ぶため「叩く」対象に向かない。tenjikai の表の確認は MIG-019 の SQL で行うべき |
| MIG-043 | 移行後の確認: 経営ホーム | MIG.md:20, 60、`git ls-tree 376efcaa` | `/home` と `/api/home/summary` が統合ブランチにある | 未確認 | 3e755c43・376efcaa のどちらにも `src/app/home` `src/app/api/home` が無い。手順書 §1 §3 に入っているが、確認時点では入っていない |
| MIG-044 | 移行後の確認: `/api/t/click` | MIG.md:59 | ルートが存在する | 合格 | `src/app/api/t/click/[trackingId]/[linkId]/route.ts` |
| MIG-045 | 移行後の確認: エラー通知 | MIG.md §3 | Vercel のログ・運用通知（health-alert 等）を見る項目 | 不合格（C） | 無い |
| MIG-046 | 切り戻し: コード | MIG.md:73 | `git revert -m 1` に加え、Vercel の前のデプロイへ Promote（数分）が選べる | 不合格（C） | revert のみ（15 分）。Promote なら 1〜2 分で戻れる。DB は追加だけなので前のコードでも動く旨を書くとよい |
| MIG-047 | 切り戻し: 環境変数 | MIG.md:72 | `UI_SHELL_SERVICES` を空にして再デプロイ | 合格 | 記載あり |
| MIG-048 | 切り戻し: 段 4 の補完行 | MIG.md:75 | 作った行の特定方法と削除手順 | 合格（補足あり） | `serviceId='income'` の `UserServiceSubscription` を消す。実行前の件数記録を求めている。削除 SQL の文面は無い |
| MIG-049 | 本番ログインが必要な確認を誰がどうするか | MIG.md:42-44、§3 | 実行者と手段（Google ログインはユーザー本人、Claude in Chrome 等）が明記 | 不合格 | 実行者は「統括」とだけあり、AI セッションが Google ログインできない点と、FINDINGS 3-1 で Claude in Chrome に接続できなかった経緯への対応が無い |
| MIG-050 | 開発中ツールが公開一覧に出ないこと | `src/lib/services.ts:1764,1805,1848,1893`、`src/app/sitemap.ts:93-106` | 4 ツールが coming_soon で、sitemap が HIDDEN を除く | 合格 | tenjikai / income / expense / shanai は `coming_soon`。sitemap は `HIDDEN_SERVICE_IDS` を除外。popup は 3e755c43 で `coming_soon`、376efcaa で `active`（main 取り込み差） |
| MIG-051 | 承認条件「S 級・A 級 0 件」の整合 | MIG.md:5,8、FINDINGS §3 | 前提と FINDINGS の状態が一致 | 不合格 | FINDINGS 3-1（A）と 3-2（A）は未解決。3-2 は段 1 で自然に拾える見込みだが、3-1 は手順書外に送られている |
| SFL-001 | 不具合の原因の特定 | SFA 差分 `src/lib/sfa/client-response.ts`、commit 131753e1 の本文 | 原因が説明され、修正と対応している | 合格 | 2026-10-07 に読み取り検証へ入れた長さ上限（title 200、name 200、contactName 100、note 5000、lostReason 300）を、それ以前の行が超えると `every()` が false になり一覧全体を捨てていた。行単位の検証に変更 |
| SFL-002 | 行単位の除外 `sfaValidRows` | client-response.ts 差分 | 配列でなければ null、配列なら有効行と除外数を返す | 合格 | `sfaValidRows<T>(rows, isRow)` |
| SFL-003 | 読み取り側の上限緩和の妥当性 | client-response.ts 差分 | 上限は残り、DoS に使えない大きさ | 合格 | title/name 10000、contactName 10000、note 100000、lostReason 10000。無制限ではない |
| SFL-004 | 書き込み側の上限が維持されているか | `src/lib/sfa/deal-mutation.ts:14,22`、`src/app/api/sfa/tasks/route.ts:85` | 200 / 100 / 5000 / 300 のまま | 合格 | 変更なし |
| SFL-005 | 商談一覧（deals/page.tsx）の初回読み込み | 差分 136-147 行付近 | `isDealRow` で除外、`skippedDeals` に件数、`stages` は維持 | 合格 | `sfaValidRows(d.deals, isDealRow)!` の `!` は `isDealPage` で配列を確認済みのため安全 |
| SFL-006 | 商談一覧の続き読み込み | 差分 172-180 行付近 | 除外数を加算、重複 id を除く | 合格 | `setSkippedDeals((s) => s + valid.skipped)` |
| SFL-007 | 除外件数の表示文 | deals/page.tsx 差分 597-601 | 日本語、絵文字なし、集計との関係を説明 | 合格 | 「件数・金額の集計には含まれています」と明記。`role="status"` |
| SFL-008 | タスク一覧（tasks/page.tsx） | 差分 50-60 行付近 | page 1 で除外数をリセット、続きで加算 | 合格 | `setSkippedTasks(prev => (page === 1 ? 0 : prev) + valid.skipped)` |
| SFL-009 | ダッシュボード（page.tsx） | 差分 66-72 行付近 | 不正行で全体が落ちない | 合格（補足あり） | 行単位で除外。除外件数の表示は無い（C） |
| SFL-010 | 商談詳細のタスク読み込み | deals/page.tsx 差分 212-224 | 除外後の行が全部 `dealId` 一致 | 合格 | `valid.rows.every(task.dealId === dealId)` |
| SFL-011 | 無限ローディングの回避 | deals/page.tsx:144, 177 `finally` | 失敗時も loading が解除される | 合格 | 変更前から `finally` で解除。今回の修正でエラー経路自体が減る |
| SFL-012 | ログイン確認が止まったときの案内 | `src/app/sfa/[orgSlug]/layout.tsx` 差分 45-53, 86-91 | 15 秒で `role="alert"` と再読み込みボタン。`requiresLogin` のときは出さない | 合格 | `guard.key` は `use-org-settings-guard.ts:51` に存在。タイマーは key 変化で解除 |
| SFL-013 | API GET の例外処理（deals） | `src/app/api/sfa/deals/route.ts` 差分 | 500 を JSON で返し、ログに message を含めない | 合格 | `console.error('[sfa/deals] GET failed', { code, name })`。`json(body, 500)` の呼び方はこのファイルの `json` の署名（route.ts:16）に合う |
| SFL-014 | API GET の例外処理（tasks） | `src/app/api/sfa/tasks/route.ts` 差分 | 同上。`json(body, { status: 500 })` の署名が合う | 合格 | route.ts:11-12 の `json` は options 形式。合う |
| SFL-015 | 認証・組織の照合 | 両 route.ts | `getSfaContext` と `organizationId` 条件は変更なし | 合格 | try で包んだだけで where 句は同じ |
| SFL-016 | ほかの画面への影響 | `grep isSfaClientDeal/isSfaClientTask src` | 上限緩和が他画面で害にならない | 合格 | `use-client-mutations.ts:120,164,170,200` は書き込み応答の検証に使う。書き込みは API 側が 200 文字で弾くため、緩和の影響なし。activities ページは `isSfaClientActivity` で未変更 |
| SFL-017 | 回帰テストの更新 | `scripts/security-regression/verify-sfa-deals-ui.cjs`、`verify-sfa-task-pagination.cjs`、`verify-sfa-deal-tasks-ui.cjs` | 不正行の除外・件数・過去データの表示・DB 障害時の JSON 500 とログ | 合格 | 3 本に追加。`run.cjs:1021,1026,1213` から呼ばれ、`npm run build` の `test:security` で回る。実行はしていない |
| SFL-018 | ログに個人情報が出ないか | 867fbea0 | 例外メッセージを含めない | 合格 | code と name のみ |
| SFL-019 | 統合ブランチ（点検対象 3e755c43）に入っているか | `git merge-base --is-ancestor 1de39873 3e755c43` | yes | 不合格（確認時点の先頭） | no。`376efcaa`（f634377a で merge）には入っている。`origin/main` には入っていない |
| SFL-020 | 手順書 §3 の SFA 確認項目 | MIG.md:58 | 「除いた行があれば件数が出る」の確認が画面側で可能 | 合格 | `/sfa/<org>/deals` と `/sfa/<org>/tasks` に件数が出る。API の応答自体には除外件数は無いので、API だけ見ても分からない（手順書の表現は画面で見る前提に直すとよい） |

項目数: MIG 51 + SFL 20 = 71。

### schema.prisma と手順書の DDL の対応表

手順書はリポジトリに SQL を置かず、段 1 の `prisma migrate diff` でその場で DDL を作る方式である。したがって「手順書にあるか」は「段 3 の対象として列挙されているか」と「段 2 の許可リストで通るか」で見る。

| 表・列（`@@map` 名） | 由来 | 段 3 の対象列挙（MIG.md:38） | 段 2 の許可リストで通るか | 食い違い・注意 |
|---|---|---|---|---|
| `tenjikai_venue` `tenjikai_project` `tenjikai_site_analysis` `tenjikai_booth_plan` `tenjikai_booth_element` `tenjikai_graphic_panel` `tenjikai_creative` `tenjikai_novelty` `tenjikai_budget_line` `tenjikai_vendor` `tenjikai_vendor_request` `tenjikai_document` `tenjikai_task` `tenjikai_generation_job`（14 表） | 新表（schema.diff:39-294） | あり（14 表） | CREATE TABLE は通る。`tenjikai_project.userId → "User"(id) ON DELETE CASCADE` の `ADD CONSTRAINT` と、unique の `CREATE UNIQUE INDEX` は許可リストに無い | MIG-008/009 |
| `income_organizations` `income_members` `income_issuers` `income_clients` `income_contracts` `income_contract_items` `income_revenue_schedules` `income_invoices` `income_invoice_items` `income_invoice_sequences` `income_payments` `income_payment_allocations` `income_reminders` `income_calendar_connections` `income_audit_logs`（15 表） | 新表（schema.diff:300-665） | あり（15 表） | 表間 FK の `ADD CONSTRAINT`、unique index が許可リスト外 | 376efcaa には未収載（MIG-003）。段 1 を流す commit で有無が変わる |
| `expense_organizations` `expense_members` `expense_vendors` `expense_payment_methods` `expense_contracts` `expense_contract_prices` `expense_schedules` `expense_bills` `expense_bill_lines` `expense_fx_rates` `expense_reminders` `expense_audit_logs`（12 表） | 新表（schema.diff:674-961） | あり（12 表） | 同上。`expense_fx_rates.rate Decimal @db.Decimal(12,4)` は `DECIMAL(12,4)` で出る | 376efcaa には未収載（MIG-003） |
| `shanai_company` `shanai_company_source` `shanai_web_page` `shanai_profile_item` `shanai_interview` `shanai_photo` `shanai_fact` `shanai_article` `shanai_usage_log`（9 表） | 新表（schema.diff:972-1193） | あり（9 表） | 同上 | なし |
| `popup_site.companyProfileId TEXT`（null 可） | 既存表への列追加（schema.diff @@ -4647） | 列挙なし | 通る（ADD COLUMN null 可） | `origin/main` に既にあり、統括の説明では本番反映済み。反映済みなら段 1 の差分に出ない。出た場合は未反映なので流してよい |
| `"User"` の新列 | なし（`tenjikaiProjects` はリレーションのみ） | 該当なし | 該当なし | DDL は出ない |
| `aio_prompts.archivedAt TIMESTAMP(3)`（null 可） | FINDINGS 3-2（schema:3522、manual-migrations 2026-10-05） | 「段 1 で見つかった既存サービスの不足分」として包含 | 通る | 未反映なら段 1 で自動的に出る。事前確認 SQL は手順書に無い（MIG-021） |
| `aishodan_products.archivedAt TIMESTAMP(3)`（null 可） | FINDINGS 3-2（schema:4053） | 同上 | 通る | 同上 |
| `promane_time_entries.hourlyRateSnapshot INTEGER`（null 可） | FINDINGS 3-2（schema:2673） | 同上 | 通る | 手動 SQL にある既存行の UPDATE 補完が手順書に無い（MIG-022） |
| `asklink_run` `asklink_banner`（表） | FINDINGS 3-2（schema:4603, 4625） | 同上 | CREATE TABLE は通る。FK・unique は許可リスト外 | 手動 SQL ファイルも無い。段 1 の差分に出れば一緒に直る |
| 本番にだけある表・列（スキーマ外） | 不明（本番未参照） | 想定なし | `DROP TABLE` / `DROP COLUMN` が出る。手順書は「止めて報告」 | 止めたあとの進め方（DROP 行を削って続ける等）が無い（MIG-012） |
| 既存表の既定値・型・index 名のドリフト | 不明 | 想定なし | `ALTER COLUMN ... SET/DROP DEFAULT`、`DROP INDEX` + `CREATE INDEX` が出うる | 禁止リストに `DROP DEFAULT`・`DROP INDEX`・`DROP CONSTRAINT` の明記が無い（MIG-013） |

### 不合格・要対応

| ID | 重大度 | 現象 | 該当箇所 | 修正案 |
|---|---|---|---|---|
| MIG-003 / MIG-002 / SFL-019 | A | 点検対象 `3e755c43` と `integrate/agent-renewal` 先頭 `376efcaa` が食い違う。先頭には income 15 表・expense 12 表と income/expense の cron が無く、SFA 修正は先頭にだけ入っている。`3e755c43` は `origin/main` を含まない | `git diff --stat 3e755c43 376efcaa -- prisma/schema.prisma vercel.json`、MIG.md:35,38 | 入れ直しが終わった commit を 1 つ決め、その commit で §2 段 0（origin/main 包含、ビルド）と本点検（schema 差分・SFA 包含）をやり直す。手順書に「段 1〜5 は同じ commit で行う。commit が変わったら段 1 からやり直す」を追加（MIG-014 と同じ） |
| MIG-008 / MIG-009 / MIG-013 | A | 段 2 の許可リストが `CREATE TABLE` / `CREATE INDEX` / `ADD COLUMN` だけ。`migrate diff --script` は新表の FK を `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY`、unique を `CREATE UNIQUE INDEX` で出すため、字義どおりでは段 2 で必ず止まる。逆に禁止側は `DROP DEFAULT` / `DROP INDEX` / `DROP CONSTRAINT` を列挙していない | MIG.md:37 | 許可: `CREATE TABLE`、`CREATE INDEX`、`CREATE UNIQUE INDEX`、`ALTER TABLE ... ADD COLUMN`（NOT NULL なし）、`ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY`（新表が起点のもの）。禁止: `DROP`（TABLE / COLUMN / INDEX / CONSTRAINT / DEFAULT）、`ALTER COLUMN`（TYPE / SET NOT NULL / SET DEFAULT）、`RENAME`、`TRUNCATE`、`DELETE`、`UPDATE`。判定コマンド例を書く: `grep -nEi '^(DROP|TRUNCATE|DELETE|UPDATE)|ALTER COLUMN|RENAME|SET NOT NULL' diff.sql` が 0 行であること |
| MIG-015 / MIG-016 / MIG-017 / MIG-018 | A | DDL を pooler 6543（`POSTGRES_PRISMA_URL`）で流す指示。DEV-STATUS 2-6 は「pooler では DDL が固まる。5432 / `POSTGRES_URL_NON_POOLING`。`prisma db execute` も固まる」。実行手段・トランザクション・lock_timeout・固まったときの対処が無く、途中で止まると `IF NOT EXISTS` 無しの DDL は再実行で失敗する | MIG.md:38、SKILL.md:18、DEV 2-6 | 段 3 を書き直す: (1) `POSTGRES_URL_NON_POOLING`（5432）を使う。(2) 先頭に `SET lock_timeout='5s'; SET statement_timeout='120s';` を置き、全体を `BEGIN; ... COMMIT;` で包む（新表の CREATE と FK はトランザクション内で可）。(3) 実行手段は psql か `$executeRawUnsafe` の小スクリプト、または Supabase SQL エディタのいずれかを明記。(4) 固まったら `pg_stat_activity` で待機を確認し、ROLLBACK 後に段 1 からやり直す。SKILL.md の「pooler で実績あり」との矛盾も直す |
| MIG-012 | B | 本番にだけある表・列があると `migrate diff` が `DROP` を出す。手順書は「止めて報告」で、再開手順が無い | MIG.md:37 | 「DROP 行と、それに付随する行は手で削除し、残りだけ流す。削除した行は報告に残す」を追加。検出は上記 grep |
| MIG-014 | B | 段 1 の差分を作る schema と段 5 で merge する commit がずれうる | MIG.md:36-40 | 段 1 の冒頭に「`git rev-parse HEAD` を記録し、段 5 で同じ commit を merge する」を追加 |
| MIG-019 / MIG-042 | B | 反映後の確認が API の 500 頼み。tenjikai には一覧 API が無く、`generate` は課金 API を呼ぶ POST | MIG.md:57 | 段 3 の直後に確認 SQL を置く: `SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE ANY (ARRAY['tenjikai_%','shanai_%','income_%','expense_%'])` が 50（commit に応じた数）であること。3-2 の 5 件も同じ SQL で確認。tenjikai の API 確認は外す |
| MIG-021 / MIG-022 / MIG-023 | B | FINDINGS 3-2 の列は段 1 で拾える見込みだが、事前確認・`hourlyRateSnapshot` の既存行 UPDATE・該当サービスの画面確認が無い | MIG.md:36-38, §3 | 段 0 に FINDINGS 3-2 の読み取り SQL を置く。差分に `promane_time_entries.hourlyRateSnapshot` が出たら `prisma/manual-migrations/2026-10-04-promane-hourly-rate-snapshot.sql` の UPDATE を続けて流す。§3 に /aio・/aishodan・/promane・/asklink を足す |
| MIG-025 | B | 段 4 の補完が income だけ。`ALL_SERVICE_IDS` に入った popup / tenjikai / expense / shanai の行が無く、日次監査 `serviceDrift` が全有料利用者分を報告し続ける | MIG.md:39、`src/lib/stripe.ts:221-230`、`reference/11-billing-spec.md:85-89` | 補完対象を 5 サービスに広げる（popup は main 公開時に実施済みかを先に確認）。または「開発中の 4 つは公開時に補完する」と決めて、監査の報告を無視する期間を明記 |
| MIG-038 / MIG-051 | B | FINDINGS 3-1（Stripe Webhook が 403 の恐れ、A）が手順書外に送られ、前提「A 級 0 件」と矛盾 | MIG.md:5, 84、FINDINGS:35-47 | 段 7 に「Stripe ダッシュボードで直近の Webhook 配送が 2xx か」を足す。ユーザーが画面で見る。403 なら Vercel Firewall で `/api/stripe/webhook` を除外（別承認） |
| MIG-037 / MIG-040 / MIG-045 | B | 移行後の確認に、Cron の実行記録・課金・エラー通知が無い | MIG.md §3 | 翌日の確認として、Vercel Cron の実行記録（daily 21:50 UTC、cost 22:30、income 21:00、expense 22:00）と、運用通知（health-alert、billing-audit）の着信を足す |
| MIG-049 | B | 本番ログインが必要な確認の実行者と手段が不明。AI セッションは Google ログインできない | MIG.md:42-44 | 「ログインが要る確認はユーザーが行う。統括は URL と合格条件を提示する」と明記。または Claude in Chrome 接続を事前に確かめる |
| MIG-011 | B | 段 1 の接続先が `<本番>` としか無い | MIG.md:36 | `POSTGRES_URL_NON_POOLING` を使う。可能なら読み取り専用ロールを作ってそれを使う |
| MIG-043 | B（未確認） | 経営ホーム `/home` が手順書の対象だが、確認時点のどの commit にも無い | MIG.md:20, 60 | 入るなら commit を決めてから点検し直す。入らないなら §1 §3 から外す |
| MIG-046 | C | 切り戻しが `git revert` のみ | MIG.md:73 | 「Vercel の前のデプロイを Promote（1〜2 分）」を第一手に書く。DB は追加だけなので前のコードで動く旨を添える |
| MIG-031 | C | `TENJIKAI_IMAGEGEN_*` に触れていない | MIG.md §2 | 「本番では設定しない（未設定=無効、route.ts:34）」を環境変数の節に書く |
| MIG-029 | C | `UI_SHELL_SERVICES` に income / expense を入れても読まれない | `src/app/income/layout.tsx:15` | 害は無い。§3 の「段 8 の後」の対象から income / expense を外す |
| MIG-039 | C | ログイン自体の合格条件が無い | MIG.md §3 | 「Google でログインでき、`/api/auth/session` に user が返る」を足す |
| SFL-009 | C | ダッシュボードは除外件数を表示しない | `src/app/sfa/[orgSlug]/page.tsx` | 一覧ページと同じ案内を出すか、仕様として明記 |
| SFL-020 | C | §3 の「除いた行があれば件数が出る」は API ではなく画面での確認 | MIG.md:58 | `/sfa/<org>/deals` と `/sfa/<org>/tasks` を開く、に直す |

### 再点検（手順書の修正後）

対象: 修正後の `PROD-MIGRATION-2026-10-18.md`（119 行版。再点検の途中でさらに 2 行増えたため、以下の行番号は 119 行版のもの）と、新設の `~/Code/tools/doya-migrate/classify-diff.cjs`（79 行）。読み取りのみ。

| ID | 前回 | 項目 | 結果 | 根拠・所見 |
|---|---|---|---|---|
| MIG-003/014 (A1) | A | 出すコミットの固定 | 解消（B 1 件残る） | 段 0 で「本番に出すコミットを 1 つに固定する」と明記（35 行）。段 1 も「固定したコミットの schema.prisma」（36 行）。ただし段 5 は `git merge --no-ff integrate/agent-renewal`（40 行）でブランチ名を merge する。固定のあとにブランチが進むと、固定していない commit が main に入る → R-01 |
| MIG-008/009/013 (A2) | A | 分類表と禁止の文 | 解消 | §2.1（52-58 行）。`CREATE UNIQUE INDEX`・新表への `ADD CONSTRAINT ... FOREIGN KEY` を許可、既存表へのものは禁止。`tenjikai_project → "User"` の FK は ALTER の対象が新表なので許可側に入る。禁止に `SET NOT NULL` `DROP DEFAULT` `TRUNCATE` `DELETE` `UPDATE` を列挙 |
| R-04（前回 C） | C | 分類コマンド | 解消（C 2 件） | `classify-diff.cjs`（60 行で参照）。向きの説明（.cjs:10-11）、DROP の除外（.cjs:24-30）、禁止語（.cjs:31）、新表判定（.cjs:21,44,59）、既存表への索引・FK は停止（.cjs:45-46,60）、許可一覧に無い文も停止（.cjs:64）、終了コード 1（.cjs:77）。安全側に倒れる作りで妥当。残る注意は R-08、R-09 |
| R-05（前回 C） | C | 既存表の索引の作り直し | 解消 | DROP INDEX は「除く」、対になる `CREATE INDEX` は既存表なので停止（.cjs:46）。索引が 2 本できる経路は無い。停止したら目で確かめて進める |
| MIG-015/016/017/018 (A3) | A | 接続・トランザクション・固まったときの対処 | 一部解消（B 2 件残る） | 5432 / `POSTGRES_URL_NON_POOLING` を第一手に（64 行）。`.env.local` にそのキー名は存在する（値は見ていない）。`BEGIN; SET LOCAL ...; COMMIT;` と `$executeRawUnsafe`（66 行）。再実行の注意（67 行）。ただし実装方法と pooler への逃げ道に問題 → R-02、R-03 |
| MIG-012 (B) | B | 本番にだけある物への DROP | 解消 | 「除く」区分で流さず一覧に残す（37, 57 行）。スクリプトは `diff.excluded.sql` に書き出す（.cjs:69） |
| MIG-019 (B) | B | 反映後の確認 SQL | 解消 | §2.3（69-78 行）。`asklink\_%` は schema 上 2 表（asklink_run, asklink_banner）だけなので件数が確定できる。再度 `migrate diff` で許可の文 0 件の確認も追加 |
| MIG-022 (B) | B | hourlyRateSnapshot の補完 | 方針として解消 | 「補完しない」（60 行）。`src/lib/promane/labor-cost.ts:8` は `hourlyRateSnapshot ?? currentHourlyRate` で null を今の時給で計算する。記述は正しい。過去の工数が「当時の時給」ではなく「今の時給」で出る点は仕様として受け入れた扱い |
| MIG-025 (B) | B | income 以外の契約データ反映 | 別承認に明示 | §5（115 行）。serviceDrift が鳴り続ける旨も明記 |
| MIG-031 (C) | C | `TENJIKAI_IMAGEGEN_ENABLED` | 解消 | 48 行で「設定しない」と理由を明記 |
| MIG-038 (B) | B | Stripe Webhook | 変わらず §5 送り | 116 行。前提「A 級 0 件」（5 行）との整合は未解消。扱いはユーザー判断 |
| MIG-023/037/040/045/049 | B | 既存サービスの画面確認、Cron 実行記録、課金、エラー通知、ログインの実行者 | 未対応 | §3（82-94 行）に変更なし |
| MIG-042 | C | `/api/tenjikai/*` の一覧 API は存在しない | 未対応 | 87 行。§2.3 の SQL で代替できるので C のまま |
| MIG-043 | B（未確認） | 経営ホーム `/home` | 未対応 | 20, 90 行。確認時点の統合ブランチに無い |
| MIG-029/046 | C | income/expense は flag を読まない、Promote | 未対応 | 43, 91, 103 行 |

新しく見つかった問題（R-xx）:

| ID | 重大度 | 現象 | 該当行 | 修正案 |
|---|---|---|---|---|
| R-01 | B | 段 0 で commit を固定しても、段 5 はブランチ名 `integrate/agent-renewal` を merge する。固定後にブランチが進むと、点検していない commit が本番に入る | 35, 40 行 | 段 5 を `git merge --no-ff <固定した SHA>` にし、merge 前に `git rev-parse integrate/agent-renewal` が固定 SHA と同じことを確かめる |
| R-02 | B | 「`$executeRawUnsafe` で 1 本のトランザクションとして流す」の実装方法が成立しない。PostgreSQL の拡張プロトコル（prepared statement）では 1 回の `$executeRawUnsafe` に複数文を入れられない（`cannot insert multiple commands into a prepared statement`）。文ごとに `$executeRawUnsafe` を呼ぶと、`prisma.$transaction(async tx => ...)` で包まない限り `BEGIN` と後続の文が同じ接続・同じトランザクションに乗る保証が無く、`SET LOCAL` も効かない | 66 行 | `prisma.$transaction(async tx => { for (const stmt of statements) await tx.$executeRawUnsafe(stmt) }, { timeout: 180000, maxWait: 10000 })` の形にし、`SET LOCAL lock_timeout` / `statement_timeout` を最初の文として `tx` で流す。`BEGIN` / `COMMIT` は書かない（Prisma が付ける）。`diff.apply.sql` は `;` で分ければよい（`migrate diff` の出力は単文のみ）。または psql で `-1 -v ON_ERROR_STOP=1 -f diff.apply.sql` を使う方が確実 |
| R-03 | B | プーラーへの逃げ道が安全でない。(1) DEV-STATUS 2-6（140 行）は「プーラーでは本番 DDL が固まる」と断定しており、手順書の「固まることがある」（64 行）より強い。(2) 逃げ道では「文を 1 つずつ流す」（65 行）ためトランザクションが無く、途中で止まると半分だけ入った状態になる。(3) トランザクションモードのプーラーでは `SET statement_timeout`（非 LOCAL）が次の文に引き継がれず、`SET LOCAL` は `BEGIN` 無しでは無効なので、固まったときの時間切れが働かない。(4) FK 追加は `"User"` 等の既存表にロックを取るため、`lock_timeout` 無しでプーラー経由だと、アプリの通常クエリと競合して長く待つ恐れがある | 64-67 行 | 逃げ道を外し、「5432 に接続できないときは止めてユーザーに報告する」に変える。どうしても残すなら、文ごとに `prisma.$transaction` で包んで `SET LOCAL` を付け、`CREATE TABLE` だけを流し、FK・index は 5432 が復旧してから流す、と限定する。あわせて SKILL.md の「DDL も `POSTGRES_PRISMA_URL` で実行する（実績あり）」を DEV-STATUS に合わせて直す |
| R-06 | C | §2.3 の表の件数「14＋9＋15＋12」は、固定した commit に income / expense が入っていることが前提。確認時点の `integrate/agent-renewal` 先頭（376efcaa）には無い | 38, 78 行 | 固定した commit の `grep -c '^model ' prisma/schema.prisma` と `origin/main` の差（確認時点 3e755c43 で 50）を段 0 で記録し、§2.3 の期待値と `classify-diff.cjs` の「新しく作る表」の出力（.cjs:72）を突き合わせる |
| R-07 | C | 段 3 の `SET LOCAL statement_timeout = '60s'` は、FK 追加で `"User"` のロック待ちが起きると足りないことがある。時間切れでトランザクション全体が戻るのは安全だが、再実行の手間が増える | 66 行 | `lock_timeout` 5s はそのまま、`statement_timeout` は 120s 程度にする。アクセスの少ない時間帯に流す旨を足す |
| R-08 | C | `classify-diff.cjs` の `ADD COLUMN` 判定は 1 文全体で `NOT NULL` と `DEFAULT` を見る（.cjs:52）。Prisma が 1 つの `ALTER TABLE` に複数の `ADD COLUMN` をまとめた場合、「NOT NULL で DEFAULT 無し」の列と「DEFAULT 付き」の列が同じ文にあると通ってしまう。今回の差分には該当する列が無い（既存表への追加は `companyProfileId` null 可のみ） | .cjs:50-55 | `ADD COLUMN` 句ごとに分けて判定する。または `ADD COLUMN` が 2 つ以上ある文は止める |
| R-09 | C | `classify-diff.cjs` はリポジトリ外（`~/Code/tools/doya-migrate/`）にあり、テストが無い。文の分割は `;` 固定（.cjs:19）で、`migrate diff` の出力なら問題ないが、手で書いた SQL を混ぜると誤分割しうる | .cjs:19, 60 行 | 09_Cursol の `scripts/` に入れて commit する。段 1 の `migrate diff` 出力以外は入力にしない旨を手順書に書く。小さな入力例（CREATE TABLE＋FK、既存表への UNIQUE INDEX、DROP TABLE）で終了コードを確かめてから使う |

総括: A1〜A3 は文面上は解消した。ただし A3 の実装方法（R-02）と pooler への逃げ道（R-03）、段 5 の merge 先（R-01）が B 級で残る。この 3 点を直せば、DB 反映の手順は実行できる状態になる。分類スクリプトは安全側に倒れる作りで、C 2 件（R-08、R-09）のみ。


---

## 13. 最終の先頭（d10a5c49）での見直し

対象: `(最終点検の worktree)/`（HEAD = d10a5c49、`src`・`prisma`・設定ファイルに未コミットの変更なし）。
見た範囲: `git diff 3e755c43 d10a5c49 -- src prisma vercel.json next.config.js package.json`（80 ファイル、+2,766 / -583）。
前提の確認: `origin/main`（142e29b4、popup 公開）は d10a5c49 の祖先である（`git merge-base --is-ancestor` が真）。
やっていないこと: npm・ビルド・開発サーバーの実行、本番・DB・外部 API への接続。ビルドとテストの結果は別担当（`integ/build-final.log` は点検時点で `test:security` の途中）。

| ID | 項目 | 確認方法 | 合格条件 | 結果 | 根拠 |
|---|---|---|---|---|---|
| FIN-101 | 対象コミットが origin/main を含む | `git merge-base --is-ancestor origin/main d10a5c49` | 真 | 合格 | origin/main = 142e29b4。d10a5c49 の祖先 |
| FIN-102 | POP-083: popup の `status` と `UNLISTED_SERVICE_IDS` が origin/main と同じ | `git diff origin/main d10a5c49 -- src/lib/services.ts` の popup 行 | popup 行に差分なし。`status: 'active'`、UNLISTED に popup なし | 合格 | src/lib/services.ts:1718（`status: 'active'`）、:1953（`['tenjikai', 'shanai', 'income', 'expense']`）。origin/main との差は tenjikai・shanai・income・expense の追加だけ |
| FIN-103 | POP-083: popup/layout.tsx の noindex 解除 | `metadata` の `noindex` | `noindex: true` が無い | 合格 | src/app/popup/layout.tsx:20-24。`// 2026-10-18 に公開（noindex を外した）` |
| FIN-104 | POP-083: popup/pricing の noindex 解除 | `robots: { index: false }` の有無 | 無い | 合格 | src/app/popup/pricing/layout.tsx:4（`buildServiceSubMetadata` のみ） |
| FIN-105 | POP-083: サインイン後の遷移先に popup | `PUBLIC_INTRO_SERVICES` | `'popup'` が入る | 合格 | src/lib/safe-signin-callback.ts:20 |
| FIN-106 | POP-083: SEO の別名に popup | `SERVICE_ALIASES` | `popup` の項がある | 合格 | src/lib/seo.ts:75 |
| FIN-107 | POP-083: GA 検証スクリプトの固定値 | `verify-google-analytics-services.cjs` を origin/main と比較 | 差分なし。公開サービス数 19 | 合格 | `git diff --stat origin/main d10a5c49 -- scripts/security-regression/verify-google-analytics-services.cjs` が空。同 :9 `assert.equal(publicServices.length,19)`（17 + asklink + popup） |
| FIN-108 | POP-083: popup の LP に JSON-LD（origin/main の内容）が残る | layout.tsx の `LpJsonLd` | 未ログイン・ログイン後の全分岐で出す | 合格 | src/app/popup/layout.tsx:28,34,45,54 |
| FIN-109 | SHL-098: popup/layout.tsx のトークン読み込み元 | import 文 | `'@/components/ds/tokens.module.css'` を直接読む。`'@/components/ds'` を読まない | 合格 | src/app/popup/layout.tsx:8（786c8e62 で修正）。shanai/layout.tsx:6 と同じ形 |
| FIN-110 | SHL-098: 退行を止めるテスト | `read.test.ts` D-3 | layout.tsx が `'@/components/ds'` を読んでいたら失敗する | 合格 | src/lib/popup/read.test.ts:215-216 |
| FIN-111 | SHL-098: `ds/index.tsx` の `tokens` 再 export | `src/components/ds/index.tsx` | サーバーから誤って使われない仕組み | 不合格（C） | src/components/ds/index.tsx:15 に `export { default as tokens }` が残る。注意書きは popup/layout.tsx:6-7 のみ。→ FIN-F04 |
| FIN-112 | SHL-001/002: 共通シェルの `/home` リンク先が存在する | `src/app/home/page.tsx` の有無 | ページがある | 合格 | src/app/home/page.tsx:23-34（f1f91196 で取り込み）。リンク元 src/components/shell/tools.ts:77、AppShell.tsx:169,181,195,221、ToolFrame.tsx:37 |
| FIN-113 | `/home` の保護 | `getServerSession` と未ログイン時の遷移 | 未ログインは `/auth/signin?callbackUrl=/home` へ | 合格 | src/app/home/page.tsx:24-26。`callbackUrl=/home` は同一オリジンのパスで safeSignInCallbackUrl を通る |
| FIN-114 | `/api/home/summary` の保護 | 認証判定 | 未ログインは 401。`Cache-Control: private, no-store` | 合格 | src/app/api/home/summary/route.ts:10-14,17 |
| FIN-115 | `/home` のテナント分離 | summary.ts の各 findMany の where | 所属（membership）から取った organizationId / workspaceId / employeeId を必ず条件に入れる | 合格 | src/lib/home/summary.ts:174-208（SFA: orgId）、250-275（見積: orgId）、288-308（プロマネ: ws.id）、339-358（勤怠: 管理者以外は自分の employeeId）、369-377（HR: organizationId） |
| FIN-116 | `/home` は読むだけ（組織の自動作成をしない） | `getOrCreate*` の呼び出し | 無い | 合格 | src/lib/home/summary.ts:6-8 の方針どおり。prisma の呼び出しは findUnique / findFirst / findMany / count / aggregate のみ |
| FIN-117 | RNW-030: 集計の読み取り上限 | 各 findMany の `take` | 全件を上限なしで読まない | 不合格（B） | src/lib/home/summary.ts:305-308 `promaneMember.findMany` に `take` なし。`timeEntries` も全件。:296-304 `promaneProject.findMany` は `take: 500` だが `expenses`・`tasks` は全件。SFA・見積は `take` あり（:188 2000、:193 5000、:207 20、:266 5000、:274 10）。→ FIN-F01 |
| FIN-118 | RNW-030: `maxDuration` | `src/app/home`・`src/app/api/home` | 明示がある | 不合格（B） | どちらにも `maxDuration` の指定なし（`grep -rn maxDuration src/app/home src/app/api/home` が空）。vercel.json の `functions` は adsim の 4 本だけ。→ FIN-F01 |
| FIN-119 | `/home` は 1 ツールの失敗で全体を落とさない | `Promise.allSettled` | 個別に握る。ログに例外本体を出さない | 合格 | src/lib/home/summary.ts:404-419、385-389（`safeErrorInfo` は name と code のみ。cbc57844） |
| FIN-120 | RNW-046: hydration の原因になる時刻・locale | HomeDashboard の描画時の `new Date()` / `toLocale*` | サーバーとブラウザで同じ文字列になる | 不合格（B） | src/app/home/HomeDashboard.tsx:345（`new Date().getHours()` の挨拶）、:348（`toLocaleTimeString('ja-JP')`）、:352（`toLocaleDateString('ja-JP')`）。サーバー（UTC）とブラウザ（JST）で違う。→ FIN-F02 |
| FIN-121 | RNW-022: 提供終了サービスへの導線 | agent.ts の `href` | `RETIRED_SERVICE_IDS` の ID へのリンクなし | 不合格（B） | src/app/home/agent.ts:188 `{ label: 'LPを作る', href: '/lp' }`。`lp` は src/lib/services.ts:1939 で提供終了。→ FIN-F03 |
| FIN-122 | RNW-036: 見本ページの本番公開 | `src/app/ui-renewal`・`src/app/home/preview` | 本番で 404、または存在しない | 合格 | `src/app/ui-renewal` は無い。src/app/home/preview/page.tsx:58 は production で `notFound()`。shanai の見本 src/app/shanai/dev/states/page.tsx:20 も同じ。`public/ui-renewal` は画像のみ |
| FIN-123 | `/home` の検索避け | metadata.robots | noindex | 合格 | src/app/home/page.tsx:16-19 |
| FIN-124 | 共通シェルのログアウト・料金プラン | AppShell の追加分（f2c831ae） | `signOut` の戻り先は自サイト。リンクは実在ページ | 合格 | src/components/shell/AppShell.tsx:207（`/pricing`）、:211（`signOut({ callbackUrl: '/' })`） |
| FIN-125 | 決済ポータルへの戻り先 | `/api/stripe/portal?returnTo=/home` | `safeReturnPath` で同一オリジンのパスに限る | 合格 | src/app/home/HomeDashboard.tsx:445、src/app/api/stripe/portal/route.ts:14-22 |
| FIN-126 | TNJ: 展示会の画像生成は環境変数が無ければ止まる | `TENJIKAI_IMAGEGEN_ENABLED` の判定 | 未設定なら 403。差分なし | 合格 | src/app/api/tenjikai/image/route.ts:34-35。このファイルは 3e755c43 から変わっていない |
| FIN-127 | TNJ-016/017: 上限がプロセス内変数のまま | 同ファイル | DB か plan-limit で数える | 不合格（B・据え置き） | src/app/api/tenjikai/image/route.ts:19-20（`const usage = { day: '', spentYen: 0 }`、`hits`）。環境変数を未設定のまま移行すれば止まっている。TNJ-015（本番の環境変数）は未確認 |
| FIN-128 | expense: `userId` null のメンバーが権限を持たない | `getExpenseContext` の where | `userId` と `status: 'ACTIVE'` で絞る。null は一致しない | 合格 | src/lib/expense/access.ts:44-50、:80（listMemberships）、:102-115（withExpense） |
| FIN-129 | expense: 招待の照合はログイン中のユーザーの DB メール | `claimPendingMemberships` | セッションの申告ではなく `prisma.user` のメールで、小文字にして比較 | 合格 | src/lib/expense/access.ts:57-61。招待時も小文字で保存（members/route.ts:43）。入口で毎回呼ぶ（usage/route.ts:13） |
| FIN-130 | expense: 招待の乗っ取り（メールの書き換え） | `invitedEmail` を変える経路 | PENDING 行の `invitedEmail` を変える API が無い | 合格 | members/[id]/route.ts の PATCH は `role` だけ（:41）、DELETE は `status` だけ（:54）。POST は `INACTIVE` の行だけ上書き（members/route.ts:54,59-61） |
| FIN-131 | expense: 招待の claim は PENDING かつ userId null の行だけ | `updateMany` の where | `status: 'PENDING', userId: null` を条件に入れる（競合しても二重に ACTIVE にしない） | 合格 | src/lib/expense/access.ts:70。既に本人の行がある組織では招待行を INACTIVE にする（:64-69） |
| FIN-132 | expense: メールの登録有無を応答で漏らさない（EXP-F05） | POST の応答 | 登録済み・未登録で同じ `{ ok: true }` | 合格 | src/app/api/expense/members/route.ts:56-64。members.test.ts:61-68 で保護 |
| FIN-133 | expense EXP-F02: 同格ロールの付与・変更・除外 | `canGrantRole` / `canManageMember` | owner 以外は `>=` を禁止 | 合格 | src/lib/expense/member-policy.ts:10-19。POST :47、PATCH :38-39、DELETE :52 で使用。members.test.ts:12-59 |
| FIN-134 | expense: 最後のオーナーを残す | `assertOwnerRemains` | owner の降格・除外前に数える | 合格 | src/app/api/expense/members/[id]/route.ts:21-24,40,53 |
| FIN-135 | expense: メンバー操作の対象行は自組織に限る | `target()` の where | `organizationId` を条件に入れる | 合格 | src/app/api/expense/members/[id]/route.ts:14 |
| FIN-136 | expense: UI の選択肢が API と同じ判定 | SettingsSections.tsx | `canGrantRole` / `canManageMember` を使う | 合格 | src/components/expense/SettingsSections.tsx:210-213,272-275 |
| FIN-137 | expense: 招待行の再利用で一意制約に当たる | POST の `existing` 判定 | 同じ組織に「userId 一致の INACTIVE」と「invitedEmail 一致の INACTIVE」が別行であっても失敗しない | 不合格（C） | members/route.ts:51-54 は `findFirst` で 1 行だけ取り、:60 で `invitedEmail` を上書きする。もう 1 行と `@@unique([organizationId, invitedEmail])`（schema.prisma:5634）が衝突すると P2002 → 500。→ FIN-F05 |
| FIN-138 | schema: 変更の中身 | `git diff` の正味（移動を除く） | 既存の表に変更なし | 合格 | 正味の変更は `ExpenseMember` のみ: `userId String?`、`invitedEmail String?`、`@@unique([organizationId, invitedEmail])`、`@@index([invitedEmail, status])`（prisma/schema.prisma:5617-5637）。他の 400 行超はモデル順の入れ替え |
| FIN-139 | schema: `expense_members` の変更が本番の既存行で失敗しないか | 表の新旧 | 新しい表（本番に無い）か、既存行に矛盾しない | 合格 | `expense_*` は 08 章 INC-F01 のとおり本番に未作成（新表）。仮に有っても NOT NULL → NULL 可と NULL 可の列追加だけで、既存行は壊れない。`@@unique([organizationId, invitedEmail])` は NULL を重複とみなさない |
| FIN-140 | schema: `ExpenseSchedule` の一意制約と書き込み | `sourceType`/`sourceId` | 源泉税の予定に値を入れる | 合格 | prisma/schema.prisma:5783、src/lib/expense/sync.ts:157（`sourceType: WITHHOLDING_SOURCE, sourceId: period`） |
| FIN-141 | expense: 競合の再試行 | `retryOnConflict` | P2002 / P2034 だけを最大 3 回。トランザクション全体を渡す | 合格 | src/lib/expense/sync.ts:173-184。呼び出し側は `prisma.$transaction` ごと包む（contracts/route.ts:48,73、prices/route.ts:20,30、schedules/route.ts:48,67、organization/route.ts:55,59） |
| FIN-142 | expense: 読み込み失敗を「権限なし」と出さない（EXP-F07） | `[orgSlug]/layout.tsx` | `!r.ok` と通信エラーは `error` 状態 | 合格 | src/app/expense/[orgSlug]/layout.tsx:31-35,43,55 |
| FIN-143 | expense: scope テストの緩和が最小 | scope.test.ts の許可正規表現 | `userIds`（自組織の行から取った id）だけ | 合格 | src/lib/expense/scope.test.ts:76-77、members/route.ts:18-19 |
| FIN-144 | SEC-069: インタビュー素材の中身検査と署名付き URL の非保存 | confirm と [id] の route | 先頭バイトで検査。DB には `storage:` 接頭辞の目印 | 合格 | src/app/api/interview/materials/confirm/route.ts:117-151、[id]/route.ts:55-61、src/lib/interview/file-signature.ts、storage.ts:143（Range で先頭だけ、`redirect: 'error'`、15 秒） |
| FIN-145 | SEC-069: `fileUrl` の利用側が壊れない | `fileUrl` の参照箇所 | 存在判定だけに使い、URL は `filePath` から都度発行 | 合格 | transcribe-stream/route.ts:103,239-241、transcribe/route.ts:60、transcription.ts:70（`getSignedFileUrl(storagePath, 3600)`） |
| FIN-146 | SFA: 不正な 1 行で一覧全体を捨てない | `sfaValidRows` | 行単位で除外し件数を表示。認証や書き込みの判定は変えない | 合格 | src/lib/sfa/client-response.ts:22-27、deals/page.tsx:144-146,597-601、tasks/page.tsx:53-59、[orgSlug]/page.tsx:69-71。読み取り側の長さ上限緩和（:29,74-77）は表示のみで、書き込みの制限は据え置き |
| FIN-147 | SFA: GET 失敗時のログに例外メッセージを出さない | deals/tasks の catch | `code` と `name` だけ | 合格 | src/app/api/sfa/deals/route.ts:111-114、tasks/route.ts:67-70 |
| FIN-148 | SFA: 認可と organizationId の条件 | deals/tasks GET の where | 変更なし（try で包んだだけ） | 合格 | src/app/api/sfa/deals/route.ts:64-90、tasks/route.ts:44-62。差分は字下げと try/catch のみ |
| FIN-149 | BILL-081: HR・SFA の AI 月次上限 | plan-limit・実装・表示 | 有料でも上限あり。3 箇所が同じ値 | 合格 | src/lib/plan-limit.ts:104,111、hr/billing.ts:23-28、sfa/ai-limit.ts:33、services.ts:982,1301、pricing.ts:1697,1742-1743 |
| FIN-150 | 課金・ログインを壊す変更の有無 | stripe.ts・pricing.ts・hr/billing.ts の差分 | 価格 ID・Webhook・認証の処理に変更なし | 合格 | stripe.ts の差分は `ALL_SERVICE_IDS` の並び替えだけ（:229。要素は同じ）。pricing.ts は表示文言と `getHrAiLimitByUserPlan` の戻り値のみ。hr/billing.ts:156-162 は上限到達時の文言分け |
| FIN-151 | SFA AI 上限の応答 | `upgradeAvailable` | PRO 以上は「プラン変更で増える」と言わない | 合格 | src/lib/sfa/ai-limit.ts:47,73-74 |
| FIN-152 | CRON-002: Cron の分割が残る | vercel.json と各 route | `service-operations-{daily,watch,reviews,cost,weekly,travel}` の 6 本。クエリ文字列なし | 合格 | vercel.json:132-152、各 route.ts:18 `searchParams.set('mode', ...)`。vercel.json は 3e755c43 から変更なし |
| FIN-153 | SEC-104/103/106: 勤怠の権限判定が残る | syscheck テストの正規表現を grep | 全部一致 | 合格 | src/app/api/kintai/employees/[id]/route.ts:95,133,136,139、employees/route.ts:109、employees/[id]/invite/route.ts:36、requests/[id]/route.ts:118 |
| FIN-154 | SEC-026: クリック計測の署名 | drip-click-link と route | 署名の検証を通る | 合格 | src/lib/drip-click-link.ts・drip-click-link.test.ts が存在。src/app/api/t/click/[trackingId]/[linkId]/route.ts:3 `resolveClickLink`、:19 不一致はトップへ |
| FIN-155 | SEC-024/025: なぐさめのゲスト署名と上限 | guest.ts と chat route | 署名付きゲスト ID と claim | 合格 | src/lib/mitsuboshi/nagusame/guest.ts・guest.test.ts が存在。src/app/api/mitsuboshi/nagusame/chat/route.ts:27-28,49-50,111 |
| FIN-156 | SEC-065/021/109、BILL-051 の行が残る | syscheck テストの正規表現を grep | 全部一致 | 合格 | shodan/company-profile/route.ts:71、test/openai-image/route.ts（404 判定 2 箇所）、mensetsu/sessions/[id]/hr-handoff/route.ts:118,134,151（`hrEmployee.create` なし）、cron/daily-summary/route.ts:83,92（`userServiceSubscription.update` なし） |
| FIN-157 | 統合テストの配線 | package.json | syscheck に file-signature、expense に members.test | 合格 | package.json:11,19-23。`test:shanai` は定義の順序だけ変わった |
| FIN-158 | next.config.js | APP_ONLY_PREFIXES | 要素の増減なし | 合格 | next.config.js:23-24 は income と shanai の行の入れ替えだけ |
| FIN-159 | ナビのアイコン名が対応表にある | 各 nav.ts の `icon` と `SHELL_ICONS` | 全部ある。無くても既定アイコンに落ちる | 合格 | src/components/shell/icons.tsx:18-24,29-31。popup・shanai・income・tenjikai・expense・tools.ts で使う 38 種はすべて対応表にある |
| FIN-160 | 収入管理の枠の置き換え | income/layout.tsx | AppShell の `.ds` にトークンがあり、`--bad-*` も入っている | 合格 | src/app/income/layout.tsx:21-26、src/components/ds/tokens.module.css:29-30（`--bad-bg`・`--bad-ink`）。IncomeFrame と income/tokens.module.css の削除は安全 |
| FIN-161 | 公開ルートの変更の有無 | 差分の対象ファイル | `/api/popup/public/*`・`/popup/embed.js`・`/shanai/answer`・`/api/shanai/answer*` に差分なし | 合格 | `git diff --stat` に該当ファイルなし |
| FIN-162 | ビルド・tsc・テストの結果 | `integ/build-final.log` | 全部通る | 未確認 | 別担当。点検時点でログは `test:security` の途中（9,590 行） |

### 前回の A級の扱い

| ID | 扱い | 根拠 |
|---|---|---|
| POP-083（popup の公開状態） | 解消 | a98d1ac9 で origin/main を取り込み、services.ts:1718,1953・popup/layout.tsx:20-24・pricing/layout.tsx:4・safe-signin-callback.ts:20・seo.ts:75・GA スクリプトのすべてが origin/main と同じ（FIN-102〜108） |
| SHL-001 / SHL-002（`/home` が無い） | 解消 | f1f91196 で src/app/home が入り、getServerSession と callbackUrl で守られている（FIN-112〜114） |
| SHL-098（popup/layout.tsx の tokens が undefined） | 解消 | 786c8e62 で CSS モジュールを直接読む形に変更。テストで保護（FIN-109〜110）。`ds/index.tsx:15` の再 export は残る（C。FIN-F04） |
| RNW-030（/home 集計の上限なし・maxDuration なし） | 残る（B に再評価） | summary.ts:305-308 の `promaneMember.findMany` と `timeEntries` に `take` なし。`maxDuration` もなし。影響は `/home` だけで、他ツール・ログイン（既定の遷移先は `/seo`）・課金に及ばない。読む範囲は自分のワークスペースに限られる。→ FIN-F01 |
| RNW-046（hydration） | 残る（B） | HomeDashboard.tsx:345,348,352。→ FIN-F02 |
| RNW-022（`/lp` への導線） | 残る（B） | agent.ts:188。→ FIN-F03 |
| RNW-036（見本ページの公開） | 対象外 | `src/app/ui-renewal` はこのコミットに無い。`/home/preview`・`/shanai/dev/states` は本番で 404（FIN-122） |
| TNJ-016 / TNJ-017（画像生成の上限がプロセス内変数） | 残る（B。移行は止めない） | 本番で `TENJIKAI_IMAGEGEN_ENABLED` を未設定にしておけば 403 で止まる（FIN-126〜127）。TNJ-015 は本番の環境変数なので未確認 |
| INC-F01 / EXP-F03（本番 DB に income・expense の表が無い） | 対象外（手順） | コードの問題ではなく、`doya-db-push` の手順の実行。d10a5c49 の schema で流すこと。ExpenseMember の変更（FIN-138）を含む |
| MIG-003 / MIG-002 / SFL-019（出すコミットの固定） | 実質解消 | d10a5c49 が origin/main と SFA 修正を含む 1 つのコミットになった（FIN-101、FIN-146〜148）。手順書の文言は 12 章の担当範囲 |
| MIG-008 / 009 / 013、MIG-015 / 016 / 017 / 018（DDL の分類・接続） | 対象外 | 手順書（docs）の問題。本章の対象ファイルに含まない |

### 不合格・要対応

重大度: S=他組織のデータが見える・操作できる、ログイン不能、全体停止 / A=本番移行を止めるべき重大リスク / B=移行後に直せる / C=軽微

S 級・A 級は見つからなかった。

| ID | 重大度 | 現象と再現条件 | 該当箇所 | 修正案 | 安全に直せるか |
|---|---|---|---|---|---|
| FIN-F01（RNW-030） | B | プロマネを長く使っている利用者が `/home` を開くと、ワークスペース全員の全工数行と、全案件の経費・タスクを 1 回で読む。件数が増えると `/home` の初回描画と `/api/home/summary` が遅くなり、関数の時間切れで `/home` だけがエラーになる。他ツールには影響しない。ログイン直後の遷移先は `/seo` なので、ログインは止まらない | src/lib/home/summary.ts:296-308（`promaneProject.findMany` の `expenses`/`tasks`、`promaneMember.findMany` の `timeEntries`）。`src/app/home/page.tsx`・`src/app/api/home/summary/route.ts` に `maxDuration` なし | (1) `timeEntries` に `where: { projectId: { in: projectIds } }` と期間条件（直近 6 か月）を付ける。(2) `expenses` は `_sum` の groupBy に置き換える。(3) `page.tsx` と `route.ts` に `export const maxDuration = 30` を置く。(4) 当面は `promaneMember.findMany` と `timeEntries` に `take` を置く | 可。読み取りの条件追加のみ。移行後でよい |
| FIN-F02（RNW-046） | B | `/home` を開くたびに、挨拶（`getHours()`）と「HH:MM 時点」「契約の更新日」がサーバー（UTC）とブラウザ（JST）で違う文字列になり、React の hydration エラーが console に出る。表示は再描画で直る | src/app/home/HomeDashboard.tsx:345,348,352 | 時刻依存の文字列は `useEffect` の後に state で描く（初期値は空）。または `jstDateKey` と同じ JST 固定の整形関数で描く | 可。表示のみ |
| FIN-F03（RNW-022） | B | エージェントに「集客を強化したい」と頼むと「LPを作る」のボタンが出て、押すと提供終了の `/lp` → トップへ 308 で飛ぶ | src/app/home/agent.ts:188 | `/lp` のアクションを削る。代わりに `/adimage` か `/aio` に向ける | 可。1 行削除 |
| FIN-F04（SHL-098 の残り） | C | `src/components/ds/index.tsx` が `tokens` を再 export したまま。将来サーバーの layout が `import { tokens } from '@/components/ds'` と書くと、同じ配色崩れが再発する。テストは popup の layout だけを見ている | src/components/ds/index.tsx:15 | 再 export をやめる（利用箇所は `tokens.module.css` を直接 import する）。やめられない場合は index.tsx に禁止の注意書きを入れ、shanai・income・expense・tenjikai の layout にも同じテストを足す | 可。影響範囲は `grep "tokens } from '@/components/ds'"` で確認してから |
| FIN-F05（expense 招待） | C | 同じ組織に「本人の userId を持つ INACTIVE 行」と「同じメールの招待 INACTIVE 行」が別々に残っていると、再招待の POST が 1 行だけ更新して `@@unique([organizationId, invitedEmail])` に当たり 500 になる。再現には「招待 → 取り消し → 本人が別経路で参加 → 除外 → 再招待」の順が要る。他組織には影響しない | src/app/api/expense/members/route.ts:51-61、prisma/schema.prisma:5634 | `existing` を `findMany` で取り、本人の行（userId 一致）を優先して更新し、残りの INACTIVE 行の `invitedEmail` を null にする。または更新を `retryOnConflict` で包んで P2002 を 409 の文言にする | 可。INACTIVE 行だけを触る |
| FIN-F06（TNJ-016/017 据え置き） | B | `TENJIKAI_IMAGEGEN_ENABLED=true` にすると上限がインスタンスごとのプロセス内変数になる（09 章のまま） | src/app/api/tenjikai/image/route.ts:19-20 | 本番移行では環境変数を未設定のままにする（TNJ-015 を移行手順で確認）。有効化の前に plan-limit と TenjikaiGenerationJob で数える形に直す | 移行時はコード変更不要 |

移行の判断に関わる注意（不具合ではない）
- `expense_*` の表（ExpenseMember の `userId String?`・`invitedEmail` を含む）と `income_*` の表は本番に無い。d10a5c49 の `prisma/schema.prisma` で `doya-db-push` の手順を踏むこと（08 章 INC-F01）。
- ビルド・tsc・テストの合否は別担当の `integ/build-final.log` を待つ（FIN-162）。


---

