import { privateApiJson } from '@/lib/private-api-response'
import type { Prisma } from '@prisma/client'
import { createPromaneClientOnce, recoverPromaneClient, promaneClientOperationId, isPromaneClientReceiptConflict, PromaneClientCreationError } from '@/lib/promane/client-creation'
import { parsePromaneClientCreate, PromaneClientInputError } from '@/lib/promane/client-input'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ceilToolRole } from '@/lib/company-roles/access.server'

async function retryClientTransaction<T>(commit: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await commit() }
    catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'P2034')) throw error
      if (attempt === 2) throw new Error('同時に顧客が変更されました')
    }
  }
  throw new Error('顧客を保存できませんでした')
}

class ClientAccessError extends Error { constructor(readonly status: number, message: string) { super(message) } }

async function scopedOperation<T>(workspaceSlug: string, userId: string,
  work: (tx: Prisma.TransactionClient, workspaceId: string) => Promise<T>, workspaceId?: string): Promise<T & { workspaceSlug?: string }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        const workspace = await tx.promaneWorkspace.findFirst({
          where: { ...(workspaceId === undefined ? { slug: workspaceSlug } : { id: workspaceId }), members: { some: { userId, isActive: true, role: { in: ['owner','admin','member'] } } } }, select: { id: true, slug: true },
        });
        if (!workspace) throw new ClientAccessError(403, 'ワークスペースにアクセスできません');
        const actors = await tx.$queryRaw<{ id: string; role: string }[]>`SELECT id, role FROM promane_members
          WHERE "workspaceId"=${workspace.id} AND "userId"=${userId} AND "isActive"=true
            AND role IN ('owner','admin','member') FOR UPDATE`;
        // 会社の役割の旗の内側では、会社の上限を当てる（会社のゲストはプロマネの guest になり、書き込めない。監査 2026-10-26 中2）
        const ceiled = actors.length === 1 ? await ceilToolRole({ tool: 'promane', userId, organizationId: workspace.id, toolRole: actors[0].role }) : null;
        if (!ceiled || !['owner', 'admin', 'member'].includes(ceiled)) throw new ClientAccessError(403, 'ワークスペースの変更権限がありません');
        if (actors.length !== 1) throw new ClientAccessError(403, 'ワークスペースの変更権限がありません');
        const result = await work(tx, workspace.id);
        return { ...result, ...(workspaceId ? { workspaceSlug: workspace.slug } : {}) };
      }, { isolationLevel: 'Serializable' });
    } catch (error) { if (!isPromaneClientReceiptConflict(error) || attempt === 2) throw error; }
  }
  throw new Error('保存状態を確認できません');
}
function validSelector(value: unknown): value is string { return typeof value === 'string' && !!value.trim() && value.length <= 200; }
function operationFailure(error: unknown) {
  if (error instanceof ClientAccessError) {
    return privateApiJson(
      { error: error.message },
      { status: error.status },
    );
  }
  if (error instanceof PromaneClientInputError) {
    return privateApiJson(
      { error: error.message },
      { status: 400 },
    );
  }
  if (error instanceof PromaneClientCreationError) {
    return privateApiJson(
      { error: error.message },
      { status: 409 },
    );
  }
  console.error('[promane/clients] operation failed');
  return privateApiJson({ error: '保存状態を確認できません。再登録せず、保存状態を確認してください。' }, { status: 500 });
}

/** POST creates one operation, or fences an explicitly cancelled missing operation. */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions), userId = (session?.user as any)?.id as string | undefined;
    if (!userId) return privateApiJson({ error: 'ログインセッションが切れています' }, { status: 401 });
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return privateApiJson({ error: '顧客の入力を確認してください' }, { status: 400 });
    const { workspaceSlug, action, workspaceId, expectedUserId } = body;
    if (!validSelector(workspaceSlug) || (action !== undefined && action !== 'cancel')) return privateApiJson({ error: '送信情報を確認してください' }, { status: 400 });
    if (workspaceId !== undefined && !validSelector(workspaceId)) return privateApiJson({ error: 'ワークスペースを確認してください' }, { status: 400 });
    if (expectedUserId !== undefined && expectedUserId !== userId) return privateApiJson({ error: 'ログインする利用者が変わりました', code: 'AUTH_CONTEXT_CHANGED' }, { status: 409 });
    let operationId: string;
    try { operationId = promaneClientOperationId(body.operationId); }
    catch { return privateApiJson({ error: '送信情報を確認してください' }, { status: 400 }); }
    if (action === 'cancel') {
      const result = await scopedOperation(workspaceSlug, userId, (tx, workspaceId) =>
        recoverPromaneClient(tx, { workspaceId, userId }, operationId,
          id => tx.promaneClient.findFirst({ where: { id, workspaceId } }), true), workspaceId);
      return privateApiJson(result);
    }
    const validated = parsePromaneClientCreate(body);
    const client = await scopedOperation(workspaceSlug, userId, (tx, workspaceId) =>
      createPromaneClientOnce(tx, { workspaceId, userId }, operationId, validated,
        id => tx.promaneClient.findFirst({ where: { id, workspaceId } }),
        () => tx.promaneClient.create({ data: { ...validated, workspaceId } })), workspaceId);
    return privateApiJson({ success: true, client });
  } catch (error) { return operationFailure(error); }
}

/** GET recovers only the caller's operation within the requested workspace. */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions), userId = (session?.user as any)?.id as string | undefined;
    if (!userId) return privateApiJson({ error: 'ログインセッションが切れています' }, { status: 401 });
    const query = req.nextUrl.searchParams;
    if (['workspaceSlug','operationId'].some(key => query.getAll(key).length !== 1)) return privateApiJson({ error: '確認対象を指定してください' }, { status: 400 });
    const workspaceSlug = query.get('workspaceSlug');
    if (!validSelector(workspaceSlug)) return privateApiJson({ error: '確認対象を指定してください' }, { status: 400 });
    const workspaceId = query.get('workspaceId') ?? undefined, expectedUserId = query.get('expectedUserId') ?? undefined;
    if (query.getAll('workspaceId').length > 1 || query.getAll('expectedUserId').length > 1 || (workspaceId !== undefined && !validSelector(workspaceId))) return privateApiJson({ error: '確認対象を指定してください' }, { status: 400 });
    if (expectedUserId !== undefined && expectedUserId !== userId) return privateApiJson({ error: 'ログインする利用者が変わりました', code: 'AUTH_CONTEXT_CHANGED' }, { status: 409 });
    let operationId: string;
    try { operationId = promaneClientOperationId(query.get('operationId')); }
    catch { return privateApiJson({ error: '送信情報を確認してください' }, { status: 400 }); }
    const result = await scopedOperation(workspaceSlug, userId, (tx, workspaceId) =>
      recoverPromaneClient(tx, { workspaceId, userId }, operationId,
        id => tx.promaneClient.findFirst({ where: { id, workspaceId } })), workspaceId);
    return privateApiJson(result);
  } catch (error) { return operationFailure(error); }
}

/** DELETE preserves existing workspace-scoped removal and project-link behavior. */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return privateApiJson({ error: 'ログインセッションが切れています' }, { status: 401 })
    }

    const workspaceSlug = req.nextUrl.searchParams.get('workspaceSlug')
    const id = req.nextUrl.searchParams.get('id')
    if (!workspaceSlug || !id) {
      return privateApiJson({ error: 'workspaceSlug と id は必須です' }, { status: 400 })
    }

    const result = await retryClientTransaction(() => prisma.$transaction(async tx => {
      const workspace = await tx.promaneWorkspace.findFirst({
        where: { slug: workspaceSlug, members: { some: { userId, isActive: true, role: { in: ['owner', 'admin', 'member'] } } } },
        select: { id: true, members: { where: { userId, isActive: true }, select: { role: true } } },
      })
      if (!workspace) return { status: 403 as const, error: 'ワークスペースにアクセスできません' }
      // 会社の役割の旗の内側では、会社の上限を当てる（会社のゲストは消せない）
      const ceiled = workspace.members.length === 1 ? await ceilToolRole({ tool: 'promane', userId, organizationId: workspace.id, toolRole: workspace.members[0].role }) : null
      if (!ceiled || !['owner', 'admin', 'member'].includes(ceiled)) return { status: 403 as const, error: 'ワークスペースの変更権限がありません' }
      const deleted = await tx.promaneClient.deleteMany({ where: { id, workspaceId: workspace.id } })
      if (deleted.count !== 1) return { status: 404 as const, error: '顧客が見つかりません' }
      return { status: 200 as const }
    }, { isolationLevel: 'Serializable' }))
    if (result.status !== 200) return privateApiJson({ error: result.error }, { status: result.status })
    return privateApiJson({ success: true })
  } catch (e: any) {
    console.error('[promane/clients][DELETE]')
    return privateApiJson(
      { error: '削除に失敗しました' },
      { status: 500 }
    )
  }
}
