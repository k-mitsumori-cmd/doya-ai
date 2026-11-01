'use server';
import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePromaneAuthAction } from './auth';
export type LegacyPendingDescriptor = { family: 'project' | 'task' | 'expense' | 'client' | 'time'; operationId: string; expectedUserId: string; entityId: string | null; mode: 'create' | 'update' };
function validate(input: LegacyPendingDescriptor, userId: string) {
  if (!input || input.expectedUserId !== userId || !['project','task','expense','client','time'].includes(input.family)
    || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(input.operationId)
    || !['create','update'].includes(input.mode) || (input.entityId !== null && (typeof input.entityId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(input.entityId)))) throw new Error('送信記録を確認できません');
  if ((input.family === 'project' && (input.mode === 'create' ? input.entityId !== null : input.entityId === null)) || (input.family === 'task' && input.entityId === null) || (input.family !== 'project' && input.mode !== 'create')) throw new Error('送信記録を確認できません');
}
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function bindings(db: Pick<Prisma.TransactionClient,'promaneMember'|'systemSetting'>, input: LegacyPendingDescriptor, userId: string, includeInactive = false) {
  const memberships = await db.promaneMember.findMany({ where: { userId, ...(includeInactive ? {} : { isActive: true, role: { in: ['owner','admin','member'] } }) }, select: { workspaceId: true } });
  const scope = (workspaceId: string) => input.family === 'project' ? [workspaceId,userId,input.mode,input.entityId,input.operationId] : input.family === 'task' ? [workspaceId,userId,input.entityId,input.operationId] : [workspaceId,userId,input.operationId];
  const prefix = input.family === 'time' ? 'promane-time-entry:v1:' : `promane-${input.family}:v1:`;
  const candidates = memberships.map(({workspaceId}) => ({workspaceId,key: prefix + hash(scope(workspaceId))}));
  const receipts = await db.systemSetting.findMany({ where: { key: { in: candidates.map(row=>row.key) } }, select: { key: true } });
  return candidates.filter(row=>receipts.some(receipt=>receipt.key===row.key));
}
/** Read only: an old mutable URL is never proof of ownership or the original target. */
export async function resolveLegacyPendingScope(input: LegacyPendingDescriptor): Promise<{ state: 'bound'; workspaceId: string } | { state: 'unresolved' }> {
  const { userId } = await requirePromaneAuthAction(); validate(input,userId);
  const matched = await bindings(prisma,input,userId);
  return matched.length === 1 ? { state: 'bound', workspaceId: matched[0].workspaceId } : { state: 'unresolved' };
}
/** Explicit cancellation fences only this actor/family/UUID, including a delayed old-URL request.
 * Existing scoped receipts/business rows remain untouched and recoverable.
 */
export async function cancelUnboundLegacyPending(input: LegacyPendingDescriptor): Promise<{state:'bound';workspaceId:string}|{state:'cancelled'|'unavailable'}> {
  const {userId} = await requirePromaneAuthAction(); validate(input,userId);
  const key = 'promane-legacy-cancel:v1:' + hash([input.family,userId,input.operationId]);
  for (let attempt=0;attempt<3;attempt++) {
    try { return await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('promane-legacy-cancel:v1'), hashtext(${key}))`;
      const matched = await bindings(tx,input,userId);
      if (matched.length === 1) return {state:'bound' as const,workspaceId:matched[0].workspaceId};
      if (matched.length > 1) throw new Error('複数の送信先が見つかりました。保存済みの一覧を確認してください');
      // Own historical receipts may survive access revocation. Do not call an already processed send cancelled.
      const historical = await bindings(tx,input,userId,true);
      const historicalReceipts = await tx.systemSetting.findMany({where:{key:{in:historical.map(row=>row.key)}},select:{value:true}});
      let processed = false;
      for (const receipt of historicalReceipts) {
        const value = JSON.parse(receipt.value);
        if (!value || value.version !== 1 || !['created','saved','rejected','cancelled'].includes(value.state)) throw new Error('送信記録を確認できません');
        if (value.state !== 'cancelled') processed = true;
      }
      const existing = await tx.systemSetting.findUnique({where:{key},select:{value:true}});
      if (existing) {
        const value = JSON.parse(existing.value);
        if (!value || value.version !== 1 || value.state !== 'cancelled') throw new Error('送信記録を確認できません');
      } else await tx.systemSetting.create({data:{key,value:JSON.stringify({version:1,state:'cancelled'})}});
      return processed ? {state:'unavailable' as const} : {state:'cancelled' as const};
    },{isolationLevel:'Serializable'}); }
    catch(error) {
      const raw=error as {code?:string;meta?:{code?:string}};
      if (attempt===2 || !(raw?.code==='P2034' || raw?.code==='P2002' || (raw?.code==='P2010' && ['40001','40P01'].includes(raw.meta?.code || '')))) throw error;
    }
  }
  throw new Error('送信記録を確認できません');
}
