export interface QuoteDetailLine {
  id: string; itemName: string; spec: string | null; qty: number; unit: string; unitPrice: number; taxRate: number
  priceSource: string; sourceRef: string | null; rangeMin: number | null; rangeMax: number | null
}
export interface QuoteDetailDocument {
  id: string; quoteNo: string; title: string | null; status: string; clientCompany: string | null; clientDept: string | null; clientPerson: string | null
  issueDate: string; expiryDate: string; paymentTerms: string | null; deliveryTerms: string | null; notes: string | null
  discountType: string | null; discountValue: number; totalExclTax: number; taxAmount: number; totalInclTax: number; lineItems: QuoteDetailLine[]
}
export interface QuoteDetailDraft {
  items: QuoteDetailLine[]; clientCompany: string; clientPerson: string; discountType: string; discountValue: string
  notes: string; paymentTerms: string; deliveryTerms: string
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown, max: number) => typeof v === 'string' && v.length <= max
const nullableText = (v: unknown, max: number) => v === null || text(v, max)
const integer = (v: unknown, min = 0) => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= 2147483647
const safeId = (v: unknown) => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(v)
const sources = ['own_price','market','competitor','manual','ai_estimate','unknown']
export function isQuoteDetailLine(v: unknown): v is QuoteDetailLine {
  if (!record(v)) return false
  return safeId(v.id) && text(v.itemName,200) && !!v.itemName && nullableText(v.spec,1000) && text(v.unit,12)
    && integer(v.qty,1) && integer(v.unitPrice) && [8,10].includes(v.taxRate as number) && sources.includes(v.priceSource as string)
    && nullableText(v.sourceRef,1000) && (v.rangeMin === null || integer(v.rangeMin)) && (v.rangeMax === null || integer(v.rangeMax))
    && !(typeof v.rangeMin === 'number' && typeof v.rangeMax === 'number' && v.rangeMin > v.rangeMax)
}
export function parseQuoteDetailDocument(v: unknown, id: string): QuoteDetailDocument {
  if (!record(v) || !safeId(v.id) || v.id !== id || !text(v.quoteNo,200) || !v.quoteNo || !nullableText(v.title,200)
      || !['draft','confirmed','sent'].includes(v.status as string)
      || ![v.issueDate,v.expiryDate].every(d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(d) && Number.isFinite(Date.parse(d)))
      || !['clientCompany','clientDept','clientPerson'].every(f => nullableText(v[f],200))
      || !['paymentTerms','deliveryTerms','notes'].every(f => nullableText(v[f],2000))
      || ![null,'rate','amount'].includes(v.discountType as string | null) || !integer(v.discountValue)
      || v.discountType === 'rate' && (v.discountValue as number) > 100
      || !['totalExclTax','taxAmount','totalInclTax'].every(f => integer(v[f]))
      || !Array.isArray(v.lineItems) || v.lineItems.length > 60 || !v.lineItems.every(isQuoteDetailLine)
      || new Set(v.lineItems.map(i => i.id)).size !== v.lineItems.length) throw new Error('見積書の内容を確認できませんでした。再読み込みしてください。')
  return v as unknown as QuoteDetailDocument
}
export function quoteDraftFromDocument(doc: QuoteDetailDocument): QuoteDetailDraft {
  return { items: doc.lineItems.map(i=>({...i})), clientCompany:doc.clientCompany||'', clientPerson:doc.clientPerson||'', discountType:doc.discountType||'',
    discountValue:doc.discountValue?String(doc.discountValue):'', notes:doc.notes||'', paymentTerms:doc.paymentTerms||'', deliveryTerms:doc.deliveryTerms||'' }
}
export function quoteDocumentWrite(doc: QuoteDetailDocument, draft: QuoteDetailDraft, status?: string) {
  if (status !== undefined && !['draft','confirmed','sent'].includes(status)) throw new Error('承認状態を確認してください')
  if (doc.status !== 'draft') {
    if (!status || !['draft','sent'].includes(status)) throw new Error('下書きに戻してから編集してください')
    return { status }
  }
  if (!text(draft.clientCompany,200) || !text(draft.clientPerson,200) || !['notes','paymentTerms','deliveryTerms'].every(f=>text(draft[f as keyof QuoteDetailDraft],2000))
      || !['','rate','amount'].includes(draft.discountType) || draft.discountValue && !/^\d+$/.test(draft.discountValue)
      || !integer(Number(draft.discountValue||0)) || draft.discountType==='rate' && Number(draft.discountValue)>100
      || draft.items.length>60 || !draft.items.every(isQuoteDetailLine)) throw new Error('入力内容・文字数・金額を確認してください。変更は保存されていません。')
  return { clientCompany:draft.clientCompany, clientPerson:draft.clientPerson, discountType:draft.discountType||null, discountValue:Number(draft.discountValue||0),
    notes:draft.notes, paymentTerms:draft.paymentTerms, deliveryTerms:draft.deliveryTerms,
    items:draft.items.map(({itemName,spec,qty,unit,unitPrice,taxRate,priceSource,sourceRef,rangeMin,rangeMax})=>({itemName,spec,qty,unit,unitPrice,taxRate,priceSource,sourceRef,rangeMin,rangeMax})),
    ...(status ? {status}:{}),
  }
}
export function isQuoteDocumentWriteAcknowledgement(doc: QuoteDetailDocument, sent: ReturnType<typeof quoteDocumentWrite>) {
  if (doc.status !== ('status' in sent && sent.status || 'draft')) return false
  if (!('items' in sent) || !sent.items) return true
  for (const field of ['clientCompany','clientPerson','notes','paymentTerms','deliveryTerms'] as const) {
    const value = sent[field]
    if (doc[field] !== (value == null || value.trim()==='' ? null : value)) return false
  }
  if (doc.discountType !== sent.discountType || doc.discountValue !== sent.discountValue || doc.lineItems.length !== sent.items.length) return false
  return sent.items.every((item,index)=>{
    const row=doc.lineItems[index]
    return Object.keys(item).every(k=>{
      const key=k as keyof typeof item; const v=item[key]
      const normalized = key==='spec'||key==='sourceRef' ? v||null : key==='unit' ? v||'式' : v
      return row[key]===normalized
    })
  })
}

export function quoteDocumentDraftMatches(doc: QuoteDetailDocument, draft: QuoteDetailDraft) {
  try {
    const editable = { ...doc, status: 'draft' }
    return isQuoteDocumentWriteAcknowledgement(editable, quoteDocumentWrite(editable, draft))
  } catch { return false }
}
