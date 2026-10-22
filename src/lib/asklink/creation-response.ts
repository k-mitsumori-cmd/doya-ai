import { prisma } from '@/lib/prisma'
import { privateApiJson } from '@/lib/private-api-response'
import { RUN_SELECT, toRunDto } from './dto'
import { AskLinkCreationError, type AskLinkCreationState } from './creation-operation'

export async function askLinkCreationResponse(actor: string, operation: AskLinkCreationState, fresh = false) {
  const packet = { actor, operation, autoGenerateBanners: fresh }
  if (operation.state === 'completed' && operation.runId) {
    const run = await prisma.askLinkRun.findFirst({ where: { id: operation.runId, userId: actor }, select: RUN_SELECT })
    if (!run) return privateApiJson({ ...packet, operation: { ...operation, state: 'deleted', reserved: false } })
    try {
      if (!Array.isArray(run.links) || run.links.length !== 2) throw Error('Invalid completed run')
      return privateApiJson({ ...packet, run: await toRunDto(run) })
    } catch {
      return privateApiJson({ ...packet, error: '結果は保存されています。新しく作成せず、保存結果を再確認してください。', code: 'RESULT_UNAVAILABLE' }, { status: 503 })
    }
  }
  if (operation.state === 'expired') return privateApiJson(packet, { status: 410 })
  if (operation.failure === 'QUOTA_REACHED') return privateApiJson({ ...packet, error: operation.quota?.reason, limitReached: true, upgradeUrl: '/asklink/pricing' }, { status: 429 })
  if (operation.failure === 'WEBSITE_UNREADABLE') return privateApiJson({ ...packet, canUseManualInput: true }, { status: 422 })
  return privateApiJson(packet, { status: operation.state === 'pending' || operation.state === 'unknown' ? 202 : 200 })
}
export function askLinkCreationErrorResponse(error: unknown) {
  if (error instanceof AskLinkCreationError && error.status === 428 && error.code === 'ACTOR_REQUIRED') return privateApiJson({ error: '画面が更新されました。入力内容を控えてから再読み込みし、作成してください。この操作では生成していません。', code: error.code }, { status: 428 })
  if (error instanceof AskLinkCreationError) return privateApiJson({ error: error.status === 401 || error.status === 403 ? 'ログイン状態を確認してください。' : error.message, code: error.code }, { status: error.status })
  console.error('[asklink-create] operation could not be confirmed')
  return privateApiJson({ error: '作成結果を確認できませんでした。新しく作成せず、保存結果を確認してください。', code: 'STATUS_UNAVAILABLE' }, { status: 503 })
}
