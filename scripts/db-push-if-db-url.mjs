// Retired: never infer authorization to change a database from environment variables.
// Keep this entry point so old automation fails explicitly instead of reporting success.
console.error('[db-push] This automatic database synchronization script is retired. Apply reviewed SQL separately before deploying code. See reference/07-dev-guide.md.')
process.exitCode = 1
