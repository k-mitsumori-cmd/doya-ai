-- アプリ版の認証の土台（2026-11-18）。設計: docs/architecture/2026-11-18-app/account-integrity.md、手順書: docs/architecture/2026-11-18-app/db-push-runbook.md
-- 変えるもの（prisma/schema.prisma に入れたものだけ）:
--   1. "User" に列を足す: "emailNormalized"（索引のみ・一意にしない）、"deletedAt"、"anonymizedAt"
--   2. "Account" に列を足す: "providerEmail"、"emailVerified"
--   3. 表を足す: "app_device"（端末ごとのリフレッシュトークン）、"auth_link_request"（結び付けの待ち）、"app_id_token_use"（使った id_token の控え）、"app_web_handoff"（アプリから Web のセッションへ引き渡す、使い捨てのコード）
--   4. "interviewx_projects" の "userId" の外部キーを ON DELETE CASCADE にそろえる（いまは指定なしで User の削除が止まる）
-- 追加が中心。既存の列のデータは変えない。何度流しても同じ結果になる（IF NOT EXISTS と、外部キーの作り直しの条件）。
-- 本番への反映は、三森さんの承認のあと。コードの反映（main への取り込み）より前に流す。
-- 流し方: ~/Code/tools/doya-migrate/apply-sql.cjs（5432 のセッション接続。~/.claude/skills/doya-db-push の 1）。
-- 元に戻すとき（この SQL で足したものだけ消える。先に、足したものを読むコードが本番に無いことを確かめる）:
--   DROP INDEX IF EXISTS "app_device_pushToken_live_key"; ALTER TABLE "app_device" DROP COLUMN IF EXISTS "pushToken";（表ごと消すなら不要）
--   DROP TABLE IF EXISTS "app_device"; DROP TABLE IF EXISTS "auth_link_request"; DROP TABLE IF EXISTS "app_id_token_use"; DROP TABLE IF EXISTS "app_web_handoff";
--   DROP INDEX IF EXISTS "User_emailNormalized_idx";
--   ALTER TABLE "User" DROP COLUMN IF EXISTS "emailNormalized", DROP COLUMN IF EXISTS "deletedAt", DROP COLUMN IF EXISTS "anonymizedAt";
--   ALTER TABLE "Account" DROP COLUMN IF EXISTS "providerEmail", DROP COLUMN IF EXISTS "emailVerified";
--   （4 の外部キーを元の「指定なし」に戻すなら: 下の 4 の DO ブロックの ON DELETE CASCADE を外して作り直す）
-- 流し方の注意: apply-sql.cjs は、文を「;」で区切り、1つのトランザクションに入れて流す（SET LOCAL も自分で付ける）。
-- このため、この SQL には BEGIN・COMMIT・SET を書かない。DO ブロックは、$$ ではなく単一引用符の文字列（DO '...'）で書く
-- （apply-sql.cjs は $$ の中の「;」を区切りと見なして壊すため）。psql で流すなら、必ず -1（1つのトランザクション）と ON_ERROR_STOP を付ける。
-- 区切ったあとの文の数は、apply-sql.cjs の確認だけの実行で出る（この SQL は 38 文。apply-sql.cjs と同じ区切り方で数えた値。流す前に、確認だけの実行の表示と合うか見る）。

-- 1. User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailNormalized" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "anonymizedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "User_emailNormalized_idx" ON "User"("emailNormalized");

-- 2. Account
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "providerEmail" TEXT;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN;

-- 3. 新しい表
CREATE TABLE IF NOT EXISTS "app_device" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceLabel" TEXT,
    "platform" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "sessionId" TEXT,
    "rotatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "app_device_pkey" PRIMARY KEY ("id")
);

-- 通知の許可をした端末のプッシュトークン（送信は未実装。設計: push-design.md）
ALTER TABLE "app_device" ADD COLUMN IF NOT EXISTS "pushToken" TEXT;
-- 生きている行（失効も替え済みでもない行）の pushToken は一意（同時の登録の競合を DB で守る。Prisma のスキーマには部分索引を書けないので、ここだけにある）
CREATE UNIQUE INDEX IF NOT EXISTS "app_device_pushToken_live_key" ON "app_device"("pushToken") WHERE "pushToken" IS NOT NULL AND "revokedAt" IS NULL AND "rotatedAt" IS NULL;

CREATE TABLE IF NOT EXISTS "auth_link_request" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "providerEmail" TEXT,
    "codeHash" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auth_link_request_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "app_id_token_use" (
    "hash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "app_id_token_use_pkey" PRIMARY KEY ("hash")
);

CREATE INDEX IF NOT EXISTS "app_id_token_use_expiresAt_idx" ON "app_id_token_use"("expiresAt");

CREATE TABLE IF NOT EXISTS "app_web_handoff" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "challengeHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "nextPath" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "webSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "app_web_handoff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "app_device_refreshTokenHash_key" ON "app_device"("refreshTokenHash");
CREATE INDEX IF NOT EXISTS "app_device_userId_idx" ON "app_device"("userId");
CREATE INDEX IF NOT EXISTS "app_device_familyId_idx" ON "app_device"("familyId");
CREATE INDEX IF NOT EXISTS "app_device_sessionId_idx" ON "app_device"("sessionId");
CREATE INDEX IF NOT EXISTS "auth_link_request_userId_idx" ON "auth_link_request"("userId");
CREATE INDEX IF NOT EXISTS "auth_link_request_provider_providerAccountId_idx" ON "auth_link_request"("provider", "providerAccountId");
CREATE INDEX IF NOT EXISTS "auth_link_request_expiresAt_idx" ON "auth_link_request"("expiresAt");
CREATE UNIQUE INDEX IF NOT EXISTS "app_web_handoff_codeHash_key" ON "app_web_handoff"("codeHash");
CREATE INDEX IF NOT EXISTS "app_web_handoff_userId_idx" ON "app_web_handoff"("userId");
CREATE INDEX IF NOT EXISTS "app_web_handoff_deviceId_idx" ON "app_web_handoff"("deviceId");
CREATE INDEX IF NOT EXISTS "app_web_handoff_expiresAt_idx" ON "app_web_handoff"("expiresAt");

ALTER TABLE "app_device" DROP CONSTRAINT IF EXISTS "app_device_userId_fkey";
ALTER TABLE "app_device" ADD CONSTRAINT "app_device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auth_link_request" DROP CONSTRAINT IF EXISTS "auth_link_request_userId_fkey";
ALTER TABLE "auth_link_request" ADD CONSTRAINT "auth_link_request_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "app_web_handoff" DROP CONSTRAINT IF EXISTS "app_web_handoff_userId_fkey";
ALTER TABLE "app_web_handoff" ADD CONSTRAINT "app_web_handoff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "app_web_handoff" DROP CONSTRAINT IF EXISTS "app_web_handoff_deviceId_fkey";
ALTER TABLE "app_web_handoff" ADD CONSTRAINT "app_web_handoff_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "app_device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 新しい表は、トークンのハッシュを持つので、公開の役割からの直接のアクセスを止める
-- （サーバーが使っている既存の信頼された DB の役割は、これまでどおり使える。2026-11-09-sfa-team-rls.sql と同じ流儀）
ALTER TABLE public."app_device" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."auth_link_request" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."app_id_token_use" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."app_web_handoff" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."app_device", public."auth_link_request", public."app_id_token_use", public."app_web_handoff" FROM PUBLIC, anon, authenticated;

-- 4. interviewx_projects の userId の外部キーを ON DELETE CASCADE にそろえる。
--    表が無い、外部キーがすでに CASCADE（confdeltype = 'c'）なら何もしない。
--    外部キーが無い場合は、新しく作る（既存の行に持ち主の無い行があると、ここで失敗して全体が元に戻る。
--    その場合は、手順書の「孤児の数を数える SQL」で先に数える）。
DO 'DECLARE fk_name text; fk_action "char"; BEGIN
  IF to_regclass(''public.interviewx_projects'') IS NULL THEN
    RAISE NOTICE ''interviewx_projects が無いので、4 を飛ばします'';
    RETURN;
  END IF;
  SELECT c.conname, c.confdeltype INTO fk_name, fk_action
  FROM pg_constraint c
  WHERE c.conrelid = ''public.interviewx_projects''::regclass
    AND c.contype = ''f''
    AND c.confrelid = ''public."User"''::regclass
    AND c.conkey = ARRAY[(SELECT a.attnum FROM pg_attribute a WHERE a.attrelid = ''public.interviewx_projects''::regclass AND a.attname = ''userId'')];
  IF fk_name IS NOT NULL AND fk_action = ''c'' THEN
    RAISE NOTICE ''すでに ON DELETE CASCADE です（%）'', fk_name;
    RETURN;
  END IF;
  IF fk_name IS NOT NULL THEN
    EXECUTE format(''ALTER TABLE public.interviewx_projects DROP CONSTRAINT %I'', fk_name);
  ELSE
    fk_name := ''interviewx_projects_userId_fkey'';
  END IF;
  EXECUTE format(''ALTER TABLE public.interviewx_projects ADD CONSTRAINT %I FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE'', fk_name);
END';

-- 確かめる:
--   SELECT column_name FROM information_schema.columns WHERE table_name = 'User' AND column_name IN ('emailNormalized','deletedAt','anonymizedAt');   -- 3行
--   SELECT column_name FROM information_schema.columns WHERE table_name = 'Account' AND column_name IN ('providerEmail','emailVerified');           -- 2行
--   SELECT to_regclass('public.app_device'), to_regclass('public.auth_link_request');                                                               -- 両方 NULL でない
--   SELECT conname, confdeltype FROM pg_constraint WHERE conrelid = 'public.interviewx_projects'::regclass AND contype = 'f';                        -- User への外部キーの confdeltype が 'c'
