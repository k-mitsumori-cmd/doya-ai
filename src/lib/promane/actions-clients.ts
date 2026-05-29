"use server";

import { prisma } from "@/lib/prisma";
import { requirePromaneAuthAction, getWorkspaceBySlug } from "@/lib/promane/auth";
import { revalidatePath } from "next/cache";

export async function createClient(workspaceSlug: string, data: {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  note?: string;
}) {
  const { userId } = await requirePromaneAuthAction();
  const workspace = await getWorkspaceBySlug(workspaceSlug, userId);
  if (!workspace) throw new Error("ワークスペースにアクセスできません");

  // バリデーション
  if (!data.name?.trim()) throw new Error("会社名は必須です");
  if (data.name.length > 200) throw new Error("会社名は200文字以内");
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
    throw new Error("メールアドレスの形式が不正です");
  }

  const client = await prisma.promaneClient.create({
    data: {
      workspaceId: workspace.id,
      name: data.name.trim(),
      contactName: data.contactName?.trim() || null,
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      address: data.address?.trim() || null,
      note: data.note?.slice(0, 5000) || null,
    },
  });

  revalidatePath(`/promane/${workspaceSlug}/clients`);
  return client;
}

export async function updateClient(workspaceSlug: string, clientId: string, data: {
  name?: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  note?: string | null;
}) {
  const { userId } = await requirePromaneAuthAction();
  const workspace = await getWorkspaceBySlug(workspaceSlug, userId);
  if (!workspace) throw new Error("ワークスペースにアクセスできません");

  const client = await prisma.promaneClient.update({
    where: { id: clientId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.contactName !== undefined && { contactName: data.contactName }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.note !== undefined && { note: data.note }),
    },
  });

  revalidatePath(`/promane/${workspaceSlug}/clients`);
  return client;
}

export async function deleteClient(workspaceSlug: string, clientId: string) {
  const { userId } = await requirePromaneAuthAction();
  const workspace = await getWorkspaceBySlug(workspaceSlug, userId);
  if (!workspace) throw new Error("ワークスペースにアクセスできません");

  await prisma.promaneClient.delete({ where: { id: clientId } });
  revalidatePath(`/promane/${workspaceSlug}/clients`);
}
