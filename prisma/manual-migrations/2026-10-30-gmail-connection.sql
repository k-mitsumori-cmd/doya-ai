-- Gmail 連携（gmail.send）。本番への適用は本人の承認後に doya-db-push 手順で行う
CREATE TABLE IF NOT EXISTS "gmail_connection" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "refreshTokenEnc" TEXT NOT NULL,
  "scope" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "gmail_connection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "gmail_connection_userId_key" ON "gmail_connection"("userId");
ALTER TABLE "gmail_connection" ADD CONSTRAINT "gmail_connection_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "gmail_send_log" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "toEmail" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "source" TEXT,
  "status" TEXT NOT NULL,
  "error" TEXT,
  "messageId" TEXT,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gmail_send_log_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "gmail_send_log_userId_sentAt_idx" ON "gmail_send_log"("userId","sentAt");
ALTER TABLE "gmail_send_log" ADD CONSTRAINT "gmail_send_log_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
