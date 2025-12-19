import { prisma } from '@/lib/prisma'

let bootstrapPromise: Promise<void> | null = null

/**
 * 本番DBで Seo* テーブルが未作成のままデプロイされるケース（migrate未実行等）を自己回復するためのブートストラップ。
 * - CREATE TABLE IF NOT EXISTS で冪等に作成
 * - FK制約は省略（権限/順序で失敗しやすいため）。Prismaは列が存在すれば動作可能。
 */
export async function ensureSeoSchema(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise
  bootstrapPromise = (async () => {
    // テーブル作成（最低限: Prismaスキーマと同じ列名/型）
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SeoArticle" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT,
        "status" TEXT NOT NULL DEFAULT 'DRAFT',
        "title" TEXT NOT NULL,
        "keywords" JSONB NOT NULL,
        "persona" TEXT,
        "searchIntent" TEXT,
        "targetChars" INTEGER NOT NULL DEFAULT 10000,
        "tone" TEXT NOT NULL DEFAULT '丁寧',
        "forbidden" JSONB,
        "referenceUrls" JSONB,
        "llmoOptions" JSONB,
        "outline" TEXT,
        "finalMarkdown" TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SeoJob" (
        "id" TEXT PRIMARY KEY,
        "articleId" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'queued',
        "progress" INTEGER NOT NULL DEFAULT 0,
        "step" TEXT NOT NULL DEFAULT 'init',
        "error" TEXT,
        "cursor" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "startedAt" TIMESTAMPTZ,
        "finishedAt" TIMESTAMPTZ
      );
    `)

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SeoSection" (
        "id" TEXT PRIMARY KEY,
        "articleId" TEXT NOT NULL,
        "jobId" TEXT,
        "index" INTEGER NOT NULL,
        "headingPath" TEXT,
        "plannedChars" INTEGER NOT NULL DEFAULT 2000,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "prompt" TEXT,
        "content" TEXT,
        "consistency" TEXT,
        "error" TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SeoReference" (
        "id" TEXT PRIMARY KEY,
        "articleId" TEXT NOT NULL,
        "url" TEXT NOT NULL,
        "title" TEXT,
        "fetchedAt" TIMESTAMPTZ,
        "extractedText" TEXT,
        "headings" JSONB,
        "summary" TEXT,
        "insights" JSONB,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SeoAuditReport" (
        "id" TEXT PRIMARY KEY,
        "articleId" TEXT NOT NULL,
        "jobId" TEXT,
        "report" TEXT NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SeoUserMemo" (
        "id" TEXT PRIMARY KEY,
        "articleId" TEXT NOT NULL UNIQUE,
        "content" TEXT NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SeoImage" (
        "id" TEXT PRIMARY KEY,
        "articleId" TEXT NOT NULL,
        "kind" TEXT NOT NULL,
        "title" TEXT,
        "prompt" TEXT NOT NULL,
        "description" TEXT,
        "filePath" TEXT NOT NULL,
        "mimeType" TEXT NOT NULL DEFAULT 'image/png',
        "width" INTEGER,
        "height" INTEGER,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SeoLinkCheckResult" (
        "id" TEXT PRIMARY KEY,
        "articleId" TEXT NOT NULL,
        "url" TEXT NOT NULL,
        "statusCode" INTEGER,
        "ok" BOOLEAN NOT NULL DEFAULT FALSE,
        "finalUrl" TEXT,
        "error" TEXT,
        "checkedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SeoKnowledgeItem" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT,
        "articleId" TEXT,
        "type" TEXT NOT NULL,
        "title" TEXT,
        "content" TEXT NOT NULL,
        "sourceUrls" JSONB,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    // 新しいカラムの追加（既存テーブルへのマイグレーション）
    // requestText と referenceImages を追加
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "SeoArticle" ADD COLUMN IF NOT EXISTS "requestText" TEXT;`)
    } catch { /* column might already exist */ }
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "SeoArticle" ADD COLUMN IF NOT EXISTS "referenceImages" JSONB;`)
    } catch { /* column might already exist */ }

    // indexes / uniques（冪等）
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SeoArticle_userId_createdAt_idx" ON "SeoArticle" ("userId", "createdAt");`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SeoArticle_status_createdAt_idx" ON "SeoArticle" ("status", "createdAt");`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SeoJob_articleId_createdAt_idx" ON "SeoJob" ("articleId", "createdAt");`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SeoJob_status_updatedAt_idx" ON "SeoJob" ("status", "updatedAt");`)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "SeoSection_articleId_index_key" ON "SeoSection" ("articleId", "index");`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SeoSection_articleId_index_idx" ON "SeoSection" ("articleId", "index");`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SeoSection_status_updatedAt_idx" ON "SeoSection" ("status", "updatedAt");`)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "SeoReference_articleId_url_key" ON "SeoReference" ("articleId", "url");`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SeoReference_articleId_createdAt_idx" ON "SeoReference" ("articleId", "createdAt");`)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "SeoLinkCheckResult_articleId_url_key" ON "SeoLinkCheckResult" ("articleId", "url");`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SeoLinkCheckResult_articleId_checkedAt_idx" ON "SeoLinkCheckResult" ("articleId", "checkedAt");`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SeoKnowledgeItem_userId_createdAt_idx" ON "SeoKnowledgeItem" ("userId", "createdAt");`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SeoKnowledgeItem_type_createdAt_idx" ON "SeoKnowledgeItem" ("type", "createdAt");`)
  })().catch((e) => {
    // 次回リトライできるように
    bootstrapPromise = null
    throw e
  })

  return bootstrapPromise
}


