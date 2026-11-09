'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const PACKAGE_VERSION = '5.7.1';
const ORIGINAL_SHA = 'b6dba55f5577e18c9438238782000bbd95d36d45b036fdb065dd24ef66be41f3';
const PATCHED_SHA = '92965efe7055bc4dced4cc3f37183a760ec2536c400f062aa774aea434a9b436';
const ORIGINAL_FUNCTION = "function resolveWellKnownUri(uri) {\n  const parsed = url.parse(uri);\n  if (parsed.pathname.includes('/.well-known/')) {\n    return uri;\n  } else {\n    let pathname;\n    if (parsed.pathname.endsWith('/')) {\n      pathname = `${parsed.pathname}.well-known/openid-configuration`;\n    } else {\n      pathname = `${parsed.pathname}/.well-known/openid-configuration`;\n    }\n    return url.format({ ...parsed, pathname });\n  }\n}";
const PATCHED_FUNCTION = "function resolveWellKnownUri(uri) {\n  const parsed = new url.URL(uri);\n  if (parsed.pathname.includes('/.well-known/')) {\n    return uri;\n  }\n  parsed.pathname = parsed.pathname.endsWith('/')\n    ? `${parsed.pathname}.well-known/openid-configuration`\n    : `${parsed.pathname}/.well-known/openid-configuration`;\n  return parsed.href;\n}";
const sha = value => crypto.createHash('sha256').update(value).digest('hex');

/** Temporary version/source-pinned compatibility backport. Only discovery URL
 * resolution changes; provider config, metadata, token and claim checks remain
 * upstream code. Unknown distributions fail before any file is written. */
function applyToPackage(packageRoot) {
  if (fs.lstatSync(packageRoot).isSymbolicLink()) throw Error('OIDC_PATCH_PACKAGE_SYMLINK_REFUSED');
  const root = fs.realpathSync(packageRoot);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (pkg.name !== 'openid-client' || pkg.version !== PACKAGE_VERSION) throw Error('OIDC_PATCH_UNSUPPORTED_VERSION');
  const file = path.join(root, 'lib/issuer.js');
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw Error('OIDC_PATCH_SOURCE_SYMLINK_REFUSED');
  const source = fs.readFileSync(file, 'utf8'), before = sha(source);
  if (before === PATCHED_SHA) return { status: 'already_patched', version: pkg.version, sha256: before };
  if (before !== ORIGINAL_SHA) throw Error('OIDC_PATCH_UNKNOWN_SOURCE');
  const changed = source.replace(ORIGINAL_FUNCTION, PATCHED_FUNCTION);
  if (changed === source || sha(changed) !== PATCHED_SHA) throw Error('OIDC_PATCH_TRANSFORM_MISMATCH');
  const temporary = file + '.doya-compat-' + crypto.randomUUID();
  try {
    fs.writeFileSync(temporary, changed, { mode: stat.mode & 0o777, flag: 'wx' });
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
  if (sha(fs.readFileSync(file)) !== PATCHED_SHA) throw Error('OIDC_PATCH_WRITE_MISMATCH');
  return { status: 'patched', version: pkg.version, sha256: PATCHED_SHA };
}

function applyToProject(projectRoot) {
  const modules = path.join(projectRoot, 'node_modules');
  // Shared Codex/local dependency caches must never be edited by this hook.
  if (fs.lstatSync(modules).isSymbolicLink()) throw Error('OIDC_PATCH_SHARED_NODE_MODULES_REFUSED');
  const entry = require.resolve('openid-client', { paths: [projectRoot] });
  if (path.basename(entry) !== 'index.js' || path.basename(path.dirname(entry)) !== 'lib') throw Error('OIDC_PATCH_UNSUPPORTED_LAYOUT');
  return applyToPackage(path.dirname(path.dirname(entry)));
}
module.exports = { applyToPackage, applyToProject, PACKAGE_VERSION, ORIGINAL_SHA, PATCHED_SHA, ORIGINAL_FUNCTION, PATCHED_FUNCTION };
if (require.main === module) {
  try {
    console.log(JSON.stringify({ dependency: 'openid-client', ...applyToProject(path.resolve(__dirname, '../..')) }));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
