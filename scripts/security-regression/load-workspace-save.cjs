// Load the real receipt purge while keeping unrelated workspace writers unavailable.
module.exports = function loadWorkspaceSave(load) {
  const unused = new Proxy({}, { get(_target, property) { throw Error(`Unexpected workspace dependency: ${String(property)}`) } });
  return load('src/lib/tenjikai/workspace-save.ts', {
    'node:crypto': require('node:crypto'),
    '@prisma/client': { Prisma: unused },
    '@/lib/prisma': { prisma: unused },
    './project-revision': unused,
    './workspace-store': unused,
  });
};
