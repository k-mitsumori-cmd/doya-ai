"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { requirePromaneAuthAction, requireWritableWorkspace } from "@/lib/promane/auth";
import { revalidatePath } from "next/cache";
import { parsePromaneWorkDate } from "./time-input";

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
  projectId: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  assigneeId?: string;
  parentId?: string;
  startDate?: string;
  dueDate?: string;
}) {
  const { userId } = await requirePromaneAuthAction();
  const workspace = await requireWritableWorkspace(workspaceSlug, userId);

  validateTaskText(data, true);
  if (!data.projectId) throw new Error("projectId は必須です");
  validateTaskFields(data.status, data.priority);

  const { startDate, dueDate } = validateDates(data.startDate, data.dueDate);
  const task = await retryTaskTransaction(() => prisma.$transaction(async tx => {
    await requireCurrentTaskWriter(tx, workspace.id, userId);
    const project = await tx.promaneProject.findFirst({
      where: { id: data.projectId, workspaceId: workspace.id }, select: { id: true },
    });
    if (!project) throw new Error("プロジェクトが見つかりません");
    if (data.assigneeId) {
      const member = await tx.promaneMember.findFirst({
        where: { id: data.assigneeId, workspaceId: workspace.id, isActive: true }, select: { id: true },
      });
      if (!member) throw new Error("担当者がワークスペースに所属していません");
    }
    if (data.parentId) {
      const parent = await tx.promaneTask.findFirst({
        where: { id: data.parentId, projectId: data.projectId }, select: { id: true },
      });
      if (!parent) throw new Error("親タスクが同じプロジェクトに存在しません");
    }
    const maxOrder = await tx.promaneTask.aggregate({
      where: { projectId: data.projectId, status: data.status || "todo" },
      _max: { order: true },
    });
    return tx.promaneTask.create({
      data: {
        projectId: data.projectId,
        title: data.title.trim(),
        description: data.description || null,
        status: data.status || "todo",
        priority: data.priority || "medium",
        assigneeId: data.assigneeId || null,
        parentId: data.parentId || null,
        startDate,
        dueDate,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });
  }, { isolationLevel: "Serializable" }));

  revalidatePath(`/promane/${workspaceSlug}/projects/${data.projectId}`);
  return task;
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

  const tasks = await prisma.promaneTask.findMany({
    where: {
      project: { workspaceId: workspace.id },
      startDate: { not: null },
      dueDate: { not: null },
    },
    select: { id: true, startDate: true, dueDate: true },
  });

  const broken = tasks.filter((t) => t.startDate && t.dueDate && t.dueDate < t.startDate);
  if (broken.length === 0) return { repaired: 0 };

  await prisma.$transaction(
    broken.map((t) =>
      prisma.promaneTask.update({
        where: { id: t.id },
        data: { dueDate: null }, // 不正な dueDate を null に
      })
    )
  );

  revalidatePath(`/promane/${workspaceSlug}`);
  return { repaired: broken.length };
}
