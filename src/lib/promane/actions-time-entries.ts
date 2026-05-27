"use server";

import { prisma } from "@/lib/prisma";
import { requirePromaneAuth, getWorkspaceBySlug } from "@/lib/promane/auth";
import { revalidatePath } from "next/cache";

export async function createTimeEntry(workspaceSlug: string, data: {
  taskId?: string;
  memberId: string;
  duration: number; // 分
  date: string;
  note?: string;
}) {
  const session = await requirePromaneAuth();
  const workspace = await getWorkspaceBySlug(workspaceSlug, session.user!.id!);
  if (!workspace) throw new Error("Workspace not found");

  const entry = await prisma.promaneTimeEntry.create({
    data: {
      taskId: data.taskId || null,
      memberId: data.memberId,
      duration: data.duration,
      date: new Date(data.date),
      note: data.note || null,
    },
  });

  revalidatePath(`/promane/${workspaceSlug}/timesheet`);
  return entry;
}

export async function deleteTimeEntry(workspaceSlug: string, entryId: string) {
  const session = await requirePromaneAuth();
  const workspace = await getWorkspaceBySlug(workspaceSlug, session.user!.id!);
  if (!workspace) throw new Error("Workspace not found");

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
  const session = await requirePromaneAuth();
  const workspace = await getWorkspaceBySlug(workspaceSlug, session.user!.id!);
  if (!workspace) throw new Error("Workspace not found");

  const expense = await prisma.promaneExpense.create({
    data: {
      projectId: data.projectId,
      category: data.category,
      amount: data.amount,
      description: data.description,
      date: new Date(data.date),
    },
  });

  revalidatePath(`/promane/${workspaceSlug}/projects/${data.projectId}`);
  return expense;
}

export async function deleteExpense(workspaceSlug: string, expenseId: string, projectId: string) {
  const session = await requirePromaneAuth();
  const workspace = await getWorkspaceBySlug(workspaceSlug, session.user!.id!);
  if (!workspace) throw new Error("Workspace not found");

  await prisma.promaneExpense.delete({ where: { id: expenseId } });
  revalidatePath(`/promane/${workspaceSlug}/projects/${projectId}`);
}

export async function updateMemberRate(workspaceSlug: string, memberId: string, hourlyRate: number) {
  const session = await requirePromaneAuth();
  const workspace = await getWorkspaceBySlug(workspaceSlug, session.user!.id!);
  if (!workspace) throw new Error("Workspace not found");

  await prisma.promaneMember.update({
    where: { id: memberId },
    data: { hourlyRate },
  });

  revalidatePath(`/promane/${workspaceSlug}/members`);
}
