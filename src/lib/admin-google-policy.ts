/** The same exact domain policy is used by the server and the login UI. */
export function isAdminGoogleEmail(email: unknown): email is string {
  return typeof email === 'string' && /^[^@\s]+@surisuta\.jp$/i.test(email)
}
