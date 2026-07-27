// ============================================
// HubSpot CRM APIクライアント（Private Appトークン）
// ============================================
// Marketing Starter は Workflows/Webhook送信が使えないため、
// ドヤマーケ側のcron（/api/cron/hubspot-sync）がこのクライアントで
// 新規コンタクトをポーリング取得してドリップへ自動エンロールする。
// 必要スコープ: crm.objects.contacts.read

const HUBSPOT_API = 'https://api.hubapi.com'

export interface HubSpotContact {
  id: string
  email: string | null
  firstname: string | null
  lastname: string | null
  company: string | null
  phone: string | null
  createdAt: string | null // ISO8601
}

export function hubspotConfigured(): boolean {
  return !!process.env.HUBSPOT_PRIVATE_APP_TOKEN
}

/**
 * createdate が sinceMs より後に作成されたコンタクトを昇順で取得する。
 * @param sinceMs 取得基準（epoch millis）。これより後に作成されたものだけ返す。
 * @param maxPages 取りすぎ防止の上限（1ページ=最大100件）
 */
export async function fetchContactsCreatedAfter(
  sinceMs: number,
  maxPages = 20
): Promise<HubSpotContact[]> {
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN
  if (!token) return []

  const out: HubSpotContact[] = []
  let after: string | undefined

  for (let page = 0; page < maxPages; page++) {
    const body: Record<string, unknown> = {
      filterGroups: [
        { filters: [{ propertyName: 'createdate', operator: 'GT', value: String(sinceMs) }] },
      ],
      sorts: [{ propertyName: 'createdate', direction: 'ASCENDING' }],
      properties: ['email', 'firstname', 'lastname', 'company', 'phone', 'createdate'],
      limit: 100,
    }
    if (after) body.after = after

    const res = await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts/search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`HubSpot search failed: ${res.status} ${text.slice(0, 300)}`)
    }

    const data = (await res.json()) as {
      results?: Array<{ id: string; properties?: Record<string, string | null>; createdAt?: string }>
      paging?: { next?: { after?: string } }
    }

    for (const r of data.results ?? []) {
      const p = r.properties ?? {}
      out.push({
        id: r.id,
        email: p.email ?? null,
        firstname: p.firstname ?? null,
        lastname: p.lastname ?? null,
        company: p.company ?? null,
        phone: p.phone ?? null,
        createdAt: p.createdate ?? r.createdAt ?? null,
      })
    }

    after = data.paging?.next?.after
    if (!after) break
  }

  return out
}
