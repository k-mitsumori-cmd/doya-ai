// Actual evaluation helpers with explicitly supplied synthetic persistence only.
const { load } = require('./load-typescript.cjs');
function evaluationDependencies(prisma) {
  const scope = load('src/lib/hr/evaluation-scope.ts');
  const input = load('src/lib/hr/evaluation-input.ts');
  const access = load('src/lib/hr/evaluation-access.ts', { '@/lib/hr/evaluation-scope': scope, '@/lib/prisma': { prisma } });
  const orm = { Prisma: require('@prisma/client').Prisma };
  const aiAccess = load('src/lib/hr/evaluation-ai-access.ts', { '@prisma/client': orm, '@/lib/hr/evaluation-access': access, '@/lib/hr/evaluation-input': input });
  const creation = load('src/lib/hr/evaluation-creation-operation.ts', { 'node:crypto': require('node:crypto'), '@/lib/hr/evaluation-scope': scope, '@/lib/hr/evaluation-input': input });
  const save = load('src/lib/hr/evaluation-save-operation.ts', { 'node:crypto': require('node:crypto'), '@/lib/hr/evaluation-ai-access': aiAccess });
  const periodInput = load('src/lib/hr/evaluation-period-input.ts', { '@/lib/hr/types': load('src/lib/hr/types.ts') });
  const periodDeps = {};
  for (const name of ['operation', 'creation-operation', 'delete', 'overview', 'list']) periodDeps['@/lib/hr/evaluation-period-' + name] = load('src/lib/hr/evaluation-period-' + name + '.ts', { 'node:crypto': require('node:crypto'), '@/lib/hr/evaluation-input': input, '@/lib/hr/evaluation-scope': scope, '@/lib/hr/evaluation-access': access });
  return { ...periodDeps, '@/lib/hr/evaluation-period-input': periodInput, '@prisma/client': orm, '@/lib/private-api-response': load('src/lib/private-api-response.ts', { 'next/server': { NextResponse: Response } }), '@/lib/hr/evaluation-scope': scope, '@/lib/hr/evaluation-input': input, '@/lib/hr/evaluation-access': access, '@/lib/hr/evaluation-ai-access': aiAccess, '@/lib/hr/evaluation-creation-operation': creation, '@/lib/hr/evaluation-save-operation': save, '@/lib/hr/evaluation-mutation': load('src/lib/hr/evaluation-mutation.ts') };
}
module.exports = { evaluationDependencies };
