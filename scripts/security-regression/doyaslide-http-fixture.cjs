const { load } = require('./load-typescript.cjs')
const { NextRequest, NextResponse } = require('next/server')
class DoyaSlideOperationError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code }
}
module.exports = function fixture(kind, mode = 'empty') {
  const calls = { ownerReads: 0, operations: [] }
  const http = load('src/lib/doyaslide/generation-http.ts', {
    'next/server': { NextResponse },
    '@/lib/prisma': { prisma: { doyaSlideSlide: { findFirst: async ({ where }) => {
      calls.ownerReads++; if (where.id !== 'slide' || where.project.userId !== 'actor') throw Error('Unscoped ownership query')
      return mode === 'foreign' ? null : { projectId: 'project' }
    } } } },
    '@/lib/doyaslide/access': { getUserId: async () => mode === 'anonymous' ? null : 'actor' },
    '@/lib/doyaslide/generation-operation': { DoyaSlideOperationError, recoverDoyaSlideOperation: async () => { throw Error('Unexpected recovery') } },
    '@/lib/doyaslide/generation-worker': { runDoyaSlideOperation: async input => {
      calls.operations.push(input)
      if (mode === 'outage') throw Error('Synthetic private detail')
      if (mode === 'conflict') throw new DoyaSlideOperationError(409, 'PROJECT_CHANGED', '資料が変更されました。')
      return mode === 'limit' ? { state: 'limit', limit: 20 } : { state: 'empty' }
    } },
    '@/lib/doyaslide/limits': { quotaExceededPayload: limit => ({ code: 'LIMIT_REACHED', limit, error: '上限です', upgradeUrl: '/doyaslide/pricing' }) },
  }, { setTimeout, clearTimeout, TextDecoder })
  const route = load(kind === 'batch' ? 'src/app/api/doyaslide/generate/route.ts' : `src/app/api/doyaslide/slides/[id]/${kind}/route.ts`, { '@/lib/doyaslide/generation-http': http })
  return { calls, route, post: body => route.POST(new NextRequest('https://local.test/legacy', { method: 'POST', ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) }), { params: Promise.resolve({ id: 'slide' }) }) }
}
