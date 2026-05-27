export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

// ========================================
// ドヤHR専用Webhook — 無効化
// ========================================
// HRの課金はドヤAI統一Webhook（/api/stripe/webhook）で処理されるようになりました。
// ALL_SERVICE_IDS に 'hr' が含まれているため、UserServiceSubscription(serviceId:'hr') は
// 統一Webhookが自動的にupsert/削除します。
// HrOrganization.plan の同期も統一Webhook側で行われます。
//
// このエンドポイントは互換性のために残していますが、新規のWebhook登録は
// /api/stripe/webhook に統一してください。

export async function POST(request: NextRequest) {
  console.log('[HrWebhook] This endpoint is deprecated. Use /api/stripe/webhook instead.')
  return NextResponse.json({
    received: true,
    deprecated: true,
    message: 'HR billing is now handled by the unified webhook at /api/stripe/webhook',
  })
}
