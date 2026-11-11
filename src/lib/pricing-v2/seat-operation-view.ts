import { teamMonthly, teamMonthlyPoints } from './plans'
import { isValidOperationKey } from './team'

/** Owner-only status. Never includes Stripe IDs, its idempotency key, customer
 * data, worker token, invoice evidence, or another company's information.
 */
export type PendingSeatChange = {
  operationKey: string
  requested: number
  previousSeats: number | null
  action: 'wait' | 'resume' | 'check'
}
export type TeamSeatsView =
  | { kind: 'pending'; pending: PendingSeatChange }
  | { kind: 'ready'; seats: number; used: number; interval: 'month' | 'year'; /** 1人いくらの契約のときだけ true（基本料ありの契約では付けない） */ perSeat?: true }

const seats = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 49
const record = (x: unknown): Record<string, unknown> | null => x !== null && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : null

export function parseTeamSeatsView(value: unknown): TeamSeatsView | null {
  const data = record(value)
  if (!data) return null
  if (data.pending !== undefined && data.pending !== null) {
    const pending = record(data.pending)
    if (!pending || !isValidOperationKey(pending.operationKey) || !seats(pending.requested) ||
      !(pending.previousSeats === null || seats(pending.previousSeats)) || !['wait', 'resume', 'check'].includes(String(pending.action))) return null
    return { kind: 'pending', pending: { operationKey: pending.operationKey, requested: pending.requested,
      previousSeats: pending.previousSeats, action: pending.action as PendingSeatChange['action'] } }
  }
  // 料金の形は、サーバーが契約の価格から決めて渡す（1人いくらの契約だけ perSeat: true）
  const model = data.perSeat === true ? 'per_seat' as const : 'base_plus_seat' as const
  if (!seats(data.seats) || typeof data.used !== 'number' || !Number.isSafeInteger(data.used) || data.used < 1 ||
    !['month', 'year'].includes(String(data.interval)) || data.monthly !== teamMonthly(data.seats, model) || data.points !== teamMonthlyPoints(data.seats, model)) return null
  // Historical over-capacity is displayable so the owner can correct it. The
  // server remains the authority for admitting members or changing quantities.
  return { kind: 'ready', seats: data.seats, used: data.used, interval: data.interval as 'month' | 'year', ...(model === 'per_seat' ? { perSeat: true as const } : {}) }
}
