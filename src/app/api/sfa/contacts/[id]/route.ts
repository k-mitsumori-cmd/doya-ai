export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest } from 'next/server'
import { crmDetail } from '@/lib/sfa/crm-record-http'

type Context = { params: Promise<{ id: string }> }
export async function GET(req: NextRequest, ctx: Context) { return crmDetail(req, ctx.params, 'contact', 'GET') }
export async function PATCH(req: NextRequest, ctx: Context) { return crmDetail(req, ctx.params, 'contact', 'PATCH') }
export async function DELETE(req: NextRequest, ctx: Context) { return crmDetail(req, ctx.params, 'contact', 'DELETE') }
