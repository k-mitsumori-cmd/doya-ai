'use strict'

const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')

const VERSION = '5.22.0'
const GENERATOR_SHA256 = '1697ccccd6b9ef9bfe00277ab8347d656080854d12680568940546e1ef4602ee'

function apply(environment = process.env, argv = process.argv, stdin = process.stdin) {
  // Prisma sets this flag on its forked generator, not on the CLI parent.
  if (environment.PRISMA_GENERATOR_INVOCATION !== 'true') return false
  if (environment.DOYA_PRISMA_GENERATOR_INVOCATION !== 'true') throw Error('Prisma generator started outside UTF-8 wrapper')
  const entry = argv[1]
  if (!entry) throw Error('Prisma generator entry missing')
  const root = environment.DOYA_PRISMA_GENERATE_ROOT
  if (!root || !path.isAbsolute(root)) throw Error('Prisma UTF-8 guard root missing')
  const requireFromRoot = createRequire(path.join(root, 'package.json'))
  const pkg = requireFromRoot('@prisma/client/package.json')
  const expected = fs.realpathSync(requireFromRoot.resolve('@prisma/client/generator-build'))
  const actual = fs.realpathSync(entry)
  if (pkg.version !== VERSION || actual !== expected ||
      crypto.createHash('sha256').update(fs.readFileSync(expected)).digest('hex') !== GENERATOR_SHA256) {
    throw Error('Unexpected Prisma generator entry for UTF-8 guard')
  }
  stdin.setEncoding('utf8')
  return true
}

apply()
module.exports = { apply }
