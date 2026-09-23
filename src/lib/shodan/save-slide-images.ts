import { prisma } from '@/lib/prisma'
import type { StoredSlide } from './slide-image'
import type { ProposalSlide } from './types'

export class SlideImageConflict extends Error {
  constructor() { super('資料が別の操作で変更されました。再読み込みしてからお試しください。') }
}

/** AI処理の後、短いトランザクション内で対象画像だけを最新配列へ反映する。 */
export async function saveSlideImages(
  id: string,
  organizationId: string,
  expectedSlides: unknown,
  expectedImages: StoredSlide[],
  changes: Array<{ index: number; image: StoredSlide }>,
): Promise<StoredSlide[]> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM shodan_preparations
      WHERE id = ${id} AND "organizationId" = ${organizationId}
      FOR UPDATE
    `
    if (locked.length !== 1) throw new SlideImageConflict()
    const current = await tx.shodanPreparation.findFirst({ where: { id, organizationId } })
    if (!current || JSON.stringify(current.slidesJson) !== JSON.stringify(expectedSlides)) throw new SlideImageConflict()
    const slides = current.slidesJson as unknown as ProposalSlide[]
    const existing = (current.slideImages as unknown as StoredSlide[] | null) || []
    for (const { index } of changes) {
      if (!Array.isArray(slides) || !Number.isInteger(index) || index < 0 || index >= slides.length ||
          JSON.stringify(existing[index] ?? null) !== JSON.stringify(expectedImages[index] ?? null)) {
        throw new SlideImageConflict()
      }
    }
    const merged = slides.map((slide, index) => existing[index] || { title: slide.title, imagePath: null })
    for (const { index, image } of changes) merged[index] = image
    await tx.shodanPreparation.update({ where: { id, organizationId }, data: { slideImages: merged as any } })
    return merged
  })
}
