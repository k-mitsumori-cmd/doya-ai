import type { Prisma } from '@prisma/client';
import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getUserPromaneLimits, countUserWorkspaces } from '@/lib/promane/limits';
import { parsePromaneWorkspaceCreate, parsePromaneWorkspacePatch } from './workspace-input';
import { runPromaneWorkspaceOnce, recoverPromaneWorkspaceOperation, promaneWorkspaceOperationId, isPromaneWorkspaceReceiptConflict, type PromaneWorkspaceOperationScope } from './workspace-operation';

export class PromaneWorkspaceRequestError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}
function intent(userId: string, body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new PromaneWorkspaceRequestError(400, 'INVALID_INPUT', 'ワークスペースの入力を確認してください');
  const data=body as Record<string, unknown>;
  if (data.expectedUserId !== userId) throw new PromaneWorkspaceRequestError(409, 'AUTH_CONTEXT_CHANGED', 'ログインする利用者が変わりました。保存状態を確認してください');
  let operationId: string;
  try { operationId=promaneWorkspaceOperationId(data.operationId); } catch { throw new PromaneWorkspaceRequestError(400,'INVALID_INPUT','送信情報を確認できません。画面を読み込み直してください'); }
  return {data,operationId};
}
function validated<T>(parse:()=>T):T { try { return parse(); } catch (error) { throw new PromaneWorkspaceRequestError(400,'INVALID_INPUT',error instanceof Error?error.message:'入力を確認してください'); } }
function target(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 200) throw new PromaneWorkspaceRequestError(400,'INVALID_INPUT','ワークスペースを指定してください');
  return value;
}
async function lockAccount(tx: Prisma.TransactionClient, userId: string) {
  const users=await tx.$queryRaw<{id:string}[]>`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
  if (users.length !== 1) throw new PromaneWorkspaceRequestError(401,'AUTH_REQUIRED','ログイン状態を確認してください');
}
async function lockManager(tx: Prisma.TransactionClient, userId: string, workspaceId: string) {
  const members=await tx.$queryRaw<{id:string}[]>`SELECT id FROM promane_members WHERE "workspaceId"=${workspaceId} AND "userId"=${userId} AND "isActive"=true AND role IN ('owner','admin') FOR UPDATE`;
  if (members.length !== 1) throw new PromaneWorkspaceRequestError(403,'FORBIDDEN','ワークスペース設定の編集権限がありません');
}
async function transaction<T>(work: (tx: Prisma.TransactionClient)=>Promise<T>): Promise<T> {
  for (let attempt=0;attempt<3;attempt++) {
    try { return await prisma.$transaction(work,{isolationLevel:'Serializable'}); }
    catch (error) {
      const slugConflict=error && typeof error==='object' && 'code' in error && error.code==='P2002' && 'meta' in error && error.meta && typeof error.meta==='object' && 'target' in error.meta && Array.isArray(error.meta.target) && error.meta.target.length===1 && error.meta.target[0]==='slug';
      if (!isPromaneWorkspaceReceiptConflict(error) && !slugConflict) throw error;
      if (attempt===2) throw new PromaneWorkspaceRequestError(409,'CONCURRENT_CHANGE','同時にワークスペースが変更されました。保存状態を確認してください');
    }
  }
  throw new Error('保存状態を確認できません');
}
const select={id:true,userId:true,name:true,slug:true,updatedAt:true} as const;
const stale='別の画面でワークスペースが更新されています。入力を保管してから最新版を開き直してください';
export async function createPromaneWorkspaceOperation(userId: string, body: unknown) {
  const {data,operationId}=intent(userId,body), input=validated(()=>parsePromaneWorkspaceCreate(data));
  return transaction(async tx=>{
    await lockAccount(tx,userId);
    return runPromaneWorkspaceOnce(tx,{userId,mode:'create',workspaceId:null},operationId,input,
      id=>tx.promaneWorkspace.findFirst({where:{id,userId,members:{some:{userId,isActive:true,role:{in:['owner','admin','member','guest']}}}},select}),async()=>{
        const limits=await getUserPromaneLimits(userId,tx), current=await countUserWorkspaces(userId,tx);
        if (limits.maxWorkspaces>=0 && current>=limits.maxWorkspaces) {
          const upgrade=limits.tier==='FREE'||limits.tier==='LIGHT';
          return {state:'rejected',code:'LIMIT_REACHED',limit:limits.maxWorkspaces,
            error:upgrade?`作成できるワークスペースは${limits.maxWorkspaces}個までです。プランを変更すると上限を増やせます。`:`作成できるワークスペースは${limits.maxWorkspaces}個までです。追加が必要な場合はお問い合わせください。`,
            ...(upgrade?{upgradeUrl:'/promane/pricing' as const}:{contactUrl:'https://doyamarke.surisuta.jp/contact' as const})};
        }
        const user=await tx.user.findUnique({where:{id:userId},select:{name:true}});
        const entry=await tx.promaneWorkspace.create({data:{userId,name:input.name,slug:`ws-${crypto.randomBytes(8).toString('hex')}`,
          members:{create:{userId,role:'owner',displayName:user?.name||'オーナー'}}},select});
        return {state:'saved',entry};
      });
  });
}
export async function updatePromaneWorkspaceOperation(userId: string, workspace: unknown, body: unknown) {
  const workspaceId=target(workspace),{data,operationId}=intent(userId,body),input=validated(()=>parsePromaneWorkspacePatch(data));
  return transaction(async tx=>{
    await lockAccount(tx,userId);await lockManager(tx,userId,workspaceId);
    return runPromaneWorkspaceOnce(tx,{userId,mode:'update',workspaceId},operationId,input,
      id=>tx.promaneWorkspace.findFirst({where:{id:workspaceId,AND:{id}},select}),async()=>{
        const existing=await tx.promaneWorkspace.findUnique({where:{id:workspaceId},select});
        if (!existing) throw new PromaneWorkspaceRequestError(404,'NOT_FOUND','ワークスペースが見つかりません');
        const expected=new Date(input.expectedUpdatedAt);
        if (+existing.updatedAt!==+expected) return {state:'rejected',code:'STALE_WORKSPACE',error:stale};
        if (input.slug && await tx.promaneWorkspace.findFirst({where:{slug:input.slug,NOT:{id:workspaceId}},select:{id:true}})) return {state:'rejected',code:'SLUG_TAKEN',error:'このスラッグは既に使われています'};
        const {expectedUpdatedAt:_revision,...patch}=input;
        // Conditional update, serializable retry and a terminal stale outcome protect later edits.
        const changed=await tx.promaneWorkspace.updateMany({where:{id:workspaceId,updatedAt:expected},data:{...patch,updatedAt:new Date(Math.max(Date.now(),+expected+1))}});
        if (changed.count!==1) return {state:'rejected',code:'STALE_WORKSPACE',error:stale};
        const entry=await tx.promaneWorkspace.findUnique({where:{id:workspaceId},select});
        if (!entry) throw new Error('保存したワークスペースを確認できません');
        return {state:'saved',entry};
      });
  });
}
export async function recoverPromaneWorkspaceMutation(userId: string, body: unknown) {
  const {data,operationId}=intent(userId,body);
  if (typeof data.cancelIfMissing!=='boolean' || !['create','update'].includes(data.mode as string) || (data.mode==='create' && data.workspaceId!==null)) throw new PromaneWorkspaceRequestError(400,'INVALID_INPUT','確認対象を指定してください');
  const scope: PromaneWorkspaceOperationScope=data.mode==='create'?{userId,mode:'create',workspaceId:null}:{userId,mode:'update',workspaceId:target(data.workspaceId)};
  return transaction(async tx=>{
    await lockAccount(tx,userId);
    if (scope.mode==='update') {
      const existing=await tx.promaneWorkspace.findUnique({where:{id:scope.workspaceId},select:{id:true}});
      // Existing targets always require current manager authority. A deleted target may only expose this user's operation outcome.
      if (existing) await lockManager(tx,userId,scope.workspaceId);
    }
    return recoverPromaneWorkspaceOperation(tx,scope,operationId,id=>tx.promaneWorkspace.findFirst({where:scope.mode==='create'?{id,userId,members:{some:{userId,isActive:true,role:{in:['owner','admin','member','guest']}}}}:{id:scope.workspaceId,AND:{id}},select}),data.cancelIfMissing as boolean);
  });
}
