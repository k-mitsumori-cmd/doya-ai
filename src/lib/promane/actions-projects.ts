"use server";

import { prisma } from "@/lib/prisma";
import { requirePromaneAuth, getWorkspaceBySlug } from "@/lib/promane/auth";
import { revalidatePath } from "next/cache";

export async function createProject(workspaceSlug: string, data: {
  name: string;
  clientId?: string;
  description?: string;
  status?: string;
  billingType?: string;
  contractAmount?: number;
  monthlyAmount?: number;
  hourlyRate?: number;
  estimatedHours?: number;
  startDate?: string;
  endDate?: string;
  tags?: string;
}) {
  const session = await requirePromaneAuth();
  const workspace = await getWorkspaceBySlug(workspaceSlug, session.user!.id!);
  if (!workspace) throw new Error("Workspace not found");

  const project = await prisma.promaneProject.create({
    data: {
      workspaceId: workspace.id,
      name: data.name,
      clientId: data.clientId || null,
      description: data.description || null,
      status: data.status || "draft",
      billingType: data.billingType || "fixed",
      contractAmount: data.contractAmount || 0,
      monthlyAmount: data.monthlyAmount || null,
      hourlyRate: data.hourlyRate || null,
      estimatedHours: data.estimatedHours || null,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      tags: data.tags || null,
    },
  });

  revalidatePath(`/promane/${workspaceSlug}/projects`);
  return project;
}

export async function updateProject(workspaceSlug: string, projectId: string, data: {
  name?: string;
  clientId?: string | null;
  description?: string | null;
  status?: string;
  billingType?: string;
  contractAmount?: number;
  monthlyAmount?: number | null;
  hourlyRate?: number | null;
  estimatedHours?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  tags?: string | null;
}) {
  const session = await requirePromaneAuth();
  const workspace = await getWorkspaceBySlug(workspaceSlug, session.user!.id!);
  if (!workspace) throw new Error("Workspace not found");

  const project = await prisma.promaneProject.update({
    where: { id: projectId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.clientId !== undefined && { clientId: data.clientId }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.billingType !== undefined && { billingType: data.billingType }),
      ...(data.contractAmount !== undefined && { contractAmount: data.contractAmount }),
      ...(data.monthlyAmount !== undefined && { monthlyAmount: data.monthlyAmount }),
      ...(data.hourlyRate !== undefined && { hourlyRate: data.hourlyRate }),
      ...(data.estimatedHours !== undefined && { estimatedHours: data.estimatedHours }),
      ...(data.startDate !== undefined && { startDate: data.startDate ? new Date(data.startDate) : null }),
      ...(data.endDate !== undefined && { endDate: data.endDate ? new Date(data.endDate) : null }),
      ...(data.tags !== undefined && { tags: data.tags }),
    },
  });

  revalidatePath(`/promane/${workspaceSlug}/projects`);
  revalidatePath(`/promane/${workspaceSlug}/projects/${projectId}`);
  return project;
}

export async function deleteProject(workspaceSlug: string, projectId: string) {
  const session = await requirePromaneAuth();
  const workspace = await getWorkspaceBySlug(workspaceSlug, session.user!.id!);
  if (!workspace) throw new Error("Workspace not found");

  await prisma.promaneProject.delete({ where: { id: projectId } });
  revalidatePath(`/promane/${workspaceSlug}/projects`);
}
