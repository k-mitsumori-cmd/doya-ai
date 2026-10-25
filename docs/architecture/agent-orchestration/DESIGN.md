# 複数のツールを同時に動かすエージェント — 実行の仕組みの設計書（2026-10-25）

この文書は、経営ホームの新しい体験のうち、**実行の仕組み**を書きます。

- 土台にした設計書: `docs/architecture/management-agent/HOME-AGENT-EXPERIENCE-2026-10-25.md`（ブランチ `docs/home-agent-experience`、3da80541。以下「体験の設計書」）
- 分担（統括の指示、2026-10-25）
  - このブランチ（`feat/agent-orchestration`）: 作戦づくり・タスクの実行・同時実行・失敗のやり直し・ドヤパワー・保存の表
  - UIリニューアル: 画面（考える演出・作戦・ToDo の一覧・実行中の見せ方）。置き場所は `src/components/home-agent/`
- 画面と実行の仕組みは、§3 の型と API だけでつなぎます。経営ホームの画面のファイル（`HomeDashboard.tsx` など）は、このブランチでは変えません。

---

## 1. 流れと、どちらが受け持つか

体験の設計書 §3 の場面に、この設計の API を当てはめます。

| 場面 | 画面（UIリニューアル） | 実行の仕組み（このブランチ） |
|---|---|---|
| 0. 入力 | 入力欄・依頼の例 | — |
| 1. 考える | ドヤくんの演出（最短1.5秒） | `POST /api/agent/plan` が質問か作戦を返す |
| 1.5 質問 | 2〜4問の質問（選択肢つき。文字の欄は1つまで） | 質問の定義（`AgentQuestionView`）と、答えの検査 |
| 2. 戦略 | 目的・柱・期間のカード | `AgentPlan` の `goal`・`period`・`pillars` |
| 3. タスク | 柱ごとのタスクの一覧 | `AgentPlanTask`（ツール・題・減るドヤパワー・所要の目安・順番） |
| 4. 確かめ | 合計で減るドヤパワーと、残り | `AgentPlan.totalPower`（`costs.ts` から計算） |
| 5. 実行 | タスクごとの進み具合 | `runAgentTasks`（同時に3つまで）と `POST /api/agent/tasks`（1回で1タスク） |
| 6. 完了 | できた物の一覧と、次に人がする操作 | `AgentTaskResult`（一文・要点・各ツールの画面へのリンク） |

体験の設計書との違いは、「1.5 質問」を足したことです。統括から最初に受けた指示（足りない情報を2〜4問だけ聞く）によります。
作戦を AI が作る段階（§4.3）では、AI が質問も返す形にできます。型は同じです。

## 2. 全体の作り

```
画面（src/components/home-agent/）                 サーバー
  依頼の文 ───────────────────────────────────▶ POST /api/agent/plan
  ◀── { kind: 'questions' | 'plan' | 'none' }       旗 → 本文 → 組み合わせを選ぶ → 答えを検査 → 作戦
  答え ──────────────────────────────────────▶ POST /api/agent/plan（answers 付き）
  ◀── { kind: 'plan', plan }
  「まとめて進める」（確かめは1回）
  runAgentTasks（同時に3つまで。src/lib/agent-orchestration/runner.ts）
    タスクごとに ─────────────────────────────▶ POST /api/agent/tasks { recipeId, taskId, answers, resume }
                                                   旗 → 本文 → 答えを検査 → ツールへの入力を作る
                                                   → 各ツールの API ルートの POST を、同じ cookie で内部から呼ぶ
    ◀── { result } または { error, kind, resume, href }
```

決めたこと:

- 同時に動かすのは画面です。画面が、タスクごとに `/api/agent/tasks` を同時に呼びます。
  - 1回の呼び出しが1つのツールなので、Vercel の関数の時間（300秒）に収まります。
  - タスクごとに別の関数として動くので、本当に同時に進みます。
  - 進み具合を、タスクごとにすぐ画面に出せます。
- 順番と同時に動かす数の決まりは `runner.ts` の1か所に置き、画面もテストも同じ部品を使います。
- 画面を移っても進み続ける形（体験の設計書 §7 の段階3）は、§8 の表を足したあとにサーバーの実行へ移します。

## 3. 型の約束（画面とつなぐところ）

正本は `src/lib/agent-orchestration/types.ts` です。画面はこの型だけを見て作り、中の実装（`tools.ts` など）を直接呼びません。形を変えるときは `AgentPlan.version` を上げ、両方の側に知らせます。

### 3.1 作戦

```ts
type AgentActionId = 'shodan.research' | 'quote.draft' | 'slide.structure'

interface AgentPlanTask {
  id: string
  action: AgentActionId
  tool: string          // shell/tools.ts のツールの id（shodan / quote / doyaslide）
  toolName: string
  title: string
  makes: string         // 何ができるか
  uses: string          // 数える利用枠
  power: number         // 減るドヤパワー（costs.ts から。減らないものは 0）
  minutes: number       // 所要の目安
  after: string[]       // 先に済んでいる必要があるタスクの id
  stages: string[]      // 動いている間に出す段。最後は「…仕上げています」
}
interface AgentPillar { id: string; name: string; why: string; tasks: AgentPlanTask[] }
interface AgentPlan {
  version: 1
  source: 'recipe' | 'ai'
  recipeId: string
  goal: string
  period: string
  pillars: AgentPillar[]
  totalPower: number
  concurrency: number   // 同時に動かす数の上限（いまは3）
}
```

体験の設計書 §5 の JSON（`pillars[].tasks[]` に `tool`・`action`・`title`・`units`・`minutes`・`after`）と同じ並びにしています。
`power` と `tool` は、AI の答えではなく表（`ACTION_CATALOG` と `costs.ts`）から決めます。

### 3.2 API

| API | 本文 | 答え |
|---|---|---|
| `POST /api/agent/plan` | `{ text?, recipeId?, answers? }` | `{ kind: 'questions', recipeId, title, lead, questions, error? }` / `{ kind: 'plan', recipeId, title, lead, plan, answers }` / `{ kind: 'none' }` |
| `POST /api/agent/tasks` | `{ recipeId, taskId, answers, resume? }` | 200 `{ result }` / 422 `{ error, kind, resume?, href? }` / 400 入力の誤り / 404 旗の外 |

- `kind: 'none'` のときは、今の経営ホームの振り分け（`matchHomeIntent` と `planAgent`）に戻します。
- 失敗の `kind`: `setup`（ツールの組織が無い）・`auth`（ログイン切れ）・`power`（ドヤパワー不足）・`limit`（ツールの上限）・`input`・`tool`。
- `href` は、失敗のときに開くとよい中の画面です（組織を作る・料金を見る）。外のサイトは返しません。
- `resume` は「途中まで作れたもの」です。画面は、失敗したタスクの `resume` を、やり直しのときにそのまま送り返します。

### 3.3 同時に動かす部品

```ts
runAgentTasks({
  tasks,                 // planTasks(plan)（after を dependsOn にした平らな一覧）
  execute,               // (task, { signal, upstream, resume }) => Promise<AgentTaskResult>
  concurrency,           // plan.concurrency
  prev,                  // 前の実行の状態（失敗だけのやり直し）
  signal,                // 中断
  onChange,              // (states) => void。画面の進み具合
})
```

`AgentTaskState.status` は `waiting`・`running`・`done`・`failed`・`blocked`（前のタスクが済まなかった）・`canceled` の6つです。
「今◯個のツールが動いています」は `progressOf(states).running` です。

## 4. 作戦づくり

### 4.1 段階1（いま）: 決まった組み合わせから作る

- 依頼の文の言葉（`matchRecipe`）か、チップの `recipeId` で組み合わせを選びます。
- 質問の答えがそろうと、`planFromRecipe` が作戦を作ります。AI は呼ばず、ドヤパワーも減りません。
- 組み合わせは `src/lib/agent-orchestration/recipes.ts` に置きます。

### 4.2 最初の3つの組み合わせ

**商談の準備（段階1で動く）**

| タスク | 柱 | ツール | 呼ぶ API | 減るドヤパワー |
|---|---|---|---|---|
| research | 相手を知る | ドヤ商談準備 | `POST /api/shodan/preparations` | 0（商談準備の月の件数で数える） |
| quote | 条件を示す | ドヤ見積もりAI | `POST /api/quote/documents/suggest` → `POST /api/quote/documents` | 1（`text.generate`） |
| slides | 提案を形にする | ドヤスライド | `POST /api/doyaslide/projects` → `POST /api/doyaslide/structure` | 30（`slide.generate`） |

- 3つは互いに待たず、同時に動きます。合計は31です。
- 質問は4つです。相手の会社のサイト（文字の欄。ここだけ入力が要る）、何を提案するか、予算の目安、どんな場の商談か。場によってスライドの枚数（6・8・5枚）が決まります。
- 最初にこれを選んだ理由: 3つとも文章だけの生成で、画像を作りません。AI の呼び出しが `@seo/lib/gemini` に集まっていて、確認のときに差し替えやすいです。マーケティングの外（営業）の仕事でもあります。

**新しい商品の販促（次に足す）**

| タスク | ツール | 呼ぶ API | 順番 |
|---|---|---|---|
| persona | ドヤペルソナ | `POST /api/persona/generate`（`url`・`serviceName`・`requestKey`） | 最初 |
| banner | ドヤバナー | `POST /api/banner/generate`（`category`・`keyword`・`count`） | persona のあと |
| article | ドヤSEO | `POST /api/seo/articles`（`createJob: true`・`operationId`） | persona のあと |

- ペルソナの要約を、バナーの言葉と記事の読者像に渡します（`AgentTaskResult.handoff` と `upstream`）。
- 次に回す理由: バナーは画像の生成で費用が大きいです。バナーの API は画像を data URL で返し、レコードの id を返しません（結果のリンク先と、返す大きさ 4.5MB の上限を決める必要がある）。SEO の記事は、作成のあとに `POST /api/seo/jobs/[id]/advance` を何度も呼んで進むジョブです。

**採用（その次）**

| タスク | ツール | 呼ぶ API |
|---|---|---|
| interview | ドヤ面接官 | `POST /api/mensetsu/sessions`（`templateId`）。候補者へ送るのは人 |
| article | ドヤ社内インタビュー | `POST /api/shanai/interviews` |
| hr | ドヤHR | 社員の登録の画面へ案内 |

- 面接の評価は音声のライブ面接のあとでしか作れず、社内インタビューの記事は承認済みの事実が5件以上要ります。そのため「準備までを同時に行い、続きは各ツールで人が行う」形にします。

### 4.3 段階2: AI が作戦を作る

- 体験の設計書 §5 のとおり、依頼と経営ホームの事実を渡し、`geminiGenerateJson` で作戦の JSON を返してもらいます。
- 返った JSON は `sanitizeAiPlan`（`plan.ts`）で検査します。いまのテストで確かめている決まり:
  - 表（`ACTION_CATALOG`）に無い操作のタスクは捨てる。題の無いタスクも捨てる。
  - `after` は、残ったタスクの id だけにする。循環があれば `after` をすべて外す（同時に動かす）。
  - `power` と `tool` は表から決める。AI が返した `power` は使わない。
  - タスクは最大8つ。空の柱は捨てる。タスクが1つも残らなければ作戦を作らない。
- 作戦を作る1回にもドヤパワーを使います。操作の名前 `agent.plan` を `costs.ts` に足す案です。量は統括とユーザーで決めます（体験の設計書 §10-1）。
- AI が作った作戦のタスクを動かすときは、作戦を §8 の表に保存し、`/api/agent/tasks` は `runId` と `taskId` だけを受け取ります。画面から届いたタスクの中身で、ツールへの入力を作らないためです。

## 5. タスクの実行

### 5.1 ツールの呼び方（routes.server.ts）

- 各ツールの API ルートの `POST`（export されたもの）を、同じリクエストの中で呼びます。エージェントの API に届いた cookie を付けた `NextRequest` を作ります。
- `POST` は `withDoyaPowerCharge` で包まれたものです。中の `postHandler` を直接呼ばないので、課金の包みを飛ばしません。
- 呼べるルートは、表（`ROUTES`）の5つだけです。画面から届いた値で道すじを作りません。

| ルートの名前 | 道すじ |
|---|---|
| `shodan.prepare` | `/api/shodan/preparations` |
| `quote.suggest` | `/api/quote/documents/suggest` |
| `quote.create` | `/api/quote/documents` |
| `slide.project` | `/api/doyaslide/projects` |
| `slide.structure` | `/api/doyaslide/structure` |

自分のサイトを HTTP（fetch）で呼ぶ形にしなかった理由は3つです。関数の呼び出しが二重になること。Vercel のデプロイの保護に当たるとログインの画面が返ること。cookie を外へ送る道を作らずに済むことです。

### 5.2 必ず通す決まり

| 決まり | どこで確かめるか |
|---|---|
| 旗 | エージェントの API が最初に `isAgentOrchestrationEnabled()` を見る。off なら本文も読まずに 404 |
| ログイン | 各ルートの `getServerSession`（同じ cookie なので同じ本人） |
| 組織のスコープ | 各ルートの `getShodanContext` / `getQuoteContext`。エージェントは組織を指定せず、本人の既定の組織が選ばれる |
| ドヤパワー | 見積の suggest と、スライドの構成は、ルートの `withDoyaPowerCharge` が減らし、失敗なら戻す |
| 各ツールの利用枠 | 商談準備の月の件数、見積書の件数、スライドの月の作成数と日の上限。どれもルートの中で数える |

- 組織の無いツールは、そのツールだけが失敗します（`setup`）。組織を作る画面のリンクを返します。
- ドヤパワーが足りないツールも、そのツールだけが失敗します（`power`）。ルートが返す文を出します。
- 組織を選べるようにするときは、各ツールの `x-{svc}-org` ヘッダーを使います。値はサーバーが本人の所属から選び、画面の値をそのまま使いません。

### 5.3 結果のまとめ（tools.ts）

- `runResearch`・`runQuote`・`runSlides` が、答えからツールへの入力を作り、ルートの答えを `AgentTaskResult` にまとめます。
- ルートの呼び方（`call`）は引数でもらいます。本番は `routes.server.ts`、テストは差し替えです。
- 失敗の文は、ルートが返す利用者向けの `error`（200字まで）を使い、無ければ決まった文にします。ステータスコードやモデル名は出しません。
- できる物はすべて下書きです。送る・確定する・公開するのは、各ツールの画面で人が行います。

## 6. 同時実行・やり直し・中断（runner.ts）

- 前のタスク（`after`）が済んだものから、同時に `concurrency` 個（いまは3）まで動かします。体験の設計書 §10-2 は「まず2つまで」を想定しています。値は `AgentPlan.concurrency` で決めるので、統括の判断で変えられます。
- 前のタスクが失敗したら、あとのタスクは動かさずに `blocked` にします。
- `prev` に前の状態を渡すと、済んだタスクは動かさずに結果を引き継ぎます。失敗したタスクだけのやり直しは、これで行います。
- 途中まで作れたもの（`resume`）を失敗の状態に残し、やり直しで使います。たとえば、スライドのプロジェクトは作れたが構成で失敗したときは、そのプロジェクトに構成だけを作ります。プロジェクトを二重に作らず、月の作成数も二重に数えません。
- 中断（`signal`）すると、まだ始めていないタスクを `canceled` にし、動いているタスクの fetch を止めます。ただし、サーバーで動き始めたツールの処理は最後まで進むことがあります。その場合は、各ツールの画面に結果が残ります。

## 7. ドヤパワー

- 減る量は、`ACTION_CATALOG` の `powerAction` と `costs.ts` の表から計算します。数をほかに書きません。
- 実際に減らす・戻すのは、各ツールのルートの `withDoyaPowerCharge` です。エージェントの API は包みません（二重に減らさない）。
- 確かめの画面（体験の設計書 §6）の「合計」は `AgentPlan.totalPower` を使います。今の残りは、枠のゲージと同じ `doyaPowerCharger.shellState()` から読みます。
- 失敗して戻した分は、タスクの失敗（`kind` が `power` 以外の失敗）から数えられます。完了の画面で「戻した分」を出すには、§8 の表に、タスクごとの減った量と戻した量を残します。

## 8. 保存の表（案。本番 DB の変更なので、統括を通してユーザーの承認が要る）

段階1は、最後の実行を利用者のブラウザ（localStorage、7日まで）に置くだけです。作った物は各ツールの表に保存されます。

体験の設計書 §7 の名前（`home_agent_runs` と `home_agent_tasks`）に合わせた案です。

```prisma
model HomeAgentRun {
  id          String   @id @default(cuid())
  userId      String
  recipeId    String               // 'sales-prep'、AI の作戦は 'ai'
  request     String               // 依頼の文
  answers     Json                 // サーバーで確かめた答え
  plan        Json                 // AgentPlan（AI の作戦も、検査したあとの形で保存）
  status      String               // planned / running / done / partial / canceled
  powerUsed   Int      @default(0)
  powerRefund Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  tasks       HomeAgentTask[]
  @@index([userId, createdAt])
  @@map("home_agent_runs")
}

model HomeAgentTask {
  id         String    @id @default(cuid())
  runId      String
  taskId     String               // 'research' など（作戦の中の id）
  action     String               // 'shodan.research' など
  status     String               // waiting / running / done / failed / blocked / canceled
  attempts   Int       @default(0)
  result     Json?                // AgentTaskResult
  resume     Json?                // 途中まで作れたもの
  error      String?              // 利用者向けの文
  failKind   String?
  startedAt  DateTime?
  endedAt    DateTime?
  run        HomeAgentRun @relation(fields: [runId], references: [id], onDelete: Cascade)
  @@unique([runId, taskId])
  @@map("home_agent_tasks")
}
```

- 表があると、`/api/agent/tasks` は `runId` と `taskId` だけを受け取り、`userId` で絞って作戦を読みます。他人の実行は読めません。`resume` もサーバーが持ちます。
- 画面を移っても進み続ける形は、この表のあとに、サーバーで順に動かす仕組み（Vercel Queues か Workflow）で作ります。
- 同じ `taskId` を同時に2回動かさないよう、`status` を `running` にする更新を条件付き（`updateMany` の `where: { status: { in: ['waiting','failed'] } }`）にします。

## 9. 旗

| 値 | 出す相手 |
|---|---|
| off（既定。値なし・知らない値も） | 誰にも出さない。セッションも読まない。API は 404 |
| preview | `UI_PREVIEW_EMAILS` の人だけ |
| all | ログインしている全員 |

- 実行の仕組みの API（`/api/agent/plan`・`/api/agent/tasks`）は `AGENT_ORCHESTRATION_ROLLOUT` で止めます（`src/lib/agent-orchestration/flag.ts`）。
- 体験の設計書 §8 は、画面の旗として `HOME_AGENT_ROLLOUT` を挙げています。旗を1つにまとめるか、画面と API で分けるかは、統括に決めてもらいます（§12-1）。まとめる場合は、`flag.ts` の環境変数の名前を変えるだけで済みます。
- 開発の確認だけに使う値: `AGENT_ORCHESTRATION_FAKE_TOOLS=1`。各ツールを呼ばずに見本の結果を返します。`NODE_ENV=production` では値があっても効きません。本番の環境変数には置きません。

## 10. 確かめ方

| テスト | 中身 |
|---|---|
| `src/lib/agent-orchestration/runner.test.ts` | 同時に動かす数の上限、順番、失敗だけのやり直し、中断、順番の誤り |
| `src/lib/agent-orchestration/tools.test.ts` | 答えの検査、ルートへの入力、結果のまとめ、失敗の種類、商談の準備を最後まで動かす（スライドの失敗だけを、作ったプロジェクトでやり直す） |
| `src/lib/agent-orchestration/plan.test.ts` | 組み合わせからの作戦、減る量を costs.ts から引く、AI の作戦の検査 |
| `scripts/security-regression/verify-agent-orchestration.cjs` | 旗（off でセッションを読まない・preview の許可）、2つの API の 404・400・答えの形、決まった5つのルートだけを cookie 付きで呼ぶ、本番で見本に差し替えない、経営ホームの画面にまだつながない |

- `npm run test:agent` と `npm run test:security` に入っています。どちらも `npm run build` で流れます。
- 見本の画面: 開発の確認ページ `/home/agent-lab`（本番と、旗が off のときは 404）。見本の結果で、聞く → 計画 → 3つを同時に → 一部の失敗 → 残りだけやり直し → まとめ、を最後まで動かせます。画面の部品 `src/components/agent-orchestration/AgentOrchestrator.tsx` は、この確認のための見本です。本番の画面は UIリニューアルが作ります。

## 11. 本番で確かめること（ユーザーの承認のあと）

有料の AI を呼ぶので、次の確認は、統括を通してユーザーの承認を取ってから行います。

- 使うモデル: `@seo/lib/gemini` の既定（`GEMINI_TEXT_MODEL_DEFAULT`）。見積の品目の案（suggest）とスライドの構成（structure）で使います。
- 商談準備の調査は AI を使いません（相手のサイトの読み込みと gBizINFO）。スライドの構成は、SERPAPI のキーがあれば Web 検索を1回使います。
- 1回の「商談の準備」で呼ぶ有料の AI: 文章の生成2回（見積1回・スライドの構成1回。構成は最大8,192トークンの出力）。画像の生成はありません。
- 見込み額: 文章の生成2回で、1回あたり数円以下の見込みです。正確な額は、単価の表で出してから、統括を通してユーザーに聞きます。
- 確かめること:
  1. 旗を preview にし、許可した人のアカウントで「商談の準備」を1回動かす
  2. 3つのタスクが同時に「動いています」になる
  3. 各ツールの画面に、調査の記録・見積書の下書き・スライドの構成が残る
  4. 組織の無いツールが、そのツールだけ失敗し、リンクから組織を作ってやり直せる

## 12. 統括に決めてもらうこと

1. 旗を1つにするか（`HOME_AGENT_ROLLOUT` と `AGENT_ORCHESTRATION_ROLLOUT`）。
2. 同時に動かす数の上限（いま3。体験の設計書は2）。
3. `agent.plan` のドヤパワーの量（段階2）。
4. §8 の表を本番 DB に足す時期。

## 13. まだ良くない点と、次の改善

まだ良くない点:

- 作戦は組み合わせごとに決まった形で、文の中身からタスクを足し引きしません（段階2で AI に替える）。
- 段の一覧は時間で進む表示で、各ツールの本当の進み具合ではありません。
- 結果は localStorage だけに残り、別の端末では見られません。
- 組織を選べません（本人の既定の組織だけ）。
- ログインした状態での本物の画面の確認はしていません（ローカルに本番以外の DB とログインが無いため）。

次の改善の提案:

1. §8 の表を作り、`/api/agent/tasks` を `runId` 方式にする（AI の作戦を安全に動かす前提）
2. `/api/agent/plan` に AI の作戦づくりを足し、`sanitizeAiPlan` を通す（`agent.plan` の量が決まってから）
3. 販促（ペルソナ → バナー・記事）を足し、タスクの間で結果を渡す形（`handoff`）を本番で使う
4. 確かめの画面のために、残りのドヤパワーと、各ツールの残りの枠を作戦の答えに含める
5. 依頼の文の中の URL などを、質問の答えに先に入れる
6. 所属が2つ以上ある人には、組織を選ぶ質問を足す
