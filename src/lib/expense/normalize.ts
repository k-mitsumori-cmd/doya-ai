// 取引先名の正規化（照合用）。会社の種類・空白・記号を除き、全角英数を半角にそろえる。
export function normalizeVendorName(name: string): string {
  return name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/株式会社|有限会社|合同会社|一般社団法人|\(株\)|（株）|\(有\)|（有）|inc\.?|co\.,?\s*ltd\.?|llc|corp\.?|corporation/g, '')
    .replace(/[\s　・.,，、\-_'"]/g, '')
}
