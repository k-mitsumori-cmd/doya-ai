-- 管理者認証システム用テーブル作成SQL
-- SupabaseのSQL Editorで実行してください

-- AdminUser テーブル
CREATE TABLE IF NOT EXISTS "AdminUser" (
  "id" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "email" TEXT,
  "name" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- ユニーク制約
CREATE UNIQUE INDEX IF NOT EXISTS "AdminUser_username_key" ON "AdminUser"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "AdminUser_email_key" ON "AdminUser"("email");

-- AdminLoginAttempt テーブル
CREATE TABLE IF NOT EXISTS "AdminLoginAttempt" (
  "id" TEXT NOT NULL,
  "adminUserId" TEXT,
  "username" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "success" BOOLEAN NOT NULL,
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdminLoginAttempt_pkey" PRIMARY KEY ("id")
);

-- 外部キー制約
ALTER TABLE "AdminLoginAttempt" 
ADD CONSTRAINT "AdminLoginAttempt_adminUserId_fkey" 
FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- インデックス
CREATE INDEX IF NOT EXISTS "AdminLoginAttempt_adminUserId_createdAt_idx" ON "AdminLoginAttempt"("adminUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminLoginAttempt_username_createdAt_idx" ON "AdminLoginAttempt"("username", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminLoginAttempt_ipAddress_createdAt_idx" ON "AdminLoginAttempt"("ipAddress", "createdAt");

-- AdminSession テーブル
CREATE TABLE IF NOT EXISTS "AdminSession" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "adminUserId" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- ユニーク制約
CREATE UNIQUE INDEX IF NOT EXISTS "AdminSession_token_key" ON "AdminSession"("token");

-- 外部キー制約
ALTER TABLE "AdminSession" 
ADD CONSTRAINT "AdminSession_adminUserId_fkey" 
FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- インデックス
CREATE INDEX IF NOT EXISTS "AdminSession_adminUserId_idx" ON "AdminSession"("adminUserId");
CREATE INDEX IF NOT EXISTS "AdminSession_token_idx" ON "AdminSession"("token");
CREATE INDEX IF NOT EXISTS "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");

