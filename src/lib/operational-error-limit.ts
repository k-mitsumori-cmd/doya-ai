import { randomUUID } from 'node:crypto';
import { prisma } from './prisma';

export type ClientErrorPlatform = 'browser' | 'native' | 'heisha';
export type ClientErrorKind = 'javascript' | 'render' | 'promise';
const recent = new Map<string, number>();
let unavailableUntil = 0;

/** Low-trust client reports: nine fixed DB keys, shared across every deployment. */
export async function claimClientErrorReport(platform: ClientErrorPlatform, kind: ClientErrorKind): Promise<'allowed' | 'limited' | 'unavailable'> {
  if (!['browser', 'native', 'heisha'].includes(platform) || !['javascript', 'render', 'promise'].includes(kind)) return 'limited';
  const key = `client-error:v1:${platform}:${kind}`;
  const now = Date.now();
  if (unavailableUntil > now) return 'unavailable';
  if ((recent.get(key) ?? 0) > now) return 'limited';
  // This is an intake budget, not a delivery receipt: failed deliveries do not
  // release it and let a caller amplify retries. Server failures use a separate path.
  try {
    const claimed = await prisma.$queryRaw<Array<{ key: string }>>`
      INSERT INTO "SystemSetting" ("id", "key", "value")
      VALUES (${randomUUID()}, ${key}, (CURRENT_TIMESTAMP + INTERVAL '10 minutes')::text)
      ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value"
      WHERE "SystemSetting"."value"::timestamptz <= CURRENT_TIMESTAMP
      RETURNING "key"
    `;
    recent.set(key, now + (claimed.length ? 600000 : 10000));
    return claimed.length ? 'allowed' : 'limited';
  } catch {
    unavailableUntil = now + 30000;
    // Do not serialize DB errors or report client-controlled traffic as a server error.
    console.warn('[operational-error] shared intake limit unavailable');
    return 'unavailable';
  }
}
