import type { PrismaClient } from '@prisma/client'

export class CheckoutReservationError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string) {
    super(message)
  }
}

/** @deprecated Kept for source compatibility; the v1 writer is closed in this binary. */
export async function createReservedCheckoutSession<T extends { id: string; url: string | null; expires_at?: number }>(
  _options: {
    userId: string
    signatureParts: unknown
    create: (idempotencyKey: string, expiresAt: number) => Promise<T>
  },
  _db?: Pick<PrismaClient, 'systemSetting'>,
  _retrieve?: (sessionId: string) => Promise<unknown>,
): Promise<{ id: string; url: string }> {
  throw new CheckoutReservationError('CHECKOUT_LEGACY_ENTRY_CLOSED', 503,
    '旧版の決済作成入口は停止しています。申込状況を確認してください。')
}
