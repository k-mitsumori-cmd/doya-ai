<!-- 2026-10-17 第2回 独立審査（ops）。読み取り専用の審査担当による。設計書の改訂3はこれを反映して行う。 -->

# 監査レポート（分散実行基盤・課金・プラットフォーム運用）— README 改訂 2 / schema-draft / CHECKLIST

対象: `/Users/mitsumori_katsuki/Code/09_Cursol-ui-renewal/docs/architecture/management-agent/{README.md, schema-draft.prisma, CHECKLIST.md, AUDIT-2026-10-17.md}`。読み取りのみ。根拠の実コードは同リポジトリ HEAD（`git log -1` = `1f0f21d7`、設計書記載の `73fa405c` とは別コミットだが対象ファイルの行番号は一致を確認）。

**重大あり（10 件）**。以下、担当 6 領域の順に列挙し、末尾に「付録 D で反映済みとされたが直っていないもの」をまとめる。

---

## 0. 自分で描いた AgentRun 状態遷移と矛盾点

```
queued ──advance──> planning ──> running ──(全 step 終了)──> done
                                   │  ├─(irreversible/high step)──> waiting_approval ──approve──> running
                                   │  │                                        └──reject/expire──> ???（遷移先の定義なし）
                                   │  ├─(kill switch / 会社 suspended)──> paused ──???──> running（復帰経路の定義なし）
                                   │  ├─(LLM 全断)──> paused(llm, nextRunAt+10m) ──Cron──> running（Cron の claim 条件は queued/running のみ＝矛盾）
                                   │  ├─(budget/timeout/lease_lost)──> failed
                                   │  └─(cancel)──> canceled（実行中プロセスへの伝播なし）
                                   └─(240s で自発的に返す: executionToken=null, nextRunAt=null) ──> running のまま誰も拾わない（OPS-01）
```

矛盾は OPS-01 / OPS-05 / OPS-06 / OPS-28 に分解した。

---

## 1. エージェント実行基盤

### OPS-01 【重大】リース解放後の run を Cron が拾えない（ブラウザが閉じると永久に `running`）
- 場所: README §8.4「残り 30s を切ったら…リースを解放して返す。クライアントは GET をポーリングし…advance を再度叩く」「Cron: `status IN (queued, running) AND (executionExpiresAt < now OR nextRunAt <= now)`」
- 根拠: `seo/lib/job-execution.ts` L62-67 `releaseSeoJobExecution` は `executionToken=null, executionExpiresAt=null` にする（設計はこれを複製すると明記）。`NULL < now` は Postgres では NULL（偽）。
- 起きること: 依頼者がタブを閉じる／スマホがスリープすると、240s で自発的に返した run は `status=running`・リース無し・`nextRunAt` 無しで止まる。`wallClockLimitSec` を数える主体も居ない。reserve 済みの `UsageLedger` は release されず残高を食い続ける。SeoJob は「ブラウザ駆動・Cron なし」が前提だったが、エージェントは Cron 回収を前提にしているのに同じ解放処理を複製すると穴が開く。
- 直し方: 自発的解放時は必ず `nextRunAt = now()` を書く（または Cron 条件に `OR (executionToken IS NULL AND status IN ('queued','running'))` を足す）。`verify-agent-run-lease.cjs` に「自発解放後、クライアント呼び出し無しで Cron が 1 分以内に再開する」ケースを追加。

### OPS-02 【重大】リース喪失後の書き込みフェンスが無く、stale プロセスと新ホルダーが同じ step を二重実行する
- 場所: README §8.4「リース（条件付き UPDATE）が唯一の相互排他」、§8.5
- 根拠: SeoJob は `withSeoJobExecution`（`job-execution.ts` L47-60）で**全書き込みを `executionToken` 一致＋`FOR UPDATE`＋期限再確認で囲む**。設計書はリース取得（L20-45 相当）の複製だけを書き、書き込みフェンスに言及しない。
- 起きること: GC 停止・コールドスタート・Node 側時計のズレで advance が 300s を超えて生き残ると、Cron が `executionExpiresAt < now` で再 claim → 新ホルダーが `running` の step を再試行（§8.4 は step 再試行を許す）→ `notify.slack`（下流に冪等キー無し）が 2 回投稿、`aishodan.createRoom` が 2 部屋、画像生成が 2 倍。stale 側はその後 `done` を上書きし、ToolCall 記録も食い違う。
- 直し方: `AgentStep/ToolCall/AgentRun` への全書き込みを `withAgentRunExecution(token)` で囲み、token 不一致なら `ExecutionLostError` で即中断（SeoJob と同じ）。ツール呼び出し**前**に ToolCall(status='running') をフェンス付きで commit し、ツール呼び出し**後**もフェンス付きで結果を書く。新ホルダーは `running` のまま残った irreversible step を**自動再試行しない**（OPS-03）。

### OPS-03 【重大】冪等キー `runId:stepId` は「下流が受け取れる場合」しか効かず、設計の挙げた下流の大半に受け口が無い
- 場所: README §8.2「ツールはこのキーを下流（`requestKey` 列、Stripe `idempotencyKey`、`SeoJob` の `executionToken` 等）に渡し…`skipped_duplicate` で結果を再取得」、§8.2 表 `sfa.updateDealStage`「`requestKey` で冪等」、§16.4 M-8
- 根拠（実測）: `requestKey` 列は `prisma/schema.prisma` L2960 `CunningRecordingLease`、L4504 `PersonaProject` の 2 モデルのみ。`src/lib/sfa/` 配下に `requestKey` は 0 件。SFA の冪等化は `src/lib/sfa/creation-receipt.ts` の `createSfaOnce(operationId: UUID)`（作成のみ、`SystemSetting` 受領証＋advisory lock）。`deal-mutation.ts` の `lockDeal/lockDealStage/dealStageChange` にキー引数は無い。Slack incoming webhook、`rooms/route.ts` POST、`sessions/route.ts` POST、`image-generator.ts`、`aio/run.ts runAndPersistScan`、`doyalist collectCompanies` のいずれも冪等キーを受け取らない。
- 起きること: タイムアウト（ツール上限 120s だが下流が実際には完了していた）→ attempt 2 で同じキーを渡しても下流は判別できず再実行。2026-08-24 事故と同型。M-8 は `idempotency:'runStep'` という**ラベル**しか検査しないので、CI は「冪等です」と嘘の安心を与える。
- 直し方: レジストリに `downstreamIdempotency: 'native'（Stripe/SeoJob/createSfaOnce）| 'local-record' | 'none'` を必須にし、M-8 は `reversibility!=='read'` かつ `'none'` を失敗にする。`'local-record'` は OPS-02 の「呼び出し前 commit」方式で、呼び出し後に結果が書けなかった行（`status='running'` のまま）は `unknown_outcome` として**人の確認待ち**（`ApprovalRequest` 再利用）にし、自動再試行は `maxAttempts=1`。`sfa.updateDealStage` は `createSfaOnce` と同じ受領証方式を update にも拡張するか、`SfaDeal.lastOperationId` 列を足す。

### OPS-04 【中】並列 4 step と `connection_limit=3` で pool_timeout 30s が普通に起きる
- 場所: README §8.4「`Promise.allSettled` で最大 4 並列」「LLM 呼び出し中はトランザクション外」
- 根拠: `src/lib/prisma.ts` L39-53（`connection_limit=3`, `pool_timeout=30`）。1 関数インスタンス＝1 プール。各 step は reserve tx → ツール本体（`kintai.monthlyOvertime` 等は複数クエリ）→ ToolCall・AuditLog・LlmCallLog の INSERT を行う。SSE ルート（§9.2）と GET ポーリングは別インスタンスなので無関係だが、advance 内だけで 4 並列 × 複数クエリ＋フェンス tx（OPS-02 を入れると FOR UPDATE）で 3 本を超える。
- 起きること: `pool_timeout` 到達で `P2024` → step failed → 再試行でまた詰まる。SEO advance ルートが既に `MaxClientsInSessionMode` を想定したヒント文を持つ（`src/app/api/seo/jobs/[id]/advance/route.ts` L39-41）のと同じ事象。
- 直し方: DB を触る区間はセマフォ 2 で直列化し、LLM/外部 HTTP 区間だけ 4 並列。またはインスタンスの `connection_limit` を advance ルート専用に上げる（`DATABASE_URL` を関数ごとに変えられないので前者）。

### OPS-05 【重大】承認待ち・キャンセル・一時停止の遷移に穴が 5 つ
- 場所: README §8.1, §8.4, §8.5, §9.2, §10.9、draft `AgentRun.status` コメント
1. **承認期限切れの遷移先が無い**: `ApprovalRequest.expiresAt` 24h を過ぎた run は `waiting_approval` のまま。Cron は queued/running しか claim しない。reserve 済みクレジットが戻らない。→ Cron に「`waiting_approval` かつ全 approval が expired/rejected」の sweep を足し、step=`skipped`、run は他 step を続行して `done`（部分失敗）に。
2. **`wallClockLimitSec` 30 分と承認 24h の矛盾**: `createdAt` 起点（draft L690）なので、2 時間後に承認された瞬間に `failed(timeout)`。→ 壁時計は「実行中（running）の累積」か「承認後に再起算」に。
3. **cancel / kill switch が実行中プロセスに伝播しない**: §8.5 は「advance 冒頭で確認」のみ。240s のスライス中に 4 並列で irreversible step が進む。→ 各 step 開始前と gateway の各 LLM 呼び出し前に `AgentRun.status` と kill switch を**キャッシュ無し**で読む（`feature-flags.ts` の 60 秒キャッシュは kill switch に使わない）。`AbortController` を run 単位で持ち cancel で abort。
4. **kill switch 由来の `paused` の復帰経路が無い**: `paused(llm)` は `nextRunAt` で Cron 復帰だが、kill switch 解除後に誰が `running` に戻すか未定義。→ 解除時に `paused(kill_switch)` を一括で `nextRunAt=now()` に。
5. **承認 API が advance を同期実行**（§9.2「この API が advance を呼ぶ（承認者のセッションで）」）: 承認 POST が最長 240s ブロックし、スマホの承認画面がタイムアウトする。さらに §9.2 の advance 認可は「依頼者 or cron」なので、`requestedToId` が admin/owner（依頼者と別人）のとき承認者の advance は 403。→ 承認 API は `step=approved, run.nextRunAt=now()` を書いて即 200、advance は別リクエスト（Cron 1 分以内 or `waitUntil` ではなく HTTP 再呼び出し）。advance の認可に「`ApprovalRequest.decidedById` 本人」を足す。

### OPS-06 【中】Cron が「最大 5 件 claim して advance」すると 1 関数で 5×240s になる
- 場所: README §8.4「`/api/cron/agent-runs`（`* * * * *`、`maxDuration 300`）が…最大 5 件 claim して advance」
- 起きること: 直列なら 1,200s で関数が 300s で殺され、2〜5 件目のリースが残る（回収 Cron 自身がリース残しの発生源になる）。並列なら OPS-04 の接続枯渇。
- 直し方: Cron は 1 呼び出し 1 件（毎分 1 件で足りなければ `agent-runs?slot=0..4` を 5 本登録）か、claim だけして実行は `POST /api/agent/runs/[id]/advance` を Bearer `CRON_SECRET` で HTTP 起動（§3 の「HTTP 自己呼び出しを避ける」は Cookie 転送が理由なので、Cron 文脈なら例外にできる）。`maxDuration` と `wallClock` の派生を 1 件に対してだけ計算する。

### OPS-07 【中】`advanceAttempts` が正常な 240s スライスも数えると長い run が `failed(lease_lost)` になる
- 場所: README §8.4「advance 自体の再取得回数…`maxAdvanceAttempts`（既定 10）超過で `failed(lease_lost)`」、draft L673-674
- 起きること: 30 分の run は 240s スライスで 8 回、承認後の再開や Cron 回収を足すと 10 を超える。正常系で失敗扱い。
- 直し方: 「期限切れリースからの再 claim」だけを数える（claim 時に `executionExpiresAt < now` だった場合のみ increment）。自発解放からの再開は数えない。

### OPS-08 【軽微】時計の基準が混在
- リース期限は DB `clock_timestamp()`（SeoJob 流儀）、advance の 240s deadline と `nextRunAt` は Node `Date.now()`。Vercel 関数と Supabase の時計差は通常 1 秒未満だが、`nextRunAt <= now` の比較も DB `now()` に統一して明記する。

### OPS-09 【中】SSE は DB ポーリングで実装するしかなく、接続ごとに関数 300s を占有する
- 場所: §9.2 `GET /api/agent/runs/[id]/events`（`maxDuration = 300`）
- 根拠: 外部キュー・pubsub を入れない（非ゴール）。SSE ルートは数秒ごとに `AgentStep` を読む。`Last-Event-ID` での再開仕様が無い。
- 直し方: `AgentStep.updatedAt` カーソルを `Last-Event-ID` に載せる、ポーリング間隔 3s、1 run あたり同時 SSE 接続 2 まで。コスト試算を §6 に入れる。

---

## 2. LLM ゲートウェイ

### OPS-10 【重大】ツール key にドットがあると OpenAI の function name 規約に違反し、プランナーが最初の呼び出しで 400 になる
- 場所: README §8.2 表（`sfa.listDeals` 等 38 本）、§8.3「プランナーは OpenAI Chat Completions の `tools`」
- 根拠: OpenAI の function `name` は `^[a-zA-Z0-9_-]{1,64}$`（ドット不可）。Gemini の `functionDeclarations.name` はドット可。既存リポジトリに tool calling の前例は 0（§2.1）なので誰も踏んでいない。
- 直し方: レジストリで `key` と `providerName`（`sfa__listDeals`）を分け、往復変換を gateway に閉じ込める。`verify-service-manifest-tools.cjs` に両プロバイダの name 規約検査を足す。

### OPS-11 【重大】`zod-to-json-schema` の出力は Gemini に通らず、「同じ JSON Schema でフォールバック」が全断時に初めて失敗する
- 場所: README §8.3「プロバイダ・フォールバック（planner: openai→gemini、同じ JSON Schema を渡す）」、§16.1 `.strict()` 必須（M-9）
- 根拠: `.strict()` → `additionalProperties:false`、`$ref/definitions`、`anyOf`、`format` を含む Schema を `zod-to-json-schema` は生成する。Gemini の `functionDeclarations.parameters` は OpenAPI 3.0 サブセットで `additionalProperties`・`$ref` を拒否（400）。OpenAI strict mode は逆に `additionalProperties:false` と全 `required` を要求。
- 起きること: OpenAI が 429/5xx の時だけ Gemini に行き、そこで 400 → `failed(llm)`。つまりフォールバックは存在しないのと同じ。
- 直し方: provider ごとの schema 変換器（`$ref` 展開、`additionalProperties` 除去、`anyOf`→`nullable`）を `providers/gemini.ts` に置き、CI で全ツール schema を両変換にかけて「Gemini サブセットに収まる」ことを検査（`verify-llm-gateway-tool-schema.cjs`）。

### OPS-12 【重大】コスト上限が「実測で止まる」のは gateway 経由分だけで、最大の支出源 3 つが run の予算の外にある
- 場所: README §7.4「実コストは gateway 経由の `LlmCallLog` で数える」、§8.2 表、§8.3「未移行ツールは high 扱い」
- 根拠:
  - `seo.generateArticle` は「Job を作るだけ。進行は SeoJob 自身」（§8.2）。SeoJob の LLM・画像呼び出しは run 終了後にブラウザ／Cron 外で走り、`toolCallId` も `AgentRun` も持たない。
  - `doyalist.buildList`（最大 200 回 `gemini-2.5-flash`、`web-scraper.ts` L48）、`aio.runScan`（4 エンジン × プロンプト数）は承認後に一括実行。gateway 移行（§8.3 の順）が終わる前は `LlmCallLog` が 0 行。
  - `image-generator.ts` L80-85, L111-124: gpt-image-2 が 45s でタイムアウトしても OpenAI 側では生成が完了して課金され、続けて Gemini にフォールバックするので **1 枚で有料呼び出し 2 回**。`estimatedPaidCalls`「1〜8」は半分。
- 起きること: 承認は「見込み」で取るが、実行中に `creditBudget` を超えても止まらない。承認画面の「合計見込み額」が実際の半分になり、乖離検知 `SecurityEvent` がフォールバック発生のたびに鳴って無視されるようになる。
- 直し方: (1) gateway に `budget.maxCostMinor` の**事前**検査（画像・音声は単価×枚数が既知）と**事後**集計を両方入れ、超過で以後の呼び出しを throw。(2) `LlmCallLog.refType='agent-run'` を SeoJob 側にも伝播（`SeoJob.originRunId` 列）し、run 終了後の支出も `GET /api/agent/usage` に載せる。(3) フォールバック時は `paidCalls += 2` と `LlmCallLog` 2 行（1 行目 `status='timeout'`, `costMinor` は満額）。(4) 未移行ツールは「承認必須」だけでなく**上限件数を入力の型で固定**（`doyalist.buildList.maxCompanies ≤ 50` 等）。

### OPS-13 【中】`image-generator.ts` を「そのまま核」にすると `quality` 省略＝`medium`、`size='auto'` が通り、§8.3 の「未指定では呼べない」が核の外側だけの保証になる
- 根拠: `src/lib/image-generator.ts` L102-103, L112-113 `quality: req.quality || 'medium'`、L286 `if (size === 'auto') return 'auto'`。`nanobanner.ts` L921-929 は `quality:'medium'` を明示。
- 直し方: 核の型を `quality: GptImageQuality`（必須）、`size` から `'auto'` を除外し、既存 3 呼び出し元を明示指定に直す（§15 の先行修正に追加）。`LlmCallLog.units` に枚数、`meta` に size/quality を保存。

### OPS-14 【中】リトライ予算が「gateway 3 回 × gemini-text のモデル連鎖 4 本」で最大 12 回になる
- 根拠: `src/lib/gemini-text.ts` L89-115: `response.ok` でなければ次モデルへ `continue`（4 モデル）。§8.3 はこの連鎖を gateway に移植すると明記し、別途 429/5xx を 3 回リトライ。
- 直し方: 「試行」はモデル・プロバイダを跨いで 1 つのカウンタ（上限 4）にし、`maxLlmCalls` も**試行ごと**に減らす。4xx（安全性ブロック）はモデルを変えても同じなので連鎖しない。

### OPS-15 【中】トークン・コスト計測の正確さ: 価格表の版管理と「トークンで数えられない」モダリティが未定義
- 場所: draft `LlmCallLog`（`inputTokens/outputTokens/units/costMinor`）、§8.3 `cost.ts`
- 問題: (a) Gemini 2.5/3 の thinking トークン（`thoughtsTokenCount`）とキャッシュ読み取り（`cachedContentTokenCount`）は単価が違う。(b) gpt-image は size×quality の表単価、Realtime 音声は分単価で、`units` の単位が列に無い。(c) 単価表を変えた後の過去行の再計算可否。
- 直し方: `LlmCallLog` に `unitKind('token'|'image'|'audio_sec'|'request')`、`cachedTokens`, `reasoningTokens`, `priceTableVersion` を追加。単価不明なモデルは `costMinor=null` ではなく**その feature の最大単価**で見積もり、予算側では null を 0 と扱わない。

### OPS-16 【中】プロバイダ全断の `paused(llm)` と `wallClockLimitSec` の矛盾、reserve の保持
- §8.4「`nextRunAt = now + 10 分` を Cron が最大 3 回」: 30 分で `wallClock` 到達 → 実際は `failed(timeout)` になり `agent.failed` 通知の文面が「時間切れ」になる。保留中は reserve が残高を食う。→ paused 中は壁時計を止め、reserve は paused 遷移時に release、再開時に再 reserve。

---

## 3. 課金

### OPS-17 【重大】月次クレジット付与のキー `stripe:<eventId>:grant` は **`customer.subscription.updated` が来るたびに付与**する
- 場所: README §7.3「`UsageLedger(kind=grant, idempotencyKey='stripe:<eventId>:grant')` で月次クレジット付与」、§13 #10、draft L573
- 根拠: 既存 webhook は `customer.subscription.updated` を席数変更・metadata 変更・支払い方法変更・更新のすべてで受ける（`route.ts` L94-98）。event.id は毎回異なる。
- 起きること: 席を 1 増やすたび、カード更新のたびに 1 か月分のクレジットが付く。逆に月次更新で `invoice.payment_succeeded` と `subscription.updated` の両方が来て 2 回付く。
- 直し方: 付与キーは `grant:<stripeSubscriptionId>:<period(JST)>`。付与の起点は `invoice.payment_succeeded`（`billing_reason in ('subscription_create','subscription_cycle')`、`amount_paid>0` または trial 開始）に限定し、`subscription.updated` は席数・状態だけを同期。`verify-billing-company-webhook-idempotent.cjs` に「同一 subscription の updated 3 連発で grant 1 行」を追加。

### OPS-18 【重大】`UsageLedger` の reserve→consume を「どちらも負」で書くと二重計上、月またぎで period がずれる
- 場所: README §7.4「生成前に `reserve`（負…）、成功で `consume`（`'<base>:consume'`）に確定、失敗で `release`（正…）」、draft L583-587「負=消費（consume/reserve）」「残高 = SUM(amount)」
- 起きること: reserve(-5) → consume(-5) で残高 -10。追記専用なので reserve 行を更新できず、設計どおり実装すると**全消費が 2 倍**。また reserve が 23:59 JST、consume が翌月 0:01 なら `period` を再計算すると別月の行になり、release も対応づかない。
- 直し方: 仕様を明記: `reserve: amount=-n, period=P`、`consume: amount=(n - 実消費)≥0（調整行、0 でも書く）, period=P（reserve 行から複製）`、`release: amount=+n, period=P`。`refund`（Stripe 返金・運営補填）は `period` を**返金時点**ではなく元消費の period にし、`refId` に元 idempotencyKey。`UsageBalance` は reserve/consume/release で同一 tx 更新。`verify-billing-usage-reserve-release.cjs` に「reserve→consume で残高が n だけ減る」「月末 23:59 reserve → 翌月 consume で両行が同 period」を追加。`reservationId` に孤児検知（1 時間以上 consume/release 無し）の日次 sweep を足す（OPS-26）。

### OPS-19 【重大】席数同期がイベントのスナップショットを信じると順序逆転で席数が巻き戻る／同一 subscription の並行処理
- 場所: README §7.5「webhook `customer.subscription.updated` で `CompanySubscription.seats=quantity` に同期」
- 根拠: 既存ハンドラは「遅延イベントは古い状態を運ぶ」として必ず `stripe.subscriptions.retrieve` で live を取り直す（`route.ts` L279-281, L295-297 のコメント）。設計 §7.5 は live 再取得を書いていない。また `StripeWebhookEvent` の claim は event.id 単位なので、同一 subscription の updated 2 件は**並行**に処理できる。
- 起きること: seats 5→3→5 の操作でイベントが 5,5,3 の順で届き最終 3 → 4 人目の招待受諾が 402。並行処理で `CompanySubscription` upsert が相互に上書き。
- 直し方: 会社経路も live 再取得を必須にし、`CompanySubscription.lastStripeEventCreated` を持って `event.created` が古ければ no-op。同一 `stripeSubscriptionId` は `pg_advisory_xact_lock(hashtext(subId))` で直列化（`creation-receipt.ts` L33 と同じ流儀）。

### OPS-20 【重大】移行期に「旧 owner の Customer を会社と共有」すると、ユーザー課金経路が会社契約を拾って `User.plan` を書き換える（逆も）
- 場所: README §7.1（Customer 共有を許容）、§7.3（`metadata.companyId` 無ければ `syncUnifiedBilling`）、§12 Phase2「webhook は `syncUnifiedBilling` ＋ `syncCompanyBilling`」
- 根拠: `src/lib/stripe.ts` L275-285 `isDoyaSubscription` は `metadata.app==='doya-ai'` で真。L306-367 `findActiveLikeSubscriptions` は**顧客メール横断**で生きている全 subscription を集め、`route.ts` L283-300 `updateBestLiveSubscription` が最上位 tier を `User.plan` に適用、L321-345 `handleSubscriptionDeleted` は「他に生きている契約が残っていれば FREE に落とさない」。会社 Checkout は `metadata.app='doya-ai', userId=操作者` を載せる（§7.3）。
- 起きること: (a) 操作者 A の個人 PRO を解約しても、同じメール／Customer に会社契約があるため A の `User.plan` は PRO のまま（全サービスの個人枠が開放されたまま）。(b) 会社の席契約（`planId='unified-pro'`、price-map で tier PRO）が A 個人の `UserServiceSubscription` 全 32 行に写される。(c) 会社経路側の `findUserForSubscription` 相当が無いので逆方向は起きないが、`handleSubscriptionDeleted` の「残っている契約」判定に会社契約が混ざる。
- 直し方: ユーザー経路の `findActiveLikeSubscriptions` / `isDoyaSubscriptionOwnedByUser` は `metadata.companyId` を持つ subscription を**除外**、会社経路は `metadata.companyId` を持つものだけ。`verify-billing-company-webhook-idempotent.cjs` に「会社契約が `User.plan` を変えない」「個人契約の解約で会社契約が残っていても FREE に落ちる」を追加。

### OPS-21 【重大】`billing.company_mode` のロールバックは、最初の会社 Checkout が成立した後は実行不能
- 場所: README §12 Phase3「各フラグ OFF で即時に旧経路へ。二重書き込みは継続しているので DB は整合したまま」、CHECKLIST MIG-10
- 起きること: 新 Customer＋`metadata.companyId` で契約した会社は、OFF にした瞬間ユーザー経路に `userId` 以外の手掛かりが無く（OPS-20 の除外を入れれば完全に無視される）、支払っているのに全員 FREE。再 ON まで課金事故。
- 直し方: `billing.company_mode` は「新規 Checkout を会社経路にするか」だけを切り、**webhook の会社分岐と権利判定は常時 ON**（フラグ非依存）にする。Phase 表の「戻し方」を「Checkout 入口のみ戻る。既契約は会社経路のまま」と書き換える。

### OPS-22 【中】旧 139 Price → 統一 Price の移行で、年額契約の按分・既存契約者の再契約強制・告知が未設計
- 根拠: `src/lib/stripe.ts` に `STRIPE_PRICE_*` 参照 139 箇所、`*_YEARLY` あり。§7.1「旧契約は次回更新時に新 Customer で再契約」。
- 起きること: 年額前払いの banner-pro 契約者が会社プランへ移ると、未経過分の返金／クレジット（按分）の規定が無い。「再契約」はカード再入力＝解約導線になり、更新日までの間に旧契約が canceled → 新契約 active までの空白で FREE。D2（`9,980/会社 + 2,980/追加席`）は 2 Price（基本＋席）構成だが §7.5 は `items[0].quantity` を更新しており、どちらの item が席かを決めていない。
- 直し方: (1) Stripe Subscription Schedule か `subscriptions.update(items: [{id: old, deleted:true},{price: new}], proration_behavior:'create_prorations')` で**同一 Customer 内**で Price を差し替える（Customer 付け替えは不要。`BillingAccount.stripeCustomerId` に旧 Customer をそのまま入れる）。(2) 年額は `proration_behavior:'create_prorations'` で未経過分をクレジット化し、告知文（絵文字なし・敬語）を §7 に雛形で置く。(3) `CompanySubscription.seatItemId` 列を追加し、席更新はそれを対象に。

### OPS-23 【中】Webhook 欠落時の突合（reconcile）が会社契約に無い
- 既存 `cron/billing-audit`（23:00）はユーザー経路のみ。Stripe の再送は 3 日で打ち切り。`StripeWebhookEvent.status='failed'` の行は人が見ない限り残る。→ `billing-audit` に「`CompanySubscription` 全件を `stripe.subscriptions.retrieve` して status/quantity/period を突合、差分は自動修正＋Slack」「`failed` 受領証の件数」を追加。

### OPS-24 【中】Checkout 二重起動防止が user キーと company キーで分かれ、Phase2 で個人契約と会社契約を同時に作れる
- 根拠: `src/lib/checkout-reservation.ts` L60 `checkout-reservation:v1:<mode>:<userId>`。§7.3 は会社キーを**別に**切る。
- 直し方: 会社 Checkout は「操作者の user キー」も同時に取る（2 キー）。または Phase3 で個人 Checkout 入口を閉じるまで会社 Checkout を出さない。

---

## 4. フェーズ計画

### OPS-25 【中】完了条件の一部が測定不能、フラグの依存関係が未定義
- 場所: README §12
- 測定不能: Phase1「既存機能に挙動変化なし」（指標なし）。Phase3「旧 `access.ts` 本体が呼ばれない（カウンタ 0）」はカウンタの置き場が無い（CHECKLIST OPS-11 は `SystemSetting` を禁止、draft に該当モデル無し）。
- フラグ依存（組合せ爆発のうち実害のあるもの）:
  - `billing.usage_ledger_enforce=ON` ∧ `core.unified_access=OFF` → `companyId` が無い旧 ctx で UsageLedger を引けない（402 で全停止か素通り）。
  - `agent.enabled=ON` ∧ `billing.company_mode=OFF` → `CompanySubscription` の無い会社で reserve → `monthlyCredits=0` で常に `failed(budget)`。
  - `core.session_limit_enforce` OFF は失効済みセッションを戻せない（不可逆）。
- 直し方: 各フラグに `requires: [...]` を `feature-flags.ts` に持たせ、違反状態は admin 画面で ON にできない。カウンタは `LlmCallLog` と同じく専用の `core_runtime_counters` か Vercel ログ集計に。不可逆なフラグ（session_limit、member removed に伴う失効）は「戻し方」欄に「不可逆」と書く。

### OPS-26 【中】マニフェスト移行順（§16.6）と中間生成物の依存が逆
- 根拠: §6.3/§16.2 は `route-classes.json` を**全マニフェスト**から生成し、M-1 は「`src/app/api/<id>/**` があるのにマニフェストが無い」を失敗にする。一方 §16.6 は quote/sfa を Phase1、hr/kintai を Phase2 後半、promane/banner/seo/他 6 を Phase3。Phase2 の middleware report-only は banner/seo（guest-shared 54 本の大半）の `routes.guestShared` 宣言が無いまま走る。
- 起きること: M-1 と `verify-core-tenant-columns.cjs`（「どのマニフェストにも無いモデル」で失敗）は Phase3 末まで常に失敗 → 必ず「未移行 allowlist」が作られ、恒久化する。
- 直し方: Phase0 で 18 サービス全部の**最小マニフェスト**（id/status/routes.public/guestShared/dataModels のみ、`agentTools` 空）を生成し、§16.6 は「agentTools・usage・pii を埋める順」と読み替える。allowlist は作らない。
- 所要期間・人員は README に一切書かれていない（評価不能）。Phase2 だけで「report-only 2 週間以上＋shadow 差分 0 が 7 日」が直列なので最短 3 週間、Phase3→4 は 60 日固定。全体 4〜6 か月、2〜3 人の見積りを明記すべき（推測）。

### OPS-27 【軽微】Cron 本数の記述が一致しない
- §8.4「35→38」、§8.5 は `cron/agent-retention` も追加、CHECKLIST OPS-13 は 4 本 → 39。`vercel.json` 実測 35（`"path"` 35 件）。

---

## 5. サービス契約（§16）

### OPS-28 【重大】M-11（`paid=true` なのに `via!=='llm-gateway'` で失敗）は OpenAI Realtime を正直に宣言できず、マニフェストに嘘を書かせる
- 場所: README §16.2「外部 API のコスト」、§16.4 M-11、CHECKLIST EXT-01
- 根拠: aishodan / mensetsu は OpenAI Realtime（WebRTC、`room/[token]/token`・`live/[token]/token`、§2.1）で**分単価**課金。gateway（HTTP リクエスト/レスポンス型）を経由しない。`plan-limit.ts` L12-13 のコメントどおり最大の変動費。
- 起きること: CI を通すために `paid:false` と書く → 支出監視・`keyLabel` 分離・`LlmCallLog` から最大の費用が消える。
- 直し方: `externalApis[].via` に `'realtime'`（`paid=true` 可、`usageReport: '/api/...'` でセッション終了時に `LlmCallLog(modality='audio', units=秒)` を書く関数を必須）を追加。同様に `'image-core'`（`image-generator.ts`）も enum に。

### OPS-29 【中】マニフェスト型の抜け（6 種）
1. **受信 Webhook**: `/api/inbound-email`（`x-inbound-secret`）、Stripe、HubSpot（`cron/hubspot-sync` が存在）。`routes.public` に `guard` 自由文字列で書くしかなく、共有秘密の `timingSafeEqual` 検査（EXT-09）が対象を特定できない。→ `webhooks: [{ path, secretEnv, signature: 'stripe'|'hmac'|'header' }]`。
2. **外部 OAuth / 連携トークン**: HubSpot 等のトークン保存列が `pii`/暗号化対象から漏れる。→ `integrations: [{ name, tokenModel, column, encrypted:true }]`。
3. **ファイル保存**: `seo-image-purge`、`interview-storage-purge` が示すとおりバケット側の保持は DB `pii.purgeCron` と別。→ `storage: [{ bucket, pathPrefix, public:boolean, retentionDays, purgeCron }]`。
4. **バッチ・ジョブ・ロック**: SeoJob、`SystemSetting` ロック群（§13 #28）。→ `jobs: [{ model, leaseColumn, ttlSec, reclaimCron }]` を宣言させ、`verify-core-raw-sql-tenant.cjs` の対象を機械抽出。
5. **多言語・モバイル**: `ui.japaneseOnly` の他に `i18n`／PWA の宣言が無い（将来項目、軽微）。
6. **M-4 の `guard`**: `/api/health`、`/api/t/open/[trackingId]`（`[token]` を含まない）、`/api/drip/unsubscribe` は「guard も `[token]` も無い」ので全部 M-4 失敗 → `guard: 'none' | 'secret-header' | 'token-param' | 'requireGuestToken'` の enum と `none` に理由必須。

### OPS-30 【中】M-18（マニフェスト id と DB の不一致検出）は Phase0 の 1 回きりで、以後のドリフトを検出しない
- `CompanyServiceAccess.serviceId` は文字列・FK なし。移行スクリプトのバグや手動付与で `adbanner`（退役）等の行ができても気づけない。→ `billing-audit` 夜間 cron に「DB distinct serviceId ⊆ active manifests」「retired サービスに `status='enabled'` が無い」を追加し、Slack。

### OPS-31 【軽微】M-6 の `@@map("<id>_")` 接頭辞検査は既存 192 モデルにほぼ効かない
- 既存は `"SeoJob"`（map なし）、`kintai_members` 等で流儀が混在。新テーブルだけ守れる。`verify-core-tenant-columns.cjs` の「どのマニフェストにも無いモデル」検査が実効なので、M-6 は補助と位置づける。

---

## 6. 運用

### OPS-32 【中】データ量: `AuditLog` / `ToolCall` / `LlmCallLog` の増加に対する分割・アーカイブ・掃除が無い
- 根拠: draft L884-914（`AuditLog` 5 index、cuid PK＝ランダム挿入で B-tree 肥大）、§10.6「3 年保持」、§10.5「hr/kintai/mensetsu の詳細 GET は必ず AuditLog」、`RateLimitBucket`（L1100-1109）に sweeper cron 無し、`LlmCallLog`/`SecurityEvent`/`Notification` に保持期間無し。
- 概算（推測）: 機微 GET 1 件 1 行で、HR/勤怠の日常利用だけで 1 社 1 日 数百行。100 社で年 1,000 万行規模。`audit-verify` 日次が会社ごと全未ハッシュ行を読むのは可だが、3 年後の `@@index([sensitive, createdAt])` 等は Supabase の無料/Pro 枠に効く。
- 直し方: `core_audit_logs` を `createdAt` 月次パーティション（Prisma は管理しないので `doya-db-push` 手順に raw SQL を追加、PK は `(id, createdAt)`）。90 日超はハッシュ連鎖の head だけ残して Storage へ JSONL アーカイブ。`LlmCallLog` 400 日、`SecurityEvent` resolved 180 日、`Notification` read 90 日、`RateLimitBucket` `windowStart < now()-1h` を `cron/core-retention`（日次）で削除。

### OPS-33 【中】監視・SLO・アラートが未定義（§6 相当の節が無い）
- 必要な最低限: (1) `AgentRun` が `running` かつリース無しで 5 分超（OPS-01 の検出）、(2) `waiting_approval` 24h 超、(3) `lease_lost` 発生率、(4) reserve の孤児（OPS-18）、(5) `StripeWebhookEvent.status='failed'` 件数、(6) `LlmCallLog` の日次合計が 7 日平均の 2 倍（EXT-10 は `service-operations-cost.ts` に載せるとあるが同ファイルは `cost:*` の ops 状態しか読まず、`LlmCallLog` 集計ジョブが未設計）、(7) advance の p95 と Cron 遅延。SLO 例: 承認→再開 ≤ 2 分、read ツール run 完了 p95 ≤ 3 分。既存 `cron/health-alert`（*/5）に乗せるのが最短。

### OPS-34 【中】緊急停止の伝播遅延が最大 5 分
- 根拠: 付録 A `feature-flags.ts`「60 秒キャッシュ」、§8.5「advance 冒頭で確認」、1 スライス 240s、4 並列。
- 起きること: 2026-08-24 型の暴走に気づいて kill switch を入れても、進行中スライスは最後まで走り、その間に画像 4 並列 × 複数枚。
- 直し方: kill switch と `AgentRun.status` は gateway の各有料呼び出し直前にキャッシュ無しで読む（1 クエリ、接続は即返す）。OPS-05 (3) と同じ処置。

### OPS-35 【軽微】Vercel 側の前提の明記
- 毎分 Cron は Pro 以上でのみ可（`seo/jobs/[id]/advance/route.ts` L9 のコメント「Vercel Pro」から Pro と推測）。`maxDuration=300` も同様。Hobby に落ちると agent-runs が日次になる。§8.4 に「Pro 前提」を書く。

---

## 付録 D で「反映済み」とされたが実は直っていないもの

| 監査 # | 付録 D の判定 | 実態 |
|---|---|---|
| A-9（冪等キー） | 反映 | キーの形は直ったが、下流に受け口が無い（OPS-03）。§8.2 の「`sfa.updateDealStage` は `requestKey` で冪等」は**存在しない列**を根拠にしている（`requestKey` は Cunning/Persona のみ）。M-8 はラベル検査のみ。 |
| A-10 / B-16（コストは実測） | 反映 | `seo.generateArticle` の支出は run の外、画像フォールバックは 2 回課金、未移行ツールは承認後に無計測で走る（OPS-12）。 |
| A-8（セッション非依存評価） | 反映 | `evaluateCompanyAccess` は良いが、承認者（依頼者と別人）が advance を叩く経路の認可が「依頼者 or cron」のまま（OPS-05 (5)）。 |
| B-9 / B-10（会社 webhook・席同期） | 反映 | live 再取得・順序逆転・同一 subscription の並行処理が未記載（OPS-19）。付与キーが eventId（OPS-17）。 |
| A-2（Customer 共有） | 反映 | 共有を許したことで生じるユーザー経路との交差汚染（OPS-20）が未対処。 |
| C-5（reserve/consume の接尾辞） | 反映 | 接尾辞は決まったが金額の符号が二重計上（OPS-18）。 |
| C-2（advanceAttempts） | 反映 | 正常スライスも数える定義のままで長い run が失敗する（OPS-07）。 |
| B-14（残り時間からの配分） | 反映 | advance 単体は良いが Cron が 5 件を 1 関数で回す設計（OPS-06）が同じ事故を起こす。 |
| B-13（Cron 本数） | 一部反映 | 38 と書くが §8.5/CHECKLIST は 39 本分を列挙（OPS-27）。 |
| C-14（SSE に maxDuration） | 反映 | 付いたが再接続（`Last-Event-ID`）と DB ポーリングのコストが未設計（OPS-09）。 |
| （改訂 2 の自己点検 (2)）画像の size/quality 必須化 | 反映 | §8.3 に文言は入ったが「核にそのまま使う」`image-generator.ts` が `|| 'medium'` と `'auto'` を許容（OPS-13）。 |
| （改訂 2 の自己点検 (3)）プロバイダ全断 | 反映 | `paused(llm)` の再開は Cron claim 条件（queued/running）に含まれず、壁時計とも矛盾（OPS-05 (4)、OPS-16）。 |

正しく直っていたことを実測で確認したもの: B-1（adapter null 返し）、A-4（`FeatureFlag.scope='*'`）、A-5（Restrict / FK なし）、B-21（`currentPeriod*` nullable）、B-22（`RateLimitBucket.updatedAt @default(now())`）、B-12（Vercel Cron ヘッダ）、D-2/D-3/D-6（§15 の先行修正の対象行は実コードと一致: `gemini-text.ts` L95 `?key=`、`stripe-webhook-receipts.ts` の claim/lease 5 分、`banner-admin-guard.ts` の CRON 代替）。

---

## 優先して直す順（重大のみ）

1. OPS-17 / OPS-18（UsageLedger の付与キーと符号）— 実装前に仕様 1 段落で直る。
2. OPS-20 / OPS-21（課金経路の交差汚染とロールバック不能）— Phase2 の webhook 二重化の前提。
3. OPS-01 / OPS-02 / OPS-03 / OPS-05（リース解放・フェンス・冪等・遷移）— `run-execution.ts` の仕様を SeoJob の `withSeoJobExecution` まで含めて複製し、承認 API を非同期化。
4. OPS-10 / OPS-11（ツール名とスキーマの provider 差）— gateway 実装の最初の週で踏む。
5. OPS-12（実測で止まらない支出）と OPS-28（Realtime を宣言できない M-11）— 「承認なしで従量 API を回さない」保証の実体。
