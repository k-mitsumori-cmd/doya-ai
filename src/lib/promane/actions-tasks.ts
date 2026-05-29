"use server";

import { prisma } from "@/lib/prisma";
import { requirePromaneAuth, getWorkspaceBySlug } from "@/lib/promane/auth";
import { revalidatePath } from "next/cache";

/**
 * 日付バリデーション: startDate <= dueDate を保証
 * 不正な場合は例外をthrow（フロントでcatch→エラー表示）
 */
function validateDates(
  startDate?: string | Date | null,
  dueDate?: string | Date | null
): { startDate: Date | null; dueDate: Date | null } {
  const start = startDate ? (startDate instanceof Date ? startDate : new Date(startDate)) : null;
  const end = dueDate ? (dueDate instanceof Date ? dueDate : new Date(dueDate)) : null;
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
  const session = await requirePromaneAuth();
  const workspace = await getWorkspaceBySlug(workspaceSlug, session.user!.id!);
  if (!workspace) throw new Error("Workspace not found");

  if (!data.title?.trim()) throw new Error("タスク名は必須です");

  // 日付バリデーション
  const { startDate, dueDate } = validateDates(data.startDate, data.dueDate);

  const maxOrder = await prisma.promaneTask.aggregate({
    where: { projectId: data.projectId, status: data.status || "todo" },
    _max: { order: true },
  });

  const task = await prisma.promaneTask.create({
    data: {
      projectId: data.projectId,
      title: data.title.trim().slice(0, 200),
      description: data.description?.slice(0, 5000) || null,
      status: data.status || "todo",
      priority: data.priority || "medium",
      assigneeId: data.assigneeId || null,
      parentId: data.parentId || null,
      startDate,
      dueDate,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

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
  const session = await requirePromaneAuth();
  const workspace = await getWorkspaceBySlug(workspaceSlug, session.user!.id!);
  if (!workspace) throw new Error("Workspace not found");

  // 既存タスク取得（順序チェックの基準値に必要）
  const existing = await prisma.promaneTask.findUnique({
    where: { id: taskId },
    select: { startDate: true, dueDate: true, projectId: true },
  });
  if (!existing) throw new Error("タスクが見つかりません");

  // 部分更新で日付の整合性を保証
  if (data.startDate !== undefined || data.dueDate !== undefined) {
    const finalStart = data.startDate !== undefined ? data.startDate : existing.startDate;
    const finalEnd = data.dueDate !== undefined ? data.dueDate : existing.dueDate;
    validateDates(finalStart, finalEnd);
  }

  if (data.title !== undefined && !data.title.trim()) {
    throw new Error("タスク名は空にできません");
  }

  const task = await prisma.promaneTask.update({
    where: { id: taskId },
    data: {
      ...(data.title !== undefined && { title: data.title.trim().slice(0, 200) }),
      ...(data.description !== undefined && { description: data.description?.slice(0, 5000) || null }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.priority !== undefined && { priority: data.priority }),
      ...(data.assigneeId !== undefined && { assigneeId: data.assigneeId }),
      ...(data.startDate !== undefined && { startDate: data.startDate ? new Date(data.startDate) : null }),
      ...(data.dueDate !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
      ...(data.order !== undefined && { order: data.order }),
    },
  });

  revalidatePath(`/promane/${workspaceSlug}/projects/${task.projectId}`);
  return task;
}

export async function deleteTask(workspaceSlug: string, taskId: string) {
  const session = await requirePromaneAuth();
  const workspace = await getWorkspaceBySlug(workspaceSlug, session.user!.id!);
  if (!workspace) throw new Error("Workspace not found");

  const task = await prisma.promaneTask.delete({ where: { id: taskId } });
  revalidatePath(`/promane/${workspaceSlug}/projects/${task.projectId}`);
}

export async function moveTask(workspaceSlug: string, taskId: string, newStatus: string, newOrder: number) {
  const session = await requirePromaneAuth();
  const workspace = await getWorkspaceBySlug(workspaceSlug, session.user!.id!);
  if (!workspace) throw new Error("Workspace not found");

  const task = await prisma.promaneTask.update({
    where: { id: taskId },
    data: { status: newStatus, order: newOrder },
  });

  revalidatePath(`/promane/${workspaceSlug}/projects/${task.projectId}`);
  return task;
}

/**
 * 既存の不正データ修復ユーティリティ
 * dueDate < startDate のタスクの dueDate を null に修復
 */
export async function repairInvalidTaskDates(workspaceSlug: string): Promise<{ repaired: number }> {
  const session = await requirePromaneAuth();
  const workspace = await getWorkspaceBySlug(workspaceSlug, session.user!.id!);
  if (!workspace) throw new Error("Workspace not found");

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
