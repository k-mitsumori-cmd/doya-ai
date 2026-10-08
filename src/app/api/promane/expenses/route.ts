import type { Prisma } from '@prisma/client'
import { createPromaneExpenseOnce, recoverPromaneExpense, promaneExpenseOperationId, isPromaneExpenseReceiptConflict, PromaneExpenseCreationError } from '@/lib/promane/expense-creation'
import { parsePromaneExpense, PromaneExpenseInputError } from '@/lib/promane/time-input'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function retryExpenseTransaction<T>(commit: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await commit() }
    catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'P2034')) throw error
      if (attempt === 2) throw new Error('同時に経費が変更されました')
    }
  }
  throw new Error('経費を保存できませんでした')
}

class ExpenseAccessError extends Error { constructor(readonly status: number, message: string) { super(message) } }

async function scopedOperation<T>(workspaceSlug: string, projectId: string, userId: string,
  work: (tx: Prisma.TransactionClient, workspaceId: string) => Promise<T>, workspaceId?: string): Promise<T & { workspaceSlug?: string }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        const workspace = await tx.promaneWorkspace.findFirst({
          where: { ...(workspaceId === undefined ? { slug: workspaceSlug } : { id: workspaceId }), members: { some: { userId, isActive: true, role: { in: ['owner','admin','member'] } } } }, select: { id: true, slug: true },
        });
        if (!workspace) throw new ExpenseAccessError(403, 'ワークスペースにアクセスできません');
        const actors = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM promane_members
          WHERE "workspaceId"=${workspace.id} AND "userId"=${userId} AND "isActive"=true
            AND role IN ('owner','admin','member') FOR UPDATE`;
        if (actors.length !== 1) throw new ExpenseAccessError(403, 'ワークスペースの変更権限がありません');
        const project = await tx.promaneProject.findFirst({ where: { id: projectId, workspaceId: workspace.id }, select: { id: true } });
        if (!project) throw new ExpenseAccessError(404, 'プロジェクトが見つかりません');
        const result = await work(tx, workspace.id);
        return { ...result, ...(workspaceId ? { workspaceSlug: workspace.slug } : {}) };
      }, { isolationLevel: 'Serializable' });
    } catch (error) { if (!isPromaneExpenseReceiptConflict(error) || attempt === 2) throw error; }
  }
  throw new Error('保存状態を確認できません');
}
function validSelector(value: unknown): value is string { return typeof value === 'string' && !!value.trim() && value.length <= 200; }
function operationFailure(error: unknown) {
  if (error instanceof ExpenseAccessError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }
  if (error instanceof PromaneExpenseInputError) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 },
    );
  }
  if (error instanceof PromaneExpenseCreationError) {
    return NextResponse.json(
      { error: error.message },
      { status: 409 },
    );
  }
  console.error('[promane/expenses] operation failed');
  return NextResponse.json({ error: '保存状態を確認できません。再登録せず、保存状態を確認してください。' }, { status: 500 });
}

/** POST creates one operation, or fences an explicitly cancelled missing operation. */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions), userId = (session?.user as any)?.id as string | undefined;
    if (!userId) return NextResponse.json({ error: 'ログインセッションが切れています' }, { status: 401 });
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: '経費の入力を確認してください' }, { status: 400 });
    const { workspaceSlug, projectId, action, workspaceId, expectedUserId } = body;
    if (!validSelector(workspaceSlug) || !validSelector(projectId) || (action !== undefined && action !== 'cancel')) return NextResponse.json({ error: '送信情報を確認してください' }, { status: 400 });
    if (workspaceId !== undefined && !validSelector(workspaceId)) return NextResponse.json({ error: 'ワークスペースを確認してください' }, { status: 400 });
    if (expectedUserId !== undefined && expectedUserId !== userId) return NextResponse.json({ error: 'ログインする利用者が変わりました', code: 'AUTH_CONTEXT_CHANGED' }, { status: 409 });
    let operationId: string;
    try { operationId = promaneExpenseOperationId(body.operationId); }
    catch { return NextResponse.json({ error: '送信情報を確認してください' }, { status: 400 }); }
    if (action === 'cancel') {
      const result = await scopedOperation(workspaceSlug, projectId, userId, (tx, workspaceId) =>
        recoverPromaneExpense(tx, { workspaceId, userId }, operationId,
          id => tx.promaneExpense.findFirst({ where: { id, projectId, project: { workspaceId } } }), true), workspaceId);
      return NextResponse.json(result);
    }
    const validated = parsePromaneExpense(body);
    const expense = await scopedOperation(workspaceSlug, projectId, userId, (tx, workspaceId) =>
      createPromaneExpenseOnce(tx, { workspaceId, userId }, operationId, validated,
        id => tx.promaneExpense.findFirst({ where: { id, projectId, project: { workspaceId } } }),
        () => tx.promaneExpense.create({ data: validated })), workspaceId);
    return NextResponse.json({ success: true, expense });
  } catch (error) { return operationFailure(error); }
}

/** GET recovers only the caller's operation within the requested workspace and project. */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions), userId = (session?.user as any)?.id as string | undefined;
    if (!userId) return NextResponse.json({ error: 'ログインセッションが切れています' }, { status: 401 });
    const query = req.nextUrl.searchParams;
    if (['workspaceSlug','projectId','operationId'].some(key => query.getAll(key).length !== 1)) return NextResponse.json({ error: '確認対象を指定してください' }, { status: 400 });
    const workspaceSlug = query.get('workspaceSlug'), projectId = query.get('projectId');
    if (!validSelector(workspaceSlug) || !validSelector(projectId)) return NextResponse.json({ error: '確認対象を指定してください' }, { status: 400 });
    const workspaceId = query.get('workspaceId') ?? undefined, expectedUserId = query.get('expectedUserId') ?? undefined;
    if (query.getAll('workspaceId').length > 1 || query.getAll('expectedUserId').length > 1 || (workspaceId !== undefined && !validSelector(workspaceId))) return NextResponse.json({ error: '確認対象を指定してください' }, { status: 400 });
    if (expectedUserId !== undefined && expectedUserId !== userId) return NextResponse.json({ error: 'ログインする利用者が変わりました', code: 'AUTH_CONTEXT_CHANGED' }, { status: 409 });
    let operationId: string;
    try { operationId = promaneExpenseOperationId(query.get('operationId')); }
    catch { return NextResponse.json({ error: '送信情報を確認してください' }, { status: 400 }); }
    const result = await scopedOperation(workspaceSlug, projectId, userId, (tx, workspaceId) =>
      recoverPromaneExpense(tx, { workspaceId, userId }, operationId,
        id => tx.promaneExpense.findFirst({ where: { id, projectId, project: { workspaceId } } })), workspaceId);
    return NextResponse.json(result);
  } catch (error) { return operationFailure(error); }
}

/**
 * DELETE /api/promane/expenses?workspaceSlug=...&id=...&projectId=...
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) return NextResponse.json({ error: 'ログインセッションが切れています' }, { status: 401 })

    const workspaceSlug = req.nextUrl.searchParams.get('workspaceSlug')
    const id = req.nextUrl.searchParams.get('id')
    if (!workspaceSlug || !id) return NextResponse.json({ error: 'workspaceSlug と id は必須' }, { status: 400 })

    const result = await retryExpenseTransaction(() => prisma.$transaction(async tx => {
      const workspace = await tx.promaneWorkspace.findFirst({
        where: { slug: workspaceSlug, members: { some: { userId, isActive: true, role: { in: ['owner', 'admin', 'member'] } } } },
        select: { id: true },
      })
      if (!workspace) return { status: 403 as const, error: 'アクセス権なし' }
      const deleted = await tx.promaneExpense.deleteMany({
        where: { id, project: { workspaceId: workspace.id } },
      })
      if (deleted.count !== 1) return { status: 404 as const, error: '経費が見つかりません' }
      return { status: 200 as const }
    }, { isolationLevel: 'Serializable' }))
    if (result.status !== 200) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[promane/expenses][DELETE] failed')
    return NextResponse.json({ error: '削除に失敗しました。時間をおいて再試行してください。' }, { status: 500 })
  }
}
