// テスト用の、メモリの上だけの DB（Prisma のクライアントのうち、ドヤパワーの台帳が使う形だけ）。
// - unique 制約（違反は code: 'P2002' の例外）と、$transaction の取り消し（例外のとき元に戻す）と、直列化をまねる
// - 本番では使わない（src/lib/doya-power/index.ts は本物の prisma を使う）

type Row = Record<string, any>
type Model = { rows: Row[]; unique: string[][] }
export type MemoryCall = { model: string; op: string; args: any }

const MODELS: Record<string, string[][]> = {
  accountCompany: [['id'], ['userId']],
  doyaPowerAccount: [['id'], ['companyId']],
  doyaPowerGrant: [['id'], ['accountId', 'sourceKey']],
  doyaPowerTransaction: [['id'], ['operationId'], ['refundOf']],
}

function matchValue(v: any, cond: any): boolean {
  if (cond !== null && typeof cond === 'object' && !(cond instanceof Date) && !Array.isArray(cond)) {
    for (const [op, x] of Object.entries(cond)) {
      const a = v instanceof Date ? v.getTime() : v
      const b = x instanceof Date ? (x as Date).getTime() : x
      if (op === 'equals' && a !== b) return false
      if (op === 'not' && a === b) return false
      if (op === 'in' && !(x as any[]).includes(v)) return false
      if (op === 'gt' && !(a > (b as any))) return false
      if (op === 'gte' && !(a >= (b as any))) return false
      if (op === 'lt' && !(a < (b as any))) return false
      if (op === 'lte' && !(a <= (b as any))) return false
    }
    return true
  }
  const a = v instanceof Date ? v.getTime() : v
  const b = cond instanceof Date ? cond.getTime() : cond
  return (a ?? null) === (b ?? null)
}

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([k, cond]) => {
    if (k.includes('_') && cond && typeof cond === 'object' && !(cond instanceof Date)) return matches(row, cond) // 複合の unique（accountId_sourceKey）
    return matchValue(row[k], cond)
  })
}

const clone = <T>(v: T): T => (v === null || v === undefined ? v : structuredClone(v))

export function createMemoryDb(options: { now?: () => Date } = {}) {
  const now = options.now ?? (() => new Date())
  const models: Record<string, Model> = Object.fromEntries(Object.entries(MODELS).map(([k, u]) => [k, { rows: [], unique: u }]))
  const calls: MemoryCall[] = []
  let seq = 0
  let queue: Promise<unknown> = Promise.resolve()

  function checkUnique(name: string, candidate: Row, self?: Row) {
    for (const keys of models[name].unique) {
      if (keys.some((k) => candidate[k] === null || candidate[k] === undefined)) continue
      const clash = models[name].rows.find((r) => r !== self && keys.every((k) => r[k] === candidate[k]))
      if (clash) throw Object.assign(new Error(`Unique constraint failed on ${name}(${keys.join(',')})`), { code: 'P2002' })
    }
  }
  function applyData(row: Row, data: Row) {
    const next = { ...row }
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v) && ('increment' in v || 'decrement' in v)) {
        next[k] = (next[k] ?? 0) + ((v as any).increment ?? 0) - ((v as any).decrement ?? 0)
      } else next[k] = v
    }
    if ('updatedAt' in next) next.updatedAt = now()
    return next
  }

  function delegate(name: string) {
    const m = models[name]
    const log = (op: string, args: any) => calls.push({ model: name, op, args: clone(args) })
    return {
      findUnique: async (args: any) => {
        log('findUnique', args)
        return clone(m.rows.find((r) => matches(r, args.where)) ?? null)
      },
      findFirst: async (args: any) => {
        log('findFirst', args)
        return clone(m.rows.find((r) => matches(r, args?.where)) ?? null)
      },
      findMany: async (args: any = {}) => {
        log('findMany', args)
        return clone(m.rows.filter((r) => matches(r, args.where)))
      },
      create: async (args: any) => {
        log('create', args)
        const t = now()
        const row: Row = { id: `${name}_${++seq}`, createdAt: t, ...(name === 'doyaPowerTransaction' || name === 'doyaPowerGrant' ? {} : { updatedAt: t }), ...clone(args.data) }
        for (const k of ['operationId', 'refundOf', 'grantId', 'allocations', 'note', 'sourceKey', 'expiresAt']) if (name === 'doyaPowerTransaction' || name === 'doyaPowerGrant') row[k] ??= null
        checkUnique(name, row)
        m.rows.push(row)
        return clone(row)
      },
      update: async (args: any) => {
        log('update', args)
        const i = m.rows.findIndex((r) => matches(r, args.where))
        if (i < 0) throw Object.assign(new Error('Record to update not found'), { code: 'P2025' })
        const next = applyData(m.rows[i], args.data)
        checkUnique(name, next, m.rows[i])
        m.rows[i] = next
        return clone(next)
      },
      updateMany: async (args: any) => {
        log('updateMany', args)
        let count = 0
        m.rows.forEach((r, i) => {
          if (!matches(r, args.where)) return
          m.rows[i] = applyData(r, args.data)
          count++
        })
        return { count }
      },
    }
  }

  const client: any = Object.fromEntries(Object.keys(MODELS).map((k) => [k, delegate(k)]))
  client.$transaction = (fn: (tx: any) => Promise<any>) => {
    // 直列に1つずつ実行し、例外のときは中で書いたものを全部取り消す
    const run = async () => {
      const snapshot = Object.fromEntries(Object.entries(models).map(([k, v]) => [k, structuredClone(v.rows)]))
      try {
        return await fn(client)
      } catch (e) {
        for (const [k, rows] of Object.entries(snapshot)) models[k].rows = rows
        throw e
      }
    }
    const p = queue.then(run, run)
    queue = p.catch(() => undefined)
    return p
  }
  return { db: client, models, calls, rows: (name: string) => models[name].rows }
}
