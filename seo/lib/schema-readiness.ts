import { Prisma } from '@prisma/client'

// Generated Prisma metadata keeps this check aligned with the deployed client.
const requirements = Prisma.dmmf.datamodel.models.filter(model => model.name.startsWith('Seo')).map(model => ({
  table: model.dbName ?? model.name,
  columns: model.fields.filter(field => field.kind !== 'object').map(field => field.dbName ?? field.name),
}))

/** Checks presence only. Types, constraints, indexes and backfills remain release gates. */
export async function inspectSeoSchema(db: Pick<Prisma.TransactionClient, '$queryRaw'>) {
  const tables = requirements.map(model => model.table)
  const columns = await db.$queryRaw<{ table_name: string; column_name: string }[]>`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = ANY(${tables}::text[])`
  const present = new Set(columns.map(column => JSON.stringify([column.table_name, column.column_name])))
  const missing = requirements.flatMap(model => model.columns
    .filter(column => !present.has(JSON.stringify([model.table, column])))
    .map(column => ({ table: model.table, column })))
  return { ready: missing.length === 0, missing, tables: requirements.length, columns: requirements.reduce((sum, model) => sum + model.columns.length, 0) }
}
