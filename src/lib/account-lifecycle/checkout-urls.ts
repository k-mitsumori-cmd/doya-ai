import type { CheckoutRecoveryBinding } from './checkout-receipt'

/** Versioned server recipe; never accepts a client-supplied full return URL. */
export function checkoutUrls(binding: CheckoutRecoveryBinding, planId: string, serviceId: string) {
  const base = binding.origin
  if (binding.recipe === 'hr') {
    return {
      successUrl: `${base}/hr/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${base}/hr/settings/billing`,
    }
  }
  if (binding.version === 2) {
    const success = new URL(binding.workingPath, base)
    const cancel = new URL(binding.returnPath || binding.workingPath, base)
    for (const key of ['success', 'plan', 'session_id', 'payment']) { success.searchParams.delete(key); cancel.searchParams.delete(key) }
    const planLabel = planId.includes('enterprise') ? 'enterprise' : planId.includes('light') ? 'light' : 'pro'
    const query = (url: URL) => url.search ? `${url.search}&` : '?'
    return {
      successUrl: `${success.origin}${success.pathname}${query(success)}success=true&plan=${planLabel}&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${cancel.origin}${cancel.pathname}${query(cancel)}payment=cancelled`,
    }
  }
  const path = binding.returnPath
  const segment = path?.split('/').filter(Boolean)[0]
  const home = !segment ? null : segment === 'pricing' || segment === 'all-in-one' ? '/' : segment === 'interview' ? '/interview/projects' : `/${segment}`
  const fallback = serviceId === 'seo' ? '/seo' : serviceId === 'banner' ? '/banner' : serviceId === 'interview' ? '/interview/projects' : '/'
  const cancel = `${path || (serviceId === 'seo' ? '/seo/pricing' : serviceId === 'banner' ? '/banner' : serviceId === 'interview' ? '/interview/projects' : '/pricing')}?payment=cancelled`
  const planLabel = planId.includes('enterprise') ? 'enterprise' : planId.includes('light') ? 'light' : 'pro'
  return {
    successUrl: `${base}${home || fallback}?success=true&plan=${planLabel}&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${base}${cancel}`,
  }
}
