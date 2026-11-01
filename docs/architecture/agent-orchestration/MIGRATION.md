# エージェントの実行の記録 — 本番DBに足す表の SQL の案（2026-10-25）

- 設計: `docs/architecture/agent-orchestration/DESIGN.md` §8
- スキーマ: `prisma/schema.prisma` の `HomeAgentRun`（`home_agent_runs`）と `HomeAgentTask`（`home_agent_tasks`）
- **⚠️ この SQL はまだ流していない。** 流すのは統括が、ユーザーの承認を取ったあと。
- 既存の表は変えない。新しい表を2つ作り、索引と外部キー（`home_agent_tasks.runId` → `home_agent_runs.id`）を付けるだけ。`User` の表への外部キーは付けない（`User` を変えないため。本人の分は `userId` で絞って読む）。
- 下の SQL は `npx prisma migrate diff --from-schema-datamodel <このブランチの前の schema> --to-schema-datamodel prisma/schema.prisma --script` の出力（2026-10-25）。DB には触れずに出した。

## 流す前の前提

1. **旗は off のまま流す。** 表を読む・書くのは `AGENT_RUNS_STORE=db` のときだけ（`src/lib/agent-orchestration/store-flag.ts`。既定は off）。off のあいだ、表に触れるコードは動かない。表を足すのと旗を変えるのは、別の日にできる。
2. `AGENT_ORCHESTRATION_ROLLOUT`（エージェントの旗）が off なら、`AGENT_RUNS_STORE` が db でも、記録の API は 404 を返す。
3. 流したあと、`AGENT_RUNS_STORE=db` と `AGENT_ORCHESTRATION_ROLLOUT=preview` にして、許可した人で確かめる。旗を変えたら再デプロイが要る（Vercel の環境変数は再デプロイまで反映されない）。

## 流したあとの確かめ

```sql
SELECT to_regclass('public.home_agent_runs'), to_regclass('public.home_agent_tasks');
SELECT indexname FROM pg_indexes WHERE tablename IN ('home_agent_runs', 'home_agent_tasks') ORDER BY indexname;
```

## もとに戻すとき

```sql
DROP TABLE IF EXISTS "home_agent_tasks";
DROP TABLE IF EXISTS "home_agent_runs";
```

（実行の記録だけが消える。作った物（調査の記録・見積書・スライド）は各ツールの表にあるので消えない。）

## SQL（案）

```sql
-- CreateTable
CREATE TABLE "home_agent_runs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "request" TEXT,
    "answers" JSONB NOT NULL,
    "plan" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "powerUsed" INTEGER NOT NULL DEFAULT 0,
    "powerRefunded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_agent_tasks" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "delegated" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB,
    "resume" JSONB,
    "error" TEXT,
    "failKind" TEXT,
    "failHref" TEXT,
    "failHrefLabel" TEXT,
    "powerUsed" INTEGER NOT NULL DEFAULT 0,
    "powerRefunded" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_agent_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "home_agent_runs_userId_createdAt_idx" ON "home_agent_runs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "home_agent_tasks_userId_status_idx" ON "home_agent_tasks"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "home_agent_tasks_runId_taskId_key" ON "home_agent_tasks"("runId", "taskId");

-- AddForeignKey
ALTER TABLE "home_agent_tasks" ADD CONSTRAINT "home_agent_tasks_runId_fkey" FOREIGN KEY ("runId") REFERENCES "home_agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

```
