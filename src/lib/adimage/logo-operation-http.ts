import { prisma } from '@/lib/prisma'
import { recoverAdImageOperation } from './image-operation'
import { adImageOperationReply, privateAdImageReply } from './image-operation-http'
import { recoverAdImageLogo, type AdImageLogoOperation } from './logo-operation'
import type { AdImageResult } from './operation-client'

/** Read current owned records and freshly sign image URLs; never persist or replay browser-supplied image URLs. */
export async function adImageLogoReply(input: AdImageLogoOperation, value: Awaited<ReturnType<typeof recoverAdImageLogo>>) {
  if (value.state !== 'completed' || !('logoContext' in value) || !value.logoContext?.imageOperation) return privateAdImageReply(value, value.state === 'pending' ? 202 : 200, 512 * 1024)
  const image = { actor: input.actor, ...value.logoContext.imageOperation }
  const unavailable = async () => {
    const current = await recoverAdImageLogo(input)
    return privateAdImageReply(current.state === 'completed' ? { ...current, workspaceState: 'unavailable' } : current, 200, 512 * 1024)
  }
  const saved = await recoverAdImageOperation(image)
  if (saved.state !== 'completed' || !('receipt' in saved)) return unavailable()
  // Bind the image to this exact brand before signing any storage objects.
  const concept = await prisma.adImageConcept.findFirst({ where: { id: saved.receipt.conceptId!, campaign: { userId: input.actor, brandId: input.targetId, brand: { userId: input.actor } } }, select: { id: true } })
  if (!concept) return unavailable()
  const response = await adImageOperationReply(image, saved)
  if (!response.ok) throw new Error('Workspace result unavailable')
  const workspace: AdImageResult = await response.json()
  if (workspace.state !== 'completed') return unavailable()
  let workspaceFeedback: Record<string, unknown> | undefined
  if (value.logoContext.feedbackId) {
    const feedback = await prisma.adImageFeedback.findFirst({ where: { id: value.logoContext.feedbackId, conceptId: concept.id, creativeId: { in: workspace.creatives!.map(row => row.id) }, concept: { campaign: { userId: input.actor, brandId: input.targetId, brand: { userId: input.actor } } } }, select: { id: true, creativeId: true, scores: true, advice: true, directive: true } })
    if (feedback) {
      const { parseAdImageFeedback } = await import('./feedback')
      workspaceFeedback = { feedbackId: feedback.id, creativeId: feedback.creativeId, ...parseAdImageFeedback({ scores: feedback.scores, advice: feedback.advice, directives: feedback.directive }) }
    }
  }
  // Signing can await external storage. Recheck both scopes before returning any private workspace data.
  const current = await recoverAdImageLogo(input)
  if (current.state !== 'completed' || (await recoverAdImageOperation(image)).state !== 'completed' || !(await prisma.adImageConcept.findFirst({ where: { id: concept.id, campaign: { userId: input.actor, brandId: input.targetId, brand: { userId: input.actor } } }, select: { id: true } }))) return privateAdImageReply({ operationId: input.operationId.toLowerCase(), kind: input.kind, targetId: input.targetId, state: 'unavailable' })
  return privateAdImageReply({ ...current, workspaceState: 'completed', workspace, ...(workspaceFeedback ? { workspaceFeedback } : value.logoContext.feedbackId ? { workspaceFeedbackUnavailable: true } : {}) }, 200, 512 * 1024)
}
