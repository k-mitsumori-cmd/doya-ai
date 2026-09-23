/** 全構成に画像が揃ったときだけ、欠落のないPDF用配列を返す。 */
export function completeSlideImages<T extends { imageUrl: string | null }>(
  slides: unknown[] | null | undefined,
  images: T[] | null | undefined,
): T[] {
  if (!Array.isArray(slides) || !slides.length) throw new Error('先に提案資料の構成を生成してください。')
  if (!Array.isArray(images) || images.length !== slides.length || images.some((image) => typeof image?.imageUrl !== 'string' || !image.imageUrl.trim())) {
    throw new Error('未生成のスライドがあります。商談準備ページで画像生成を完了してからPDFを作成してください。')
  }
  return images.slice()
}
