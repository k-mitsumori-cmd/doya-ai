import { AsyncLocalStorage } from 'node:async_hooks'
import { prisma as basePrisma } from '@/lib/prisma'
import { SeoJobExecution, withSeoJobExecution } from '@seo/lib/job-execution'

export const seoExecutionContext = new AsyncLocalStorage<SeoJobExecution>()
const writes = new Set(['create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'updateManyAndReturn', 'upsert', 'delete', 'deleteMany'])

/** Only pipeline imports this client; each mutation is fenced in a short DB transaction. */
export const executionPrisma = new Proxy(basePrisma, {
  get(client, model: string) {
    const delegate = (client as any)[model]
    if (!delegate || typeof delegate !== 'object' || model.startsWith('$')) {
      return typeof delegate === 'function' ? delegate.bind(client) : delegate
    }
    return new Proxy(delegate, {
      get(target, operation: string) {
        const method = target[operation]
        if (typeof method !== 'function') return method
        return (...args: any[]) => {
          const execution = seoExecutionContext.getStore()
          if (!execution || !writes.has(operation)) return method.apply(target, args)
          return withSeoJobExecution(execution, tx => (tx as any)[model][operation](...args))
        }
      },
    })
  },
})

/** Refuse a new provider request after execution expiry/invalidation; in-flight calls may still finish. */
export function executionChecked<T extends (...args: any[]) => any>(fn: T): T {
  return (async (...args: any[]) => {
    const execution = seoExecutionContext.getStore()
    if (execution) await withSeoJobExecution(execution, async () => undefined)
    return fn(...args)
  }) as T
}
