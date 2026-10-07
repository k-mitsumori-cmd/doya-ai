"use server";

import { prisma } from "@/lib/prisma";
import { requirePromaneAuthAction, requireWritableWorkspace } from "@/lib/promane/auth";
import { revalidatePath } from "next/cache";

import { createPromaneClientOnce, promaneClientOperationId, isPromaneClientReceiptConflict } from "./client-creation";
import { parsePromaneClientCreate, parsePromaneClientPatch } from "./client-input";
import type { Prisma } from "@prisma/client";

async function lockWritableClientActor(tx: Prisma.TransactionClient, workspaceId: string, userId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM promane_members
    WHERE "workspaceId"=${workspaceId} AND "userId"=${userId} AND "isActive"=true
      AND role IN ('owner','admin','member') FOR UPDATE`;
  if (rows.length !== 1) throw new Error('ワークスペースの変更権限がありません');
}
async function retryClientCreation<T>(commit: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await commit(); }
    catch (error) {
      if (!isPromaneClientReceiptConflict(error) || attempt === 2) throw error;
    }
  }
  throw new Error('保存状態を確認できません');
}

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
  operationId: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  note?: string;
}) {
  const { userId } = await requirePromaneAuthAction();
  const workspace = await requireWritableWorkspace(workspaceSlug, userId);

  const operationId = promaneClientOperationId(data.operationId);
  const input = parsePromaneClientCreate(data);
  const client = await retryClientCreation(() => prisma.$transaction(async tx => {
    await lockWritableClientActor(tx, workspace.id, userId);
    return createPromaneClientOnce(tx, { workspaceId: workspace.id, userId }, operationId, input,
      id => tx.promaneClient.findFirst({ where: { id, workspaceId: workspace.id } }),
      () => tx.promaneClient.create({ data: { ...input, workspaceId: workspace.id } }));
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

  const input = parsePromaneClientPatch(data);

  const client = await retryClientTransaction(() => prisma.$transaction(async tx => {
    const actor = await tx.promaneMember.findFirst({
      where: { workspaceId: workspace.id, userId, isActive: true, role: { in: ['owner', 'admin', 'member'] } },
      select: { id: true },
    });
    if (!actor) throw new Error('ワークスペースの変更権限がありません');
    const updated = await tx.promaneClient.updateMany({
      where: { id: clientId, workspaceId: workspace.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.contactName !== undefined && { contactName: input.contactName }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.address !== undefined && { address: input.address }),
        ...(input.note !== undefined && { note: input.note }),
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
