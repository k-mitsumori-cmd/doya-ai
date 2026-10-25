-- サポートチャットの受付（support_ticket）と、やり取りの履歴（support_message）を足す。
-- 設計: docs/architecture/support-chat/SUPPORT-CHAT-2026-10-26.md の 7章。
-- 追加だけ。既存の表と既存のデータは変えない。何度流しても同じ結果になる（IF NOT EXISTS）。
-- コードの反映（main への取り込み）より前に流す。流す前でも、旗 SUPPORT_CHAT_ROLLOUT が off なら表は読まれない。
-- 表が無いあいだに旗を on にした場合、受付は ServiceFeedback（serviceId 'support'）に残る（src/lib/support-chat/store.ts）。
-- 元に戻すとき: DROP TABLE "support_message"; DROP TABLE "support_ticket";（この2つの表のデータだけが消える）
SET lock_timeout = '5s';
SET statement_timeout = '60s';

BEGIN;

CREATE TABLE IF NOT EXISTS "support_ticket" (
    "id" TEXT NOT NULL,
    "ticketNo" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "severity" TEXT NOT NULL,
    "toolId" TEXT,
    "pagePath" TEXT,
    "summary" TEXT NOT NULL,
    "env" JSONB,
    "contactOk" BOOLEAN NOT NULL DEFAULT true,
    "assigneeEmail" TEXT,
    "firstReplyAt" TIMESTAMP(3),
    "lastStaffReplyAt" TIMESTAMP(3),
    "userLastReadAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "satisfaction" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "support_ticket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "support_message" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sources" JSONB,
    "authorEmail" TEXT,
    "emailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "support_message_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "support_ticket_ticketNo_key" ON "support_ticket"("ticketNo");
CREATE INDEX IF NOT EXISTS "support_ticket_userId_createdAt_idx" ON "support_ticket"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "support_ticket_status_createdAt_idx" ON "support_ticket"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "support_message_ticketId_createdAt_idx" ON "support_message"("ticketId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_ticket_userId_fkey') THEN
    ALTER TABLE "support_ticket" ADD CONSTRAINT "support_ticket_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_message_ticketId_fkey') THEN
    ALTER TABLE "support_message" ADD CONSTRAINT "support_message_ticketId_fkey"
      FOREIGN KEY ("ticketId") REFERENCES "support_ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;

-- 確かめる: SELECT to_regclass('public.support_ticket'), to_regclass('public.support_message');
