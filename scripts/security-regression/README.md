# Security regression checks

Run `npm ci`, then `npm run test:security` from the repository root.

These tests use mock DNS, HTTP, AI, database and Slack adapters. They do not generate paid content, send notifications or modify production data. The OAuth test runs the installed NextAuth callback implementation with its external dependencies replaced.

The suite checks dependency version floors, the distinction between deprecations and real errors, OAuth refusal logging, authenticated ad-image recovery and usage reservations, shared client-report limits, private-address rejection, DNS pinning, redirect validation and response limits.

Keep these tests in every production release. A failed check must stop the build. Do not remove tests or lower dependency floors to make an older checkout deployable. Production builds generate the Prisma client but must not run `prisma db push`.

Passing the suite is regression evidence for these paths, not a claim that every application route or dependency has no vulnerabilities. Browser error reports remain unauthenticated observations, even with a shared intake limit. External website availability and paid end-to-end generation require separate operational verification.
