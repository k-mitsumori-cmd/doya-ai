/** New binaries must never enter a v1 Checkout writer or raw Session creator. */
export class LegacyCheckoutClosedError extends Error {
  readonly code = 'CHECKOUT_LEGACY_ENTRY_CLOSED'
  readonly status = 503

  constructor() {
    super('旧版の決済作成入口は停止しています。申込状況を確認してください。')
  }
}

export function rejectLegacyCheckout(): never {
  throw new LegacyCheckoutClosedError()
}
