/** Legacy unscoped records have no verifiable owner. Never import them on login. */
export function personaBrowserStorage(userId: string) {
  if (!userId.trim()) throw new Error('Persona storage requires an account')
  const key = (name: string) => `persona:v2:${encodeURIComponent(userId)}:${name}`
  return {
    isKey: (eventKey: string | null, name: string) => eventKey === key(name),
    getItem: (name: string) => window.localStorage.getItem(key(name)),
    setItem: (name: string, value: string) => window.localStorage.setItem(key(name), value),
    removeItem: (name: string) => window.localStorage.removeItem(key(name)),
  }
}
