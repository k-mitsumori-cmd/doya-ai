import SfaPricingClient from './PricingClient'

export default async function SfaPricingPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const value = Array.isArray(params.org) ? params.org[0] : params.org
  const org = value || null
  return <SfaPricingClient key={org ?? ''} org={org} />
}
