-- ============================================
-- Row Level Security (RLS) 有効化スクリプト
-- ============================================
-- 
-- このスクリプトは、Supabaseのセキュリティアドバイザーで
-- 「RLS Disabled in Public」と警告されているテーブルに対して
-- RLSを有効化します。
--
-- 実行方法:
-- 1. Supabase Dashboard > SQL Editor で実行
-- 2. または psql で直接実行
--
-- 注意: 
-- - RLSを有効化すると、ポリシーが設定されていない場合、
--   すべてのアクセスがブロックされます
-- - service_role キーを使用するバックエンド（Prisma等）は
--   RLSをバイパスするため、影響を受けません
-- ============================================

-- NextAuth関連テーブル
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerificationToken" ENABLE ROW LEVEL SECURITY;

-- ユーザー管理
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserServiceSubscription" ENABLE ROW LEVEL SECURITY;

-- Stripe関連
ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;

-- サービス・テンプレート
ALTER TABLE "Service" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Template" ENABLE ROW LEVEL SECURITY;

-- 生成履歴
ALTER TABLE "Generation" ENABLE ROW LEVEL SECURITY;

-- システム設定
ALTER TABLE "SystemSetting" ENABLE ROW LEVEL SECURITY;

-- 管理者関連
ALTER TABLE "AdminUser" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdminLoginAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdminSession" ENABLE ROW LEVEL SECURITY;

-- SEO記事生成
ALTER TABLE "SeoArticle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SwipeSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SwipeCelebrationImage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SwipeQuestionImage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SeoJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SeoSection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SeoReference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SeoAuditReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SeoUserMemo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SeoImage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SeoLinkCheckResult" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SeoKnowledgeItem" ENABLE ROW LEVEL SECURITY;

-- ドヤインタビューAI
ALTER TABLE "interview_project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "interview_recipe" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "interview_material" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "interview_transcription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "interview_review" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "interview_draft" ENABLE ROW LEVEL SECURITY;

-- ゲストセッション
ALTER TABLE "guest_session" ENABLE ROW LEVEL SECURITY;

-- ドヤ戦略AI
ALTER TABLE "strategy_project" ENABLE ROW LEVEL SECURITY;

-- ドヤバナーAI
ALTER TABLE "banner_template" ENABLE ROW LEVEL SECURITY;

-- ============================================
-- service_role用のポリシー作成
-- ============================================
-- Prisma（バックエンド）はservice_roleキーを使用するため、
-- RLSをバイパスします。追加のポリシーは不要です。
--
-- もしフロントエンドから直接Supabaseにアクセスする場合は、
-- 以下のようなポリシーを追加してください：
--
-- 例: ユーザーが自分のデータのみアクセス可能にする
-- CREATE POLICY "Users can view own data" ON "User"
--   FOR SELECT USING (auth.uid()::text = id);
--
-- CREATE POLICY "Users can update own data" ON "User"
--   FOR UPDATE USING (auth.uid()::text = id);
-- ============================================

-- 確認用クエリ
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
