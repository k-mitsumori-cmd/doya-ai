"use server";

import { parsePromaneWorkDate, validatePromaneMinutes, parsePromaneExpense, validatePromaneInteger } from "./time-input";
import { prisma } from "@/lib/prisma";
import { requirePromaneAuthAction, requireWritableWorkspace } from "@/lib/promane/auth";
import { revalidatePath } from "next/cache";

/** 数値バリデーション */
function validateAmount(v: number | undefined | null, field: string): number {
  return validatePromaneInteger(v, field);
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
    select: { id: true },
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

  // セキュリティ: workspace所属確認 (IDOR防止)
  const existing = await prisma.promaneTimeEntry.findFirst({
    where: { id: entryId, member: { workspaceId: workspace.id } },
    select: { id: true },
  });
  if (!existing) throw new Error("時間記録が見つかりません");

  await prisma.promaneTimeEntry.delete({ where: { id: entryId } });
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

  // セキュリティ: workspace所属確認 (IDOR防止)
  const existing = await prisma.promaneExpense.findFirst({
    where: { id: expenseId, project: { workspaceId: workspace.id } },
    select: { id: true },
  });
  if (!existing) throw new Error("経費が見つかりません");

  await prisma.promaneExpense.delete({ where: { id: expenseId } });
  revalidatePath(`/promane/${workspaceSlug}/projects/${projectId}`);
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
