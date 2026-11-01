import { readPreparation, type Preparation } from './preparation-response'
export const slideStructure = (p: Preparation) => JSON.stringify(p.slidesJson || [])
export const slideSlotKey = (p: Preparation, index: number) => JSON.stringify([index,p.slidesJson?.[index]])
export function readSlideEditor(data: unknown, id: string) {
  const prep = readPreparation(data, id), slides = prep.slidesJson || [], images = prep.slideImages || []
  if (new Date(prep.updatedAt).toISOString() !== prep.updatedAt || images.length > slides.length || images.some((image,index)=>image.title !== slides[index]?.title)) throw new Error('資料の構成と画像が一致しません。保存内容を再読み込みしてください。')
  return prep
}
export function readRegeneratedSlide(data: unknown, prep: Preparation, index: number) {
  const ack = data as { success?: unknown; data?: { preparationId?: unknown; index?: unknown; image?: { title?: unknown; imageKey?: unknown } } }
  const key = ack?.data?.image?.imageKey
  if (ack?.success !== true || ack.data?.preparationId !== prep.id || ack.data.index !== index || ack.data.image?.title !== prep.slidesJson?.[index]?.title || typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key)) throw new Error('再生成の保存結果を確認できませんでした。重ねて送信せず、保存内容をご確認ください。')
  return key
}
