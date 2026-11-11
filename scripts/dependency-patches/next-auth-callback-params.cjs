'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const version = '4.24.15';
const originalHash = '8557b986467642d843e492001a291f40f35a8ec70533e5a3a798dedb9aba0b57';
const patchedHash = '32d86533336a6344e07515c947b5c72342070cadf8ded6218ca6d169d17f353c';
const original = "    const params = {\n      ...client.callbackParams({\n        url: `http://n?${new URLSearchParams(query)}`,\n        body,\n        method\n      }),";
const replacement = "    // The callback query is already parsed by NextAuth. Reuse openid-client's\n    // form parser for its serialized parameters without building a legacy URL.\n    const callbackInput = method === \"GET\"\n      ? { url: \"http://n\", body: new URLSearchParams(query).toString(), method: \"POST\" }\n      : { url: \"http://n\", body, method };\n    const params = {\n      ...client.callbackParams(callbackInput),";
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

function patchNextAuthCallback(projectRoot) {
  const dependencies = path.join(projectRoot, 'node_modules');
  if (fs.lstatSync(dependencies).isSymbolicLink()) throw new Error('NEXT_AUTH_CALLBACK_SHARED_DEPENDENCIES');
  const root = path.join(dependencies, 'next-auth');
  if (fs.lstatSync(root).isSymbolicLink()) throw new Error('NEXT_AUTH_CALLBACK_PACKAGE_SYMLINK');
  const packageInfo = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (packageInfo.name !== 'next-auth' || packageInfo.version !== version) throw new Error('NEXT_AUTH_CALLBACK_UNSUPPORTED_VERSION');

  const file = path.join(root, 'core/lib/oauth/callback.js');
  const metadata = fs.lstatSync(file);
  if (!metadata.isFile() || fs.realpathSync(file) !== path.join(fs.realpathSync(root), 'core/lib/oauth/callback.js')) {
    throw new Error('NEXT_AUTH_CALLBACK_UNSUPPORTED_LAYOUT');
  }
  const source = fs.readFileSync(file, 'utf8');
  const hash = sha256(source);
  if (hash === patchedHash) return { status: 'already_patched', sha256: hash };
  if (hash !== originalHash) throw new Error('NEXT_AUTH_CALLBACK_UNKNOWN_SOURCE');

  const patched = source.replace(original, replacement);
  if (sha256(patched) !== patchedHash) throw new Error('NEXT_AUTH_CALLBACK_PATCH_MISMATCH');
  const temporary = file + '.doya-compat-' + crypto.randomUUID();
  try {
    fs.writeFileSync(temporary, patched, { mode: metadata.mode & 0o777, flag: 'wx' });
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
  return { status: 'patched', sha256: patchedHash };
}

module.exports = { patchNextAuthCallback };
if (require.main === module) {
  try {
    console.log(JSON.stringify({ dependency: 'next-auth', ...patchNextAuthCallback(path.resolve(__dirname, '../..')) }));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
