// Execute actual mounted confirmation flow, including actual PATCH with synthetic Prisma.
process.env.QUOTE_DOCUMENT_TEST_GROUP='confirmation'
require('./verify-quote-document-mounted.cjs')
