'use strict'

// Keep Prisma's generator input intact: the installed generator has a byline
// decoder that otherwise decodes each Buffer before a UTF-8 character is whole.
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { createRequire } = require('node:module')

const VERSION = '5.22.0'
const CLI_SHA256 = 'ff0102cdfadfecb884c5f0b6e43661f4ef2a31917dbfad3157236ba8e8532388'
const GENERATOR_SHA256 = '1697ccccd6b9ef9bfe00277ab8347d656080854d12680568940546e1ef4602ee'

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function installed(root) {
  const requireFromRoot = createRequire(path.join(root, 'package.json'))
  const cliPackage = requireFromRoot('prisma/package.json')
  const generatorPackage = requireFromRoot('@prisma/client/package.json')
  if (cliPackage.version !== VERSION || generatorPackage.version !== VERSION) {
    throw Error('Unexpected Prisma package version for UTF-8 generator guard')
  }
  const cli = fs.realpathSync(requireFromRoot.resolve('prisma/build/index.js'))
  const generator = fs.realpathSync(requireFromRoot.resolve('@prisma/client/generator-build'))
  if (sha256(cli) !== CLI_SHA256 || sha256(generator) !== GENERATOR_SHA256) {
    throw Error('Unexpected Prisma generator or CLI implementation for UTF-8 guard')
  }
  return { cli, generator }
}

function nodeOptionRequire(file, platform = process.platform) {
  if (/['"\r\n]/.test(file)) throw Error('Unsupported preload path for NODE_OPTIONS')
  const parsed = platform === 'win32' ? file.replaceAll('\\', '/') : file
  return `--require="${parsed}"`
}

function childEnvironment(root, preload, inherited = process.env) {
  const options = inherited.NODE_OPTIONS || ''
  return {
    ...inherited,
    NODE_OPTIONS: [options, nodeOptionRequire(preload)].filter(Boolean).join(' '),
    DOYA_PRISMA_GENERATOR_INVOCATION: 'true',
    DOYA_PRISMA_GENERATE_ROOT: root,
  }
}

function run(root = process.cwd(), inherited = process.env, spawn = spawnSync) {
  const absoluteRoot = fs.realpathSync(root)
  const { cli } = installed(absoluteRoot)
  const preload = fs.realpathSync(path.join(__dirname, 'generator-utf8-preload.cjs'))
  const result = spawn(process.execPath, [cli, 'generate'], {
    cwd: absoluteRoot,
    env: childEnvironment(absoluteRoot, preload, inherited),
    stdio: 'inherit',
    shell: false,
  })
  if (result.error) throw result.error
  return { status: result.status, signal: result.signal }
}

function propagate(result, kill = process.kill) {
  if (result.signal) {
    kill(process.pid, result.signal)
    return 1 // Signals that cannot be delivered must still fail closed.
  }
  return result.status === null ? 1 : result.status
}

if (require.main === module) {
  try {
    process.exitCode = propagate(run())
  } catch (error) {
    console.error('Prisma UTF-8 generator guard:', error.message)
    process.exitCode = 1
  }
}

module.exports = { VERSION, CLI_SHA256, GENERATOR_SHA256, installed, nodeOptionRequire, childEnvironment, run, propagate }
