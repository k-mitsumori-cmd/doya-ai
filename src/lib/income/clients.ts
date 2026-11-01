// ============================================
// ドヤ収入管理: 取引先の入力
// ============================================
import { asBody, bool, email, kana, paymentTerms, reqStr, str } from './parse'

export function parseClient(raw: unknown) {
  const body = asBody(raw)
  const corporateNumber = str(body, 'corporateNumber', '法人番号', { max: 13 })
  const terms = paymentTerms(body)
  return {
    name: reqStr(body, 'name', '取引先名', 120),
    corporateNumber,
    postalCode: str(body, 'postalCode', '郵便番号', { max: 10 }),
    address: str(body, 'address', '住所', { max: 300 }),
    billingDepartment: str(body, 'billingDepartment', '部署', { max: 100 }),
    billingContactName: str(body, 'billingContactName', '請求先の担当者', { max: 60 }),
    billingEmail: email(body, 'billingEmail', '請求先のメール'),
    payerNameKana: kana(body, 'payerNameKana', '振込名義'),
    closingDay: terms.closingDay,
    paymentMonths: terms.paymentMonths,
    paymentDay: terms.paymentDay,
    note: str(body, 'note', 'メモ', { max: 2000 }),
    isActive: bool(body, 'isActive', true),
  }
}
