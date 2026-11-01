/** Minimal metadata fixture only. Native IndexedDB transaction/renderer behavior is verified separately in Chrome. */
const databases = new WeakMap()
module.exports = function syntheticIndexedDB(scope = new Map()) {
  let rows = databases.get(scope)
  if (!rows) { rows = new Map(); databases.set(scope, rows) }
  return { open() {
    const request = {}
    queueMicrotask(() => {
      request.result = { close() {}, transaction() {
        let aborted = false
        const draft = new Map(rows)
        const transaction = {
          abort() { if (aborted) return; aborted = true; queueMicrotask(() => transaction.onabort?.()) },
          objectStore() { return {
            get(key) {
              const read = {}
              queueMicrotask(() => {
                if (aborted) return
                read.result = draft.get(key)
                read.onsuccess?.()
                queueMicrotask(() => {
                  if (aborted) return
                  rows.clear(); for (const [key, value] of draft) rows.set(key, value)
                  transaction.oncomplete?.()
                })
              })
              return read
            },
            put(value, key) { if (aborted) throw Error('Transaction aborted'); draft.set(key, structuredClone(value)) },
          } },
        }
        return transaction
      } }
      request.onsuccess?.()
    })
    return request
  } }
}
