import { validAdImageAnalysisOutput, type AdImageAnalysisOutput } from './analysis-result'
import type { LogoPosition } from './logo'
import type { AdCopy } from './types'
export type AdImageLogoContext = AdImageAnalysisOutput & { copy: AdCopy; selected: number; placements: string[]; url?: string; useManualText?: boolean; manualText?: string; appeal?: string; customPrompt?: string; designRefId?: string; variations?: number; note?: string; chips?: string[]; logoPos?: LogoPosition; imageOperation?: { operationId: string; kind: 'generate' | 'refine'; targetId: string }; feedbackId?: string }
/** Private editing context stays on the server; browser intent storage contains only operation metadata. */
export function validAdImageLogoContext(value: unknown): value is AdImageLogoContext {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const v = value as AdImageLogoContext
  if (Object.keys(v).some(key => !['brand', 'concepts', 'copy', 'selected', 'placements', 'url', 'useManualText', 'manualText', 'appeal', 'customPrompt', 'designRefId', 'variations', 'note', 'chips', 'logoPos', 'imageOperation', 'feedbackId'].includes(key)) || !validAdImageAnalysisOutput({ brand: v.brand, concepts: v.concepts })) return false
  if (!v.copy || typeof v.copy !== 'object' || Array.isArray(v.copy) || Object.keys(v.copy).some(key => !['headline', 'sub', 'cta'].includes(key)) || !['headline', 'sub', 'cta'].every(key => typeof (v.copy as unknown as Record<string, unknown>)[key] === 'string' && String((v.copy as unknown as Record<string, unknown>)[key]).length <= 2000)) return false
  if (!Number.isSafeInteger(v.selected) || v.selected < 0 || v.selected >= v.concepts.length || !Array.isArray(v.placements) || v.placements.length > 10 || new Set(v.placements).size !== v.placements.length || v.placements.some(key => typeof key !== 'string' || !/^[A-Za-z0-9_.:-]{1,128}$/.test(key))) return false
  for (const [key, max] of Object.entries({ url: 8192, manualText: 14000, appeal: 500, customPrompt: 4000, designRefId: 256, note: 2000 })) {
    const field = (v as unknown as Record<string, unknown>)[key]
    if (field !== undefined && (typeof field !== 'string' || field.length > max)) return false
  }
  if ((v.useManualText !== undefined && typeof v.useManualText !== 'boolean') || (v.variations !== undefined && ![1, 3].includes(v.variations)) || (v.logoPos !== undefined && !['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center-top'].includes(v.logoPos))) return false
  if (v.chips !== undefined && (!Array.isArray(v.chips) || v.chips.length > 20 || v.chips.some(chip => typeof chip !== 'string' || chip.length > 128))) return false
  if (v.feedbackId !== undefined && (typeof v.feedbackId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(v.feedbackId))) return false
  if (v.imageOperation !== undefined && (!v.imageOperation || typeof v.imageOperation !== 'object' || Array.isArray(v.imageOperation) || Object.keys(v.imageOperation).some(key => !['operationId', 'kind', 'targetId'].includes(key)) || !['generate', 'refine'].includes(v.imageOperation.kind) || typeof v.imageOperation.operationId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v.imageOperation.operationId) || typeof v.imageOperation.targetId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(v.imageOperation.targetId))) return false
  if (v.feedbackId && !v.imageOperation) return false
  return new TextEncoder().encode(JSON.stringify(v)).byteLength <= 192 * 1024
}
