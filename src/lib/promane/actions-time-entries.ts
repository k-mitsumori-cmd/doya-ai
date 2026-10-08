"use server";

import { parsePromaneWorkDate, validatePromaneMinutes, parsePromaneExpense, validatePromaneInteger } from "./time-input";
import { createPromaneTimeEntryOnce, recoverPromaneTimeEntry, promaneTimeOperationId, isPromaneTimeReceiptConflict } from "./time-entry-creation";
import { createPromaneExpenseOnce, promaneExpenseOperationId, isPromaneExpenseReceiptConflict } from "./expense-creation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePromaneAuthAction, requireWritableWorkspace } from "@/lib/promane/auth";
import { revalidatePath } from "next/cache";

/** 数値バリデーション */
function validateAmount(v: number | undefined | null, field: string): number {
  return validatePromaneInteger(v, field);
}

async function retryTimeTransaction<T>(commit: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await commit(); }
    catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'P2034')) throw error;
      if (attempt === 2) throw new Error('同時に記録が変更されました。少し待って再度操作してください');
    }
  }
  throw new Error('記録を変更できませんでした');
}

async function retryTimeCreationTransaction<T>(commit: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await commit(); }
    catch (error) {
      if (!isPromaneTimeReceiptConflict(error)) throw error;
      if (attempt === 2) throw new Error('同時に記録が変更されました。保存状態を確認してください');
    }
  }
  throw new Error('保存状態を確認できませんでした');
}

async function retryExpenseCreationTransaction<T>(commit: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await commit(); }
    catch (error) {
      if (!isPromaneExpenseReceiptConflict(error)) throw error;
      if (attempt === 2) throw new Error('保存状態を確認できません。再登録せず保存状態を確認してください');
    }
  }
  throw new Error('保存状態を確認できませんでした');
}

async function lockWritableActor(tx: Prisma.TransactionClient, workspaceId: string, userId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM promane_members
    WHERE "workspaceId"=${workspaceId} AND "userId"=${userId} AND "isActive"=true
      AND role IN ('owner','admin','member') FOR UPDATE`;
  if (rows.length !== 1) throw new Error('ワークスペースの変更権限がありません');
}

export async function recoverTimeEntry(workspaceSlug: string, operationId: string, cancelIfMissing = false, workspaceId?: string, expectedUserId?: string) {
  const { userId } = await requirePromaneAuthAction();
  if (expectedUserId !== undefined && expectedUserId !== userId) throw new Error('ログインする利用者が変わりました。保存状態を確認してください');
  const workspace = await requireWritableWorkspace(workspaceSlug, userId, false, workspaceId);
  const id = promaneTimeOperationId(operationId);
  if (typeof cancelIfMissing !== 'boolean') throw new Error('確認方法が不正です');
  const result = await retryTimeCreationTransaction(() => prisma.$transaction(async tx => {
    await lockWritableActor(tx, workspace.id, userId);
    return recoverPromaneTimeEntry(tx, { workspaceId: workspace.id, userId }, id,
      entryId => tx.promaneTimeEntry.findFirst({ where: { id: entryId, member: { workspaceId: workspace.id } } }), cancelIfMissing);
  }, { isolationLevel: 'Serializable' }));
  // A stale action URL must not render its old route before the client follows the canonical result.
  if (result.state === 'found' && (!workspaceId || workspaceSlug === workspace.slug)) revalidatePath(`/promane/${workspaceId ? workspace.slug : workspaceSlug}/timesheet`);
  return { ...result, ...(workspaceId ? { workspaceSlug: workspace.slug } : {}) };
}

export async function createTimeEntry(workspaceSlug: string, data: {
  operationId: string; workspaceId?: string; expectedUserId?: string;
  taskId?: string;
  projectId?: string;
  memberId: string;
  duration: number; // 分
  date: string;
  note?: string;
}) {
  const { userId } = await requirePromaneAuthAction();
  if (data.expectedUserId !== undefined && data.expectedUserId !== userId) throw new Error('ログインする利用者が変わりました。保存状態を確認してください');
  const workspace = await requireWritableWorkspace(workspaceSlug, userId, false, data.workspaceId);

  const operationId = promaneTimeOperationId(data.operationId);
  if (data.note !== undefined && typeof data.note !== "string") throw new Error("メモを確認してください");
  if (data.note !== undefined && data.note.length > 1000) throw new Error("メモは1,000文字以内で入力してください");
  const duration = validatePromaneMinutes(data.duration);
  const workDate = parsePromaneWorkDate(data.date);
  if (!data.memberId) throw new Error("memberIdは必須です");

  const entry = await retryTimeCreationTransaction(() => prisma.$transaction(async tx => {
    await lockWritableActor(tx, workspace.id, userId);
    const scope = { workspaceId: workspace.id, userId };
    const input = { memberId: data.memberId, duration, date: workDate.toISOString(),
      projectId: data.projectId || null, taskId: data.taskId || null, note: data.note || null };
    return createPromaneTimeEntryOnce(tx, scope, operationId, input,
      id => tx.promaneTimeEntry.findFirst({ where: { id, member: { workspaceId: workspace.id } } }),
      async () => {
        const member = await tx.promaneMember.findFirst({
          where: { id: data.memberId, workspaceId: workspace.id, isActive: true },
          select: { id: true, hourlyRate: true },
        });
        if (!member) throw new Error("メンバーが見つかりません");

        let projectId = data.projectId || null;
        if (projectId) {
          const project = await tx.promaneProject.findFirst({
            where: { id: projectId, workspaceId: workspace.id }, select: { id: true },
          });
          if (!project) throw new Error("プロジェクトが見つかりません");
        }
        if (data.taskId) {
          const task = await tx.promaneTask.findFirst({
            where: { id: data.taskId, project: { workspaceId: workspace.id } },
            select: { id: true, projectId: true },
          });
          if (!task) throw new Error("タスクが見つかりません");
          if (projectId && task.projectId !== projectId) throw new Error("選択したプロジェクトのタスクを指定してください");
          projectId = task.projectId;
        }
        return tx.promaneTimeEntry.create({
          data: {
            taskId: data.taskId || null,
            projectId,
            memberId: data.memberId,
            duration,
            hourlyRateSnapshot: member.hourlyRate,
            date: workDate,
            note: data.note || null,
          },
        });
      });
  }, { isolationLevel: 'Serializable' }));

  if (!data.workspaceId || workspaceSlug === workspace.slug) revalidatePath(`/promane/${data.workspaceId ? workspace.slug : workspaceSlug}/timesheet`);
  return { ...entry, ...(data.workspaceId ? { workspaceSlug: workspace.slug } : {}) };
}

export async function deleteTimeEntry(workspaceSlug: string, entryId: string) {
  const { userId } = await requirePromaneAuthAction();
  const workspace = await requireWritableWorkspace(workspaceSlug, userId);

  await retryTimeTransaction(() => prisma.$transaction(async tx => {
    const actor = await tx.promaneMember.findFirst({
      where: { workspaceId: workspace.id, userId, isActive: true, role: { in: ['owner', 'admin', 'member'] } },
      select: { id: true },
    });
    if (!actor) throw new Error('ワークスペースの変更権限がありません');
    const deleted = await tx.promaneTimeEntry.deleteMany({
      where: { id: entryId, member: { workspaceId: workspace.id } },
    });
    if (deleted.count !== 1) throw new Error('時間記録が見つかりません');
  }, { isolationLevel: 'Serializable' }));
  revalidatePath(`/promane/${workspaceSlug}/timesheet`);
}

export async function createExpense(workspaceSlug: string, data: {
  operationId: string;
  projectId: string;
  category: string;
  amount: number;
  description: string;
  date: string;
}) {
  const { userId } = await requirePromaneAuthAction();
  const workspace = await requireWritableWorkspace(workspaceSlug, userId);

  const operationId = promaneExpenseOperationId(data.operationId);
  const validated = parsePromaneExpense(data);

  const expense = await retryExpenseCreationTransaction(() => prisma.$transaction(async tx => {
    await lockWritableActor(tx, workspace.id, userId);
    const project = await tx.promaneProject.findFirst({
      where: { id: data.projectId, workspaceId: workspace.id },
      select: { id: true },
    });
    if (!project) throw new Error("プロジェクトが見つかりません");
    return createPromaneExpenseOnce(tx, { workspaceId: workspace.id, userId }, operationId, validated,
      id => tx.promaneExpense.findFirst({ where: { id, projectId: validated.projectId, project: { workspaceId: workspace.id } } }),
      () => tx.promaneExpense.create({ data: validated }));
  }, { isolationLevel: 'Serializable' }));

  revalidatePath(`/promane/${workspaceSlug}/projects/${data.projectId}`);
  return expense;
}

export async function deleteExpense(workspaceSlug: string, expenseId: string, projectId: string) {
  const { userId } = await requirePromaneAuthAction();
  const workspace = await requireWritableWorkspace(workspaceSlug, userId);

  const actualProjectId = await retryTimeTransaction(() => prisma.$transaction(async tx => {
    const actor = await tx.promaneMember.findFirst({
      where: { workspaceId: workspace.id, userId, isActive: true, role: { in: ['owner', 'admin', 'member'] } },
      select: { id: true },
    });
    if (!actor) throw new Error('ワークスペースの変更権限がありません');
    const existing = await tx.promaneExpense.findFirst({
      where: { id: expenseId, project: { workspaceId: workspace.id } },
      select: { projectId: true },
    });
    if (!existing) throw new Error('経費が見つかりません');
    if (existing.projectId !== projectId) throw new Error('対象のプロジェクトが一致しません');
    const deleted = await tx.promaneExpense.deleteMany({
      where: { id: expenseId, projectId: existing.projectId, project: { workspaceId: workspace.id } },
    });
    if (deleted.count !== 1) throw new Error('経費が見つかりません');
    return existing.projectId;
  }, { isolationLevel: 'Serializable' }));
  revalidatePath(`/promane/${workspaceSlug}/projects/${actualProjectId}`);
}

export async function updateMemberRate(workspaceSlug: string, memberId: string, hourlyRate: number) {
  const { userId } = await requirePromaneAuthAction();
  const workspace = await requireWritableWorkspace(workspaceSlug, userId);

  const rate = validateAmount(hourlyRate, "時給");
  await retryTimeTransaction(() => prisma.$transaction(async tx => {
    const actor = await tx.promaneMember.findFirst({
      where: { workspaceId: workspace.id, userId, isActive: true, role: { in: ['owner', 'admin'] } },
      select: { id: true },
    });
    if (!actor) throw new Error("時給を変更する権限がありません（owner/admin のみ）");
    const updated = await tx.promaneMember.updateMany({
      where: { id: memberId, workspaceId: workspace.id },
      data: { hourlyRate: rate },
    });
    if (updated.count !== 1) throw new Error("メンバーが見つかりません");
  }, { isolationLevel: 'Serializable' }));

  revalidatePath(`/promane/${workspaceSlug}/members`);
}
