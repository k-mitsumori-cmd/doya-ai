# 複数のツールを同時に動かすエージェント — 実行の仕組みの設計書（2026-10-25）

この文書は、経営ホームの新しい体験のうち、**実行の仕組み**を書きます。

- 土台にした設計書: `docs/architecture/management-agent/HOME-AGENT-EXPERIENCE-2026-10-25.md`（ブランチ `docs/home-agent-experience`、c6cf281c。以下「体験の設計書」）
- 見本 v3: https://claude.ai/artifact/VBMZGeCJFiWZ7MVoXuezAG
- 分担（統括の指示、2026-10-25）
  - このブランチ（`feat/agent-orchestration`）: 作戦づくり・タスクの実行・同時実行・失敗のやり直し・ドヤパワー・保存の表
  - UIリニューアル: 画面（分析の演出・作戦・ToDo の一覧・実行中の見せ方）と、経営ホームの画面のファイル。置き場所は `src/components/home-agent/`
- 画面と実行の仕組みは、§3 の型と API だけでつなぎます。このブランチは、経営ホームの画面のファイル（`HomeDashboard.tsx` など）を変えません。

---

## 1. 流れと、どちらが受け持つか

体験の設計書 §3 の場面に、この設計の API と型を当てはめます。

| 場面 | 画面（UIリニューアル） | 実行の仕組み（このブランチ）が渡すもの |
|---|---|---|
| 0. 入力 | 入力欄・依頼の例・続きを進める | `POST /api/agent/plan`（`text` か `recipeId`）。合わなければ `{ kind: 'none' }` |
| 0.5 質問 | 2〜4問の質問（選択肢つき。文字の欄は1つまで） | `{ kind: 'questions', questions }`（`AgentQuestionView`）と、答えの誤り（`error`） |
| 1. 分析 | 材料の札が流れ込み、それぞれの棒が同時に進む。考えたことが1行ずつ出る | **型1** `AgentSourceView`（読んでいる・読んだ）と **型2** `reasons`。NDJSON で届いた順に描く |
| 2. ゴール・柱・ToDo | ゴールのカード（今・ゴール・差）→ 柱 → ToDo の木 | **型3** `AgentGoalView`、**型4** `AgentPillar` と `AgentPlanTask` |
| 3. 確かめ | 合計で減るドヤパワーと、今の残り・実行後の残り | `AgentPlan.totalPower`（任せる ToDo だけ）と `AgentPowerView` |
| 4. 実行 | 任せた ToDo を3件ずつ同時に進める | `runAgentTasks` と `POST /api/agent/tasks`。**型5** `AgentTodoView`（`todoViewOf` が作る） |
| 5. 完了と記憶 | できた物の一覧・失敗して戻した分 | `AgentTodoView.draft`、`todoCounts().powerRefunded`。記憶（続きを進める）は §8 の表のあと |

体験の設計書との違いは、「0.5 質問」があることです。統括から最初に受けた指示（足りない情報を2〜4問だけ聞く）によります。
作戦を AI が作る段階（§4.3）では、足りない情報があれば AI が質問を返す形にします。型は同じです。

## 2. 全体の作り

```
画面（src/components/home-agent/）                     サーバー
  依頼の文 ─────────────────────────────────────▶ POST /api/agent/plan
  ◀── { kind: 'questions' | 'none' }                   旗 → 本文 → 組み合わせを選ぶ
  答え ────────────────────────────────────────▶ POST /api/agent/plan（answers 付き、Accept: application/x-ndjson）
  ◀── {type:'source'} … 材料を読み始め・読み終わり       答えを検査 → 材料を同時に読む（sources.ts）
  ◀── {type:'reason'} … 考えたことの1行                  → 作戦を作る（plan.ts）
  ◀── {type:'result', response:{ kind:'plan', plan, sources, power }}
  「まとめて進める」（確かめは1回）
  runAgentTasks（同時に3つまで。runner.ts）
    ToDo ごとに ────────────────────────────────▶ POST /api/agent/tasks { recipeId, taskId, answers, resume }
                                                      旗 → 本文 → 答えを検査 → ツールへの入力を作る
                                                      → 各ツールの API ルートの POST を、同じ cookie で内部から呼ぶ
    ◀── { result }（下書きと power）か { error, kind, resume, href, power }
  todoViews(tasks, states) で札に描く
```

決めたこと:

- 同時に動かすのは画面です。画面が、ToDo ごとに `/api/agent/tasks` を同時に呼びます。
  - 1回の呼び出しが1つのツールなので、Vercel の関数の時間（300秒）に収まります。
  - ToDo ごとに別の関数として動くので、本当に同時に進みます。
  - 進み具合を、ToDo ごとにすぐ画面に出せます。
- 分析の材料は、サーバーが同時に読み、読み終えた順に NDJSON で流します。画面は届いた順に札を描くだけにします（作り話の進み具合を出さない）。
- 順番と同時に動かす数の決まりは `runner.ts` の1か所に置き、画面もテストも同じ部品を使います。
- 画面を移っても進み続ける形（体験の設計書 §7 の段階3）は、§8 の表を足したあとにサーバーの実行へ移します。

## 3. 型の約束（画面とつなぐところ）

正本は `src/lib/agent-orchestration/types.ts`（`AGENT_CONTRACT_VERSION = 2`）です。
画面はこの型だけを見て作ります。画面が呼んでよい関数は、次の4つです。

| 関数 | 場所 | 使い道 |
|---|---|---|
| `runAgentTasks` | `runner.ts` | ToDo を順番どおりに同時に動かす（§3.6） |
| `progressOf` | `runner.ts` | 動いている数・済んだ数 |
| `todoViews` / `todoViewOf` | `view.ts` | runner の状態を、札の形（型5）にする |
| `todoCounts` | `view.ts` | 札の数と、減った量・戻した量の合計 |

形を変えるときは `AGENT_CONTRACT_VERSION` を上げ、両方の側に知らせます。

### 3.1 型1 分析の材料と、その進み具合

```ts
type AgentSourceKind = 'request' | 'company' | 'tools' | 'power' | 'history'
interface AgentSourceView {
  id: string
  kind: AgentSourceKind
  label: string                        // 札の名前（例: 「登録会社の情報」）
  status: 'reading' | 'read' | 'skipped'
  note?: string                        // 読んだ結果の一文（例: 「サンプル株式会社」）
}
```

いま読む材料は4つです。どれも本人の分だけを、同時に読みます（`sources.ts` / `sources.server.ts`）。

| id | 札の名前 | 読むもの | 読めないとき |
|---|---|---|---|
| request | 依頼と答え | 答えた内容（相手・提案・場） | — |
| company | 登録会社の情報 | 本人が登録した会社（`getAccountCompanyName`） | skipped「まだ登録されていません」 |
| tools | 使うツールの準備 | 商談準備と見積もりAI の組織があるか | 組織が無いツールの ToDo は `ready.ok: false` |
| power | ドヤパワーの残り | 旗の内側で会社が登録済みのときだけ、台帳の残りと次の回復の時刻 | skipped「ドヤパワーを使わない設定です」 |

- `history`（前回の作戦）は、§8 の表ができてから読みます。型にだけ先に入れてあります。
- 読めなかった材料は `skipped` にし、作戦づくりは止めません。

### 3.2 型2 作戦の理由の文

`AgentPlan.reasons: string[]`（3〜5行）。考えたことの行（Blur Text / Text Effect）にそのまま出します。

- 答えと、読んだ材料から作ります。例:「見積もりAIは、先に組織を作る必要があります。」（tools の材料から）
- NDJSON では、材料を読み終えたあとに `{ type: 'reason', text }` で1行ずつ届きます。

### 3.3 型3 ゴール（今・ゴール・差）

```ts
interface AgentGoalView {
  statement: string     // 例: 「example.co.jp との提案の場に、資料をそろえて臨む」
  period: string        // 例: 「今日」
  measure: string       // 何を数えるか（例: 「商談の資料」）
  unit: string          // 例: 「点」
  now: number           // Number Ticker でそのまま数え上げる整数
  target: number
  gap: number           // target − now（0 より小さくしない）
}
```

商談の準備では、今 0・ゴール 3（ToDo の数）・差 3 です。AI の作戦（段階2）では、AI が返した数を整数に直して使い、無ければ ToDo の数にします。

### 3.4 型4 柱と ToDo

```ts
interface AgentPillar {
  id: string
  name: string          // 例: 「相手を知る」
  why: string           // 柱を置く理由
  teamGoal: string      // チームのゴール（例: 「example.co.jp の事業と最近の動きを、3行で話せる」）
  tasks: AgentPlanTask[]
}
interface AgentPlanTask {
  id: string
  action: AgentActionId           // 'shodan.research' | 'quote.draft' | 'slide.structure'
  tool: string                    // shell/tools.ts のツールの id
  toolName: string
  title: string                   // 内容
  makes: string                   // 何ができるか
  uses: string                    // 数える利用枠
  power: number                   // 減る量（costs.ts から。AI に決めさせない）
  minutes: number                 // 所要の目安
  after: string[]                 // 先に済んでいる必要がある ToDo
  stages: string[]                // 動いている間の段。最後は「…仕上げています」
  delegable: boolean              // ドヤくんに任せられるか（false は人がする ToDo）
  delegate: boolean               // 「ドヤくんに任せる」の最初の値（画面で外せる）
  ready: { ok: boolean; reason?: string; href?: string; hrefLabel?: string }  // 始められるか
}
interface AgentPlan {
  version: 2
  source: 'recipe' | 'ai'
  recipeId: string
  goal: AgentGoalView
  reasons: string[]
  pillars: AgentPillar[]
  totalPower: number              // 任せる ToDo の power の合計（最初の値）
  concurrency: number             // 同時に動かす数の上限（いまは3）
}
```

- 組織が無いツールの ToDo は、`delegate: false` と `ready.ok: false` で返します。`ready.href` は組織を作る画面です。
- 画面でチェックを外したら、合計は画面で計算し直します（`plan.ts` の `delegatedPower` と同じ足し方）。
- 実行するのは `delegate` が true の ToDo だけです。画面は、`runAgentTasks` に任せる ToDo だけを渡します。任せない ToDo に頼る ToDo（`after`）は、渡す前に外すか、人が済ませてから動かします。

### 3.5 型5 ToDo の実行の状態と、できた下書き

```ts
type AgentTodoStatus = 'waiting' | 'running' | 'done' | 'failed'   // 待つ・進む・できた・失敗した
interface AgentTodoView {
  id: string
  status: AgentTodoStatus
  stage: number | null                           // 今の段（running のとき）
  power: { used: number; refunded: number }      // 減った量・戻した量（試みごとに足していく）
  powerKnown: boolean                            // 量が分かっているか（答えが一度でも届いた）
  draft?: { summary: string; points: string[]; href: string; hrefLabel: string }  // できた下書きと、各ツールの画面へのリンク
  error?: { text: string; kind: AgentFailureKind; href?: string; hrefLabel?: string }
  retryable: boolean
  attempts: number
}
```

- runner の6つの状態を、画面の4つに寄せます。`failed`・`blocked`（前の ToDo が済まなかった）・`canceled`（止めた）は、どれも `failed` で、やり直せます。
- 「失敗して戻した」は `power.refunded` です。数え方:
  - ドヤパワーの包みは、減ったまま（戻していない）の応答にだけ、操作のキー（`x-doya-power-op`）を付けます。キーがあれば `used` に足します。
  - 包みが付いたルート（見積の suggest・スライドの構成）が失敗し、キーが無ければ、包みが戻したので `refunded` に足します。
  - ドヤパワーの残りが足りずに断られたとき（`DOYA_POWER_*`）は、減っていないので、どちらにも足しません。
  - 量は `costs.ts` の表から数えた目安です。作り直しの半額などで、台帳の実際の量と違うことがあります。正確な量は §8 の表に台帳の操作のキーを残してから出します。
- 失敗の文の出し分け（画面の決まり）:

  | 条件 | 文の例 |
  |---|---|
  | `powerKnown` が false | 量を言わない（例:「通信が切れました。もう一度お試しください。」だけ） |
  | `used` > 0 | 「N 減りました（途中まで作れた分）」。見積の品目の案は作れたが保存で失敗した、など |
  | `used` が 0 で `refunded` > 0 | 「減った分（N）は戻しました」 |
  | どちらも 0 | 「ドヤパワーは減っていません」 |

- 画面の `execute` は、422 の答えの `power` を `AgentTaskError` の5つ目の引数に渡します。渡さないと、量が分からないまま「減っていません」と出てしまいます。
- 「今◯個のツールが動いています」は `todoCounts(views).running` です。

### 3.6 API

| API | 本文 | 答え |
|---|---|---|
| `POST /api/agent/plan` | `{ text?, recipeId?, answers? }` | `{ kind: 'questions', recipeId, title, lead, questions, error? }` / `{ kind: 'plan', recipeId, title, lead, plan, sources, power, answers }` / `{ kind: 'none' }` |
| `POST /api/agent/plan`（`Accept: application/x-ndjson`） | 同じ | 1行ずつ `AgentPlanEvent`: `source` → `reason` → `result`（失敗は `error` で終わる） |
| `POST /api/agent/tasks` | `{ recipeId, taskId, answers, resume? }` | 200 `{ result }`（`result.power` 付き）/ 422 `{ error, kind, resume?, href?, power? }` / 400 入力の誤り / 404 旗の外 |

- `kind: 'none'` のときは、今の経営ホームの振り分け（`matchHomeIntent` と `planAgent`）に戻します。
- 失敗の `kind`: `setup`（ツールの組織が無い）・`auth`（ログイン切れ）・`power`（ドヤパワー不足）・`limit`（ツールの上限）・`input`・`tool`。
- `href` は、失敗のときに開くとよい中の画面です（組織を作る・料金を見る）。外のサイトは返しません。
- `resume` は「途中まで作れたもの」です。画面は、失敗した ToDo の `resume` を、やり直しのときにそのまま送り返します（`runAgentTasks` の `prev` に前の状態を渡せば、自動で送られます）。

### 3.7 同時に動かす部品

```ts
runAgentTasks({
  tasks,                 // 任せる ToDo を planTasks(plan) から選んだもの（after を dependsOn にした平らな一覧）
  execute,               // (task, { signal, upstream, resume }) => Promise<AgentTaskResult>。中で /api/agent/tasks を呼ぶ
  concurrency,           // plan.concurrency
  prev,                  // 前の実行の状態（失敗だけのやり直し）
  signal,                // 中断
  onChange,              // (states) => void。todoViews(tasks, states) で札に描く
})
```

`execute` で `/api/agent/tasks` が 422 を返したら、`AgentTaskError(error, kind, resume, href, power)` を投げます。見本の画面（`AgentOrchestrator.tsx` の `runViaApi`）が、この書き方の例です。

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
- 確かめの画面（体験の設計書 §6）:
  - 合計は `AgentPlan.totalPower`（任せる ToDo だけ）。チェックを外したら画面で計算し直す。
  - 今の残りと次の回復の時刻は、作戦の答えの `power`（`AgentPowerView`）。台帳の `balanceView()` から読む。
  - 実行後の残りは「残り − 合計」。足りなければ、実行のボタンを押せなくする（画面の決まり）。
- 減った量・戻した量は ToDo ごとに `AgentTodoView.power` で返します（数え方は §3.5）。完了の画面の「失敗して戻した分」は `todoCounts(views).powerRefunded` です。

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
| `src/lib/agent-orchestration/tools.test.ts` | 答えの検査、ルートへの入力、結果のまとめ、失敗の種類、商談の準備を最後まで動かす（スライドの失敗だけを、作ったプロジェクトでやり直す）、ドヤパワーの減った量・戻した量の数え方 |
| `src/lib/agent-orchestration/plan.test.ts` | 組み合わせからの作戦（ゴール・理由・チームのゴール・任せる初期値）、組織が無いツールの ToDo、減る量を costs.ts から引く、AI の作戦の検査、分析の材料を同時に読み読み終えた順に知らせる、ToDo の状態を画面の4つに寄せる |
| `scripts/security-regression/verify-agent-orchestration.cjs` | 旗（off でセッションを読まない・preview の許可）、2つの API の 404・400・答えの形、作戦の NDJSON（材料 → 理由 → 答え）、決まった5つのルートだけを cookie 付きで呼び、操作のキーを返す、本番で見本に差し替えない、経営ホームの画面にまだつながない |

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
