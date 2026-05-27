"use server";

import { prisma } from "@/lib/prisma";
import { requirePromaneAuth, getWorkspaceBySlug } from "@/lib/promane/auth";
import { revalidatePath } from "next/cache";

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

  const maxOrder = await prisma.promaneTask.aggregate({
    where: { projectId: data.projectId, status: data.status || "todo" },
    _max: { order: true },
  });

  const task = await prisma.promaneTask.create({
    data: {
      projectId: data.projectId,
      title: data.title,
      description: data.description || null,
      status: data.status || "todo",
      priority: data.priority || "medium",
      assigneeId: data.assigneeId || null,
      parentId: data.parentId || null,
      startDate: data.startDate ? new Date(data.startDate) : null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
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

  const task = await prisma.promaneTask.update({
    where: { id: taskId },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
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
