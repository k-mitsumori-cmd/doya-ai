"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { requirePromaneAuthAction, requireWritableWorkspace } from "@/lib/promane/auth";
import { revalidatePath } from "next/cache";
import { parsePromaneWorkDate } from "./time-input";

import { createPromaneTaskOnce, recoverPromaneTask, promaneTaskOperationId, isPromaneTaskReceiptConflict } from './task-creation';
import { parsePromaneTaskCreate } from './task-input';

async function lockTaskWriter(tx: Prisma.TransactionClient, workspaceId: string, userId: string) {
  const actors = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM promane_members
    WHERE "workspaceId"=${workspaceId} AND "userId"=${userId} AND "isActive"=true
      AND role IN ('owner','admin','member') FOR UPDATE`;
  if (actors.length !== 1) throw new Error('ワークスペースの変更権限がありません');
}
async function retryTaskCreation<T>(work: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await work(); }
    catch (error) { if (!isPromaneTaskReceiptConflict(error) || attempt === 2) throw error; }
  }
  throw new Error('保存状態を確認できません');
}

const TASK_STATUSES = ["todo", "in_progress", "review", "done"];
const TASK_PRIORITIES = ["low", "medium", "high", "urgent"];

function validateTaskFields(status?: string, priority?: string, order?: number) {
  if (status !== undefined && !TASK_STATUSES.includes(status)) {
    throw new Error("タスクの状態が不正です");
  }
  if (priority !== undefined && !TASK_PRIORITIES.includes(priority)) {
    throw new Error("タスクの優先度が不正です");
  }
  if (order !== undefined && (!Number.isSafeInteger(order) || order < 0)) {
    throw new Error("タスクの並び順が不正です");
  }
}

function validateTaskText(data: { title?: unknown; description?: unknown }, requireTitle = false) {
  if (requireTitle || data.title !== undefined) {
    if (typeof data.title !== "string" || !data.title.trim()) throw new Error("タスク名は必須です");
    if (data.title.trim().length > 200) throw new Error("タスク名は200文字以内で入力してください");
  }
  if (data.description != null && (typeof data.description !== "string" || data.description.length > 5000)) {
    throw new Error("タスクの説明は5000文字以内で入力してください");
  }
}

async function retryTaskTransaction<T>(commit: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await commit(); }
    catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "P2034")) throw error;
      if (attempt === 2) throw new Error("同時にタスクが変更されました。少し待って再度保存してください");
    }
  }
  throw new Error("タスクを保存できませんでした");
}

async function requireCurrentTaskWriter(tx: Prisma.TransactionClient, workspaceId: string, userId: string) {
  const actor = await tx.promaneMember.findFirst({
    where: { workspaceId, userId, isActive: true, role: { in: ["owner", "admin", "member"] } },
    select: { id: true },
  });
  if (!actor) throw new Error("ワークスペースの変更権限がありません");
}

/**
 * 日付バリデーション: startDate <= dueDate を保証
 * 不正な場合は例外をthrow（フロントでcatch→エラー表示）
 */
function validateDates(
  startDate?: string | Date | null,
  dueDate?: string | Date | null
): { startDate: Date | null; dueDate: Date | null } {
  const start = startDate == null || startDate === "" ? null : startDate instanceof Date ? startDate : parsePromaneWorkDate(startDate);
  const end = dueDate == null || dueDate === "" ? null : dueDate instanceof Date ? dueDate : parsePromaneWorkDate(dueDate);
  if (start && isNaN(start.getTime())) throw new Error("開始日の形式が不正です");
  if (end && isNaN(end.getTime())) throw new Error("終了日の形式が不正です");
  if (start && end && end < start) {
    throw new Error("終了日は開始日以降を指定してください");
  }
  return { startDate: start, dueDate: end };
}

export async function createTask(workspaceSlug: string, data: {
  operationId: string; expectedUserId: string; projectId: string; title: string;
  description?: string | null; status?: string; priority?: string;
  assigneeId?: string | null; parentId?: string | null; startDate?: string | null; dueDate?: string | null;
}) {
  const { userId } = await requirePromaneAuthAction();
  if (data.expectedUserId !== userId) throw new Error('ログインする利用者が変わりました。保存状態を確認してください');
  const workspace = await requireWritableWorkspace(workspaceSlug, userId);
  const operationId = promaneTaskOperationId(data.operationId);
  const input = parsePromaneTaskCreate(data);
  const task = await retryTaskCreation(() => prisma.$transaction(async tx => {
    await lockTaskWriter(tx, workspace.id, userId);
    const project = await tx.promaneProject.findFirst({ where: { id: input.projectId, workspaceId: workspace.id }, select: { id: true } });
    if (!project) throw new Error('プロジェクトが見つかりません');
    return createPromaneTaskOnce(tx, { workspaceId: workspace.id, userId, projectId: input.projectId }, operationId, input,
      id => tx.promaneTask.findFirst({ where: { id, projectId: input.projectId } }), async () => {
        if (input.assigneeId && !await tx.promaneMember.findFirst({ where: { id: input.assigneeId, workspaceId: workspace.id, isActive: true }, select: { id: true } })) throw new Error('担当者がワークスペースに所属していません');
        if (input.parentId && !await tx.promaneTask.findFirst({ where: { id: input.parentId, projectId: input.projectId }, select: { id: true } })) throw new Error('親タスクが同じプロジェクトに存在しません');
        const maxOrder = await tx.promaneTask.aggregate({ where: { projectId: input.projectId, status: input.status }, _max: { order: true } });
        return tx.promaneTask.create({ data: { ...input,
          startDate: input.startDate ? parsePromaneWorkDate(input.startDate) : null,
          dueDate: input.dueDate ? parsePromaneWorkDate(input.dueDate) : null,
          order: (maxOrder._max.order ?? -1) + 1 } });
      });
  }, { isolationLevel: 'Serializable' }));
  revalidatePath(`/promane/${workspaceSlug}/projects/${input.projectId}`);
  return task;
}

/** Read recovery never creates a task. Explicit cancellation fences a delayed missing operation. */
export async function recoverTaskCreation(workspaceSlug: string, projectId: string, operation: string, cancelIfMissing = false, expectedUserId = '') {
  const { userId } = await requirePromaneAuthAction();
  if (expectedUserId !== userId) throw new Error('ログインする利用者が変わりました。保存状態を確認してください');
  const workspace = await requireWritableWorkspace(workspaceSlug, userId);
  const operationId = promaneTaskOperationId(operation);
  if (typeof projectId !== 'string' || !projectId.trim() || projectId.length > 200 || typeof cancelIfMissing !== 'boolean') throw new Error('確認対象を指定してください');
  return retryTaskCreation(() => prisma.$transaction(async tx => {
    await lockTaskWriter(tx, workspace.id, userId);
    const project = await tx.promaneProject.findFirst({ where: { id: projectId, workspaceId: workspace.id }, select: { id: true } });
    if (!project) throw new Error('プロジェクトが見つかりません');
    return recoverPromaneTask(tx, { workspaceId: workspace.id, userId, projectId }, operationId,
      id => tx.promaneTask.findFirst({ where: { id, projectId } }), cancelIfMissing);
  }, { isolationLevel: 'Serializable' }));
}

export async function updateTask(workspaceSlug: string, taskId: string, data: {
  title?: string;
  description?: string | null;
  status?: string;
  priority?: string;
  assigneeId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  order?: number;
}) {
  const { userId } = await requirePromaneAuthAction();
  const workspace = await requireWritableWorkspace(workspaceSlug, userId);

  validateTaskText(data);
  validateTaskFields(data.status, data.priority, data.order);

  // Read retained dates and write in one serializable transaction. Otherwise
  // two partial updates can each validate against an obsolete opposite date.
  let task: Awaited<ReturnType<typeof prisma.promaneTask.update>> | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      task = await prisma.$transaction(async tx => {
        await requireCurrentTaskWriter(tx, workspace.id, userId);
        const existing = await tx.promaneTask.findFirst({
          where: { id: taskId, project: { workspaceId: workspace.id } },
          select: { startDate: true, dueDate: true, projectId: true },
        });
        if (!existing) throw new Error("タスクが見つかりません");
        if (data.assigneeId) {
          const member = await tx.promaneMember.findFirst({
            where: { id: data.assigneeId, workspaceId: workspace.id, isActive: true }, select: { id: true },
          });
          if (!member) throw new Error("担当者がワークスペースに所属していません");
        }
        const dates = data.startDate !== undefined || data.dueDate !== undefined
          ? validateDates(data.startDate !== undefined ? data.startDate : existing.startDate,
            data.dueDate !== undefined ? data.dueDate : existing.dueDate)
          : null;
        return tx.promaneTask.update({
          where: { id: taskId },
          data: {
            ...(data.title !== undefined && { title: data.title.trim() }),
            ...(data.description !== undefined && { description: data.description || null }),
            ...(data.status !== undefined && { status: data.status }),
            ...(data.priority !== undefined && { priority: data.priority }),
            ...(data.assigneeId !== undefined && { assigneeId: data.assigneeId }),
            ...(data.startDate !== undefined && { startDate: dates!.startDate }),
            ...(data.dueDate !== undefined && { dueDate: dates!.dueDate }),
            ...(data.order !== undefined && { order: data.order }),
          },
        });
      }, { isolationLevel: "Serializable" });
      break;
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "P2034")) throw error;
      if (attempt === 2) throw new Error("同時にタスクが変更されました。少し待って再度保存してください");
    }
  }
  if (!task) throw new Error("タスクを保存できませんでした");

  revalidatePath(`/promane/${workspaceSlug}/projects/${task.projectId}`);
  return task;
}

export async function deleteTask(workspaceSlug: string, taskId: string) {
  const { userId } = await requirePromaneAuthAction();
  const workspace = await requireWritableWorkspace(workspaceSlug, userId);

  const projectId = await retryTaskTransaction(() => prisma.$transaction(async tx => {
    await requireCurrentTaskWriter(tx, workspace.id, userId);
    const existing = await tx.promaneTask.findFirst({
      where: { id: taskId, project: { workspaceId: workspace.id } },
      select: { id: true, projectId: true },
    });
    if (!existing) throw new Error("タスクが見つかりません");
    await tx.promaneTask.delete({ where: { id: taskId } });
    return existing.projectId;
  }, { isolationLevel: "Serializable" }));
  revalidatePath(`/promane/${workspaceSlug}/projects/${projectId}`);
}

export async function moveTask(workspaceSlug: string, taskId: string, newStatus: string, newOrder: number) {
  const { userId } = await requirePromaneAuthAction();
  const workspace = await requireWritableWorkspace(workspaceSlug, userId);
  validateTaskFields(newStatus, undefined, newOrder);

  const task = await retryTaskTransaction(() => prisma.$transaction(async tx => {
    await requireCurrentTaskWriter(tx, workspace.id, userId);
    const existing = await tx.promaneTask.findFirst({
      where: { id: taskId, project: { workspaceId: workspace.id } },
      select: { id: true },
    });
    if (!existing) throw new Error("タスクが見つかりません");
    return tx.promaneTask.update({
      where: { id: taskId }, data: { status: newStatus, order: newOrder },
    });
  }, { isolationLevel: "Serializable" }));

  revalidatePath(`/promane/${workspaceSlug}/projects/${task.projectId}`);
  return task;
}

/**
 * 既存の不正データ修復ユーティリティ
 * dueDate < startDate のタスクの dueDate を null に修復
 */
export async function repairInvalidTaskDates(workspaceSlug: string): Promise<{ repaired: number }> {
  const { userId } = await requirePromaneAuthAction();
  const workspace = await requireWritableWorkspace(workspaceSlug, userId, true);
  const repaired = await retryTaskTransaction(() => prisma.$transaction(async tx => {
    const member = await tx.promaneMember.findFirst({
      where: { workspaceId: workspace.id, userId, isActive: true, role: { in: ["owner", "admin"] } },
      select: { id: true },
    });
    if (!member) throw new Error("データ修復はオーナー・管理者のみ実行できます");
    const tasks = await tx.promaneTask.findMany({
      where: {
        project: { workspaceId: workspace.id },
        startDate: { not: null },
        dueDate: { not: null },
      },
      select: { id: true, startDate: true, dueDate: true },
    });
    let count = 0;
    for (const task of tasks) {
      if (!task.startDate || !task.dueDate || task.dueDate >= task.startDate) continue;
      const updated = await tx.promaneTask.updateMany({
        where: {
          id: task.id,
          project: { workspaceId: workspace.id },
          startDate: task.startDate,
          dueDate: task.dueDate,
        },
        data: { dueDate: null },
      });
      count += updated.count;
    }
    return count;
  }, { isolationLevel: "Serializable", timeout: 20_000 }));
  revalidatePath(`/promane/${workspaceSlug}`);
  return { repaired };
}
