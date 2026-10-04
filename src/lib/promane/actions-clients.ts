"use server";

import { prisma } from "@/lib/prisma";
import { requirePromaneAuthAction, requireWritableWorkspace } from "@/lib/promane/auth";
import { revalidatePath } from "next/cache";

async function retryClientTransaction<T>(commit: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await commit(); }
    catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'P2034')) throw error;
      if (attempt === 2) throw new Error('同時に顧客情報が変更されました。少し待って再度操作してください');
    }
  }
  throw new Error('顧客情報を変更できませんでした');
}

export async function createClient(workspaceSlug: string, data: {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  note?: string;
}) {
  const { userId } = await requirePromaneAuthAction();
  const workspace = await requireWritableWorkspace(workspaceSlug, userId);

  // バリデーション
  if (!data.name?.trim()) throw new Error("会社名は必須です");
  if (data.name.length > 200) throw new Error("会社名は200文字以内");
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
    throw new Error("メールアドレスの形式が不正です");
  }

  const client = await retryClientTransaction(() => prisma.$transaction(async tx => {
    const actor = await tx.promaneMember.findFirst({
      where: { workspaceId: workspace.id, userId, isActive: true, role: { in: ['owner', 'admin', 'member'] } },
      select: { id: true },
    });
    if (!actor) throw new Error('ワークスペースの変更権限がありません');
    return tx.promaneClient.create({
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
  }, { isolationLevel: 'Serializable' }));

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
  const workspace = await requireWritableWorkspace(workspaceSlug, userId);

  const client = await retryClientTransaction(() => prisma.$transaction(async tx => {
    const actor = await tx.promaneMember.findFirst({
      where: { workspaceId: workspace.id, userId, isActive: true, role: { in: ['owner', 'admin', 'member'] } },
      select: { id: true },
    });
    if (!actor) throw new Error('ワークスペースの変更権限がありません');
    const updated = await tx.promaneClient.updateMany({
      where: { id: clientId, workspaceId: workspace.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.contactName !== undefined && { contactName: data.contactName }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.note !== undefined && { note: data.note }),
      },
    });
    if (updated.count !== 1) throw new Error("顧客が見つかりません");
    return tx.promaneClient.findFirst({ where: { id: clientId, workspaceId: workspace.id } });
  }, { isolationLevel: 'Serializable' }));
  if (!client) throw new Error('顧客が見つかりません');

  revalidatePath(`/promane/${workspaceSlug}/clients`);
  return client;
}

export async function deleteClient(workspaceSlug: string, clientId: string) {
  const { userId } = await requirePromaneAuthAction();
  const workspace = await requireWritableWorkspace(workspaceSlug, userId);

  await retryClientTransaction(() => prisma.$transaction(async tx => {
    const actor = await tx.promaneMember.findFirst({
      where: { workspaceId: workspace.id, userId, isActive: true, role: { in: ['owner', 'admin', 'member'] } },
      select: { id: true },
    });
    if (!actor) throw new Error('ワークスペースの変更権限がありません');
    const deleted = await tx.promaneClient.deleteMany({ where: { id: clientId, workspaceId: workspace.id } });
    if (deleted.count !== 1) throw new Error("顧客が見つかりません");
  }, { isolationLevel: 'Serializable' }));
  revalidatePath(`/promane/${workspaceSlug}/clients`);
}
