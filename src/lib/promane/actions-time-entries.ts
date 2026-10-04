"use server";

import { parsePromaneWorkDate, validatePromaneMinutes, parsePromaneExpense, validatePromaneInteger } from "./time-input";
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

export async function createTimeEntry(workspaceSlug: string, data: {
  taskId?: string;
  projectId?: string;
  memberId: string;
  duration: number; // 分
  date: string;
  note?: string;
}) {
  const { userId } = await requirePromaneAuthAction();
  const workspace = await requireWritableWorkspace(workspaceSlug, userId);

  const duration = validatePromaneMinutes(data.duration);
  const workDate = parsePromaneWorkDate(data.date);
  if (!data.memberId) throw new Error("memberIdは必須です");

  // セキュリティ: memberIdが自分のworkspaceか確認 (IDOR防止)
  const member = await prisma.promaneMember.findFirst({
    where: { id: data.memberId, workspaceId: workspace.id },
    select: { id: true, hourlyRate: true },
  });
  if (!member) throw new Error("メンバーが見つかりません");

  let projectId = data.projectId || null;
  if (projectId) {
    const project = await prisma.promaneProject.findFirst({
      where: { id: projectId, workspaceId: workspace.id }, select: { id: true },
    });
    if (!project) throw new Error("プロジェクトが見つかりません");
  }

  // セキュリティ: taskIdが指定されていれば自分のworkspaceのものか確認
  if (data.taskId) {
    const task = await prisma.promaneTask.findFirst({
      where: { id: data.taskId, project: { workspaceId: workspace.id } },
      select: { id: true, projectId: true },
    });
    if (!task) throw new Error("タスクが見つかりません");
    if (projectId && task.projectId !== projectId) throw new Error("選択したプロジェクトのタスクを指定してください");
    projectId = task.projectId;
  }

  const entry = await prisma.promaneTimeEntry.create({
    data: {
      taskId: data.taskId || null,
      projectId,
      memberId: data.memberId,
      duration,
      hourlyRateSnapshot: member.hourlyRate,
      date: workDate,
      note: data.note?.slice(0, 1000) || null,
    },
  });

  revalidatePath(`/promane/${workspaceSlug}/timesheet`);
  return entry;
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
  projectId: string;
  category: string;
  amount: number;
  description: string;
  date: string;
}) {
  const { userId } = await requirePromaneAuthAction();
  const workspace = await requireWritableWorkspace(workspaceSlug, userId);

  const validated = parsePromaneExpense(data);

  // セキュリティ: projectIdが自分のworkspaceか確認 (IDOR防止)
  const project = await prisma.promaneProject.findFirst({
    where: { id: data.projectId, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!project) throw new Error("プロジェクトが見つかりません");

  const expense = await prisma.promaneExpense.create({
    data: validated,
  });

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

  // セキュリティ: 操作者がowner/adminか確認 + 対象が自WSのメンバーか
  const myMember = await prisma.promaneMember.findFirst({
    where: { workspaceId: workspace.id, userId, isActive: true },
    select: { role: true },
  });
  if (!myMember || !["owner", "admin"].includes(myMember.role)) {
    throw new Error("時給を変更する権限がありません（owner/admin のみ）");
  }
  const target = await prisma.promaneMember.findFirst({
    where: { id: memberId, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!target) throw new Error("メンバーが見つかりません");

  const rate = validateAmount(hourlyRate, "時給");

  await prisma.promaneMember.update({
    where: { id: memberId },
    data: { hourlyRate: rate },
  });

  revalidatePath(`/promane/${workspaceSlug}/members`);
}
