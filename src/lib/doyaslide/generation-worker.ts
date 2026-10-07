import { beginDoyaSlideOperation, finishDoyaSlideOperation, recoverDoyaSlideOperation, settleDoyaSlideOperationSlot, type DoyaSlideOperationInput } from './generation-operation'
import { composeSlideImage } from './generate'
import { reviseSlidePrompt } from './vision'
import { fetchBuffer } from './logo'
import { raceTimeout } from '@/lib/fetch-timeout'

/** Only a newly admitted receipt can start provider work. All other states replay. */
export async function runDoyaSlideOperation(input: DoyaSlideOperationInput) {
  const admission = await beginDoyaSlideOperation(input)
  if (admission.state !== 'started') return admission
  let uncertainSave = false
  await Promise.all(admission.slides.map(async slide => {
    let output
    try {
      let revised: string | undefined
      if (input.kind === 'chat' && (slide.rawImageUrl || slide.imageUrl)) {
        try {
          const bytes = await raceTimeout('fetchSlideImage', 30000, fetchBuffer((slide.rawImageUrl || slide.imageUrl)!))
          revised = await reviseSlidePrompt({ imageBase64: Buffer.from(bytes).toString('base64'), mimeType: 'image/png', userInstruction: input.message!, themeColor: admission.project.themeColor })
        } catch { /* Preserve the existing fallback to the original prompt plus instruction. */ }
      }
      const image = await composeSlideImage(input.actor, admission.project, slide, input.kind === 'chat' && !revised ? input.message : undefined, revised)
      output = { imageUrl: image.imageUrl, rawImageUrl: image.rawImageUrl, model: image.model, ...(revised ? { visualPrompt: revised } : {}) }
    } catch { return } // No saved output: finish may refund this owned slot.
    // A lost commit acknowledgement must retry the same output, never the AI.
    for (let attempt = 0; attempt < 3; attempt++) {
      try { await settleDoyaSlideOperationSlot(input, slide.id, output); return }
      catch { /* Atomic settlement/replay makes retry safe even after a commit. */ }
    }
    uncertainSave = true
  }))
  // An unresolved save is not evidence of failure. Leave its reservation intact
  // for explicit recovery or lease expiry rather than guessing a refund.
  if (!uncertainSave) {
    try { await finishDoyaSlideOperation(input) }
    catch { /* Recovery may find that the terminal transaction already committed. */ }
  }
  return recoverDoyaSlideOperation(input)
}
