import { privateApiJson } from '@/lib/private-api-response'

import { PromaneWorkspaceRequestError } from './workspace-mutations';
import { PromaneWorkspaceOperationError } from './workspace-operation';

type Outcome = { state: string; entry?: unknown; code?: string };
export function promaneWorkspaceResponse(result: Outcome) {
  if (result.state === 'rejected') return privateApiJson({ ...result, success: false }, { status: result.code === 'LIMIT_REACHED' ? 403 : 409 });
  const success = result.state === 'saved' || result.state === 'superseded';
  return privateApiJson({ ...result, success, ...(success ? { workspace: result.entry } : {}) });
}
export function promaneWorkspaceFailure(error: unknown) {
  if (error instanceof PromaneWorkspaceRequestError) return privateApiJson({ error: error.message, code: error.code }, { status: error.status });
  if (error instanceof PromaneWorkspaceOperationError) return privateApiJson({ error: error.message, code: 'OPERATION_CONFLICT' }, { status: 409 });
  console.error('[promane/workspaces] operation failed');
  return privateApiJson({ error: '保存状態を確認できません。入力を保管し、保存状態を確認してください', code: 'UNKNOWN_OUTCOME' }, { status: 500 });
}
