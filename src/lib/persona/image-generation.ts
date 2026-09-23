import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { callGeminiImageAPI } from '@/lib/resolve-image-model'
import { reservePersonaImage, settlePersonaImage } from './image-ledger'
import { assertPersonaImageStorage, normalizePersonaImage, savePersonaImageFile, removePersonaImageFile } from './image-storage'
import type { PersonaImageIntent } from './image-entitlements'

type ImageKind = 'portrait' | 'scene' | 'banner'
type ResolvedImage = {
  userId: string; projectId: string; requestKey: string; slotKey: string; kind: ImageKind; intent: PersonaImageIntent
  persona: Record<string, any>; scenePrompt?: string
}
const error = (message: string, status: number, code?: string) => NextResponse.json({ error: message, ...(code ? { code } : {}) }, { status })

/** All identity/attached-image rights come from the owned, immutable server result. */
export async function resolvePersonaImageInput(userId: string, body: Record<string, unknown>, kind: ImageKind): Promise<{ input: ResolvedImage } | { response: NextResponse }> {
  const { projectId, requestKey, slotKey, intent } = body
  if (typeof projectId !== 'string' || projectId.length > 100 || typeof requestKey !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(requestKey) ||
      typeof slotKey !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(slotKey) || !['included', 'extra', 'regenerate'].includes(String(intent))) {
    return { response: error('サーバーに保存されたペルソナを選択して画像を生成してください。', 400, 'PERSONA_PROJECT_REQUIRED') }
  }
  const project = await prisma.personaProject.findFirst({ where: { id: projectId, userId, status: 'succeeded', deletedAt: null } })
  if (!project) return { response: error('ペルソナが見つかりません。', 404) }
  const data = project.data as Record<string, any> | null
  if (!data?.persona || typeof data.persona !== 'object' || Array.isArray(data.persona)) return { response: error('ペルソナを読み込めませんでした。', 503) }
  const grant = Array.isArray(project.includedImages) ? project.includedImages.find(value => value && typeof value === 'object' && !Array.isArray(value) && value.key === slotKey && value.kind === kind) : undefined
  if (intent === 'included' && !grant) return { response: error('この画像は付属画像の対象ではありません。', 400, 'INVALID_IMAGE_GRANT') }
  const grantPrompt = grant && typeof grant === 'object' && !Array.isArray(grant) ? grant.prompt : undefined
  // Regeneration of an attached slot uses the same server prompt. Custom scenes are explicit extras.
  const scenePrompt = grant ? grantPrompt : body.scenePrompt
  if (kind === 'scene' && (typeof scenePrompt !== 'string' || !scenePrompt.trim() || scenePrompt.length > 8000)) {
    return { response: error('画像の説明を確認してください。', 400) }
  }
  return { input: { userId, projectId, requestKey, slotKey, kind, intent: intent as PersonaImageIntent, persona: data.persona,
    ...(typeof scenePrompt === 'string' ? { scenePrompt } : {}),
  } }
}

export async function generateAndSavePersonaImage(input: ResolvedImage, requestBody: Record<string, unknown>, extra: Record<string, unknown> = {}, outputSize?: { width: number; height: number }) {
  const inputHash = createHash('sha256').update(JSON.stringify(outputSize ? { requestBody, outputSize } : requestBody)).digest('hex')
  const attempt = await reservePersonaImage(prisma, { ...input, inputHash })
  if (attempt.state === 'unauthorized') return error('再度ログインしてください。', 401, 'LOGIN_REQUIRED')
  if (attempt.state === 'not_found') return error('ペルソナが見つかりません。', 404)
  if (attempt.state === 'invalid_grant' || attempt.state === 'missing_original') return error('対象の画像を確認してください。', 400)
  if (attempt.state === 'conflict') return error('この画像生成の要求IDは再利用できません。', 409, 'REQUEST_CONFLICT')
  if (attempt.state === 'pending') return error('この画像を生成中です。しばらくしてから再度お試しください。', 409, 'GENERATION_PENDING')
  if (attempt.state === 'limit') return NextResponse.json({ error: `本日の追加画像・再生成の上限（${attempt.limit}枚）に達しました。`,
    code: 'DAILY_LIMIT_REACHED', limitReached: true, usedToday: attempt.used, dailyLimit: attempt.limit, resetAt: attempt.resetAt, upgradeUrl: '/persona/pricing',
  }, { status: 429 })
  const job = attempt.job
  const success = () => NextResponse.json({ success: true, image: `/api/persona/images/${job.id}`, imageId: job.id, ...extra })
  if (attempt.state === 'cached') return success()
  const path = `${input.projectId}/${job.id}/${job.leaseToken}.png`
  let uploaded = false
  let failureCode: 'PROVIDER_FAILED' | 'STORAGE_FAILED' = 'STORAGE_FAILED'
  try {
    await assertPersonaImageStorage()
    failureCode = 'PROVIDER_FAILED'
    const { response } = await callGeminiImageAPI('', requestBody, {
      primaryTimeoutMs: 150000, fallbackTimeoutMs: 45000,
      ...(outputSize ? { size: `${outputSize.width}x${outputSize.height}` } : {}),
    })
    if (!response.ok) throw new Error('Persona image provider failed')
    const result = await response.json()
    const parts = result?.candidates?.[0]?.content?.parts
    const inline = Array.isArray(parts) ? parts.map(part => part?.inlineData || part?.inline_data).find(value => typeof value?.data === 'string' && value.data) : null
    if (!inline) throw new Error('Persona image provider returned no image')
    const buffer = await normalizePersonaImage(inline.data, outputSize)
    failureCode = 'STORAGE_FAILED'
    await savePersonaImageFile(path, buffer)
    uploaded = true
    const committed = await settlePersonaImage(prisma, input.userId, job.id, job.leaseToken, { outputRef: path })
    if (!committed) {
      await removePersonaImageFile(path)
      return error('画像の生成が中断されました。ペルソナを確認して再度お試しください。', 409)
    }
    return success()
  } catch {
    try {
      const released = await settlePersonaImage(prisma, input.userId, job.id, job.leaseToken, { failureCode })
      // An ambiguous database commit must never delete an image that might already be referenced.
      if (uploaded && released) await removePersonaImageFile(path)
    } catch { console.error('Persona image settlement or cleanup failed') }
    return error('画像を生成・保存できませんでした。しばらくしてから再度お試しください。', 503)
  }
}
