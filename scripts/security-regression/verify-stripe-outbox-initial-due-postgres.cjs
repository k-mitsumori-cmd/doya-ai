// Real PostgreSQL; application time intentionally trails the database.
// Providers and notification transport stay synthetic; no application env is read.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { root, seatSourcePath, evidenceDir } = require('./seat-regression-support.cjs');
const { load } = require('./load-typescript.cjs');
const { PrismaClient } = require(root + '/node_modules/@prisma/client');
const privateEnv = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const privateState = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const url = new URL(privateEnv.DATABASE_URL);
assert(['localhost', '127.0.0.1'].includes(url.hostname));
assert(url.searchParams.get('host') === privateState.socket);
assert(privateState.socket.startsWith('/tmp/doya-'));
assert(/^\/doya_seat_models_[0-9]+$/.test(url.pathname));
const db = new PrismaClient({ datasources: { db: { url: privateEnv.DATABASE_URL } } });
let appNow = Date.now() - 5000;
class AppDate extends Date {
  constructor(...args) {
    if (args.length) super(...args);
    else super(appNow);
  }
  static now() { return appNow; }
}
let successfulSends = 0;
let transportAttempts = 0;
let transportFails = false;
const notifications = load('src/lib/stripe-webhook-notifications.ts', {
  'node:crypto': crypto,
  '@/lib/prisma': { prisma: db },
  '@/lib/notifications': { sendEventNotificationStrict: async () => {
    transportAttempts++;
    if (transportFails) throw Error('SYNTHETIC_TRANSPORT_FAILURE');
    successfulSends++;
  } },
}, { Date: AppDate });
const receipts = load('src/lib/stripe-webhook-receipts.ts', {
  'node:crypto': crypto, '@/lib/prisma': { prisma: db },
}, { Date: AppDate });
const cron = load('src/app/api/cron/stripe-notifications/route.ts', {
  'next/server': { NextResponse: Response },
  '@/lib/stripe-webhook-notifications': notifications,
}, { process: { env: { CRON_SECRET: 'synthetic-cron-only' } } });
const payload = { type: 'payment', details: 'Synthetic outbox regression' };
const cronRequest = () => ({ headers: new Headers({ authorization: 'Bearer synthetic-cron-only' }) });
const cases = [];
let failedCase = null;
let completed = false;
async function check(name, fn) {
  failedCase = name;
  await fn();
  cases.push({ name, passed: true });
}
async function enqueueOperational(id) {
  await notifications.enqueueBillingOperationalNotification(id, 'synthetic_test', payload);
}
(async () => {
  try {
    await check('200 operational notices are immediately eligible despite a slower application clock', async () => {
      for (let i = 0; i < 200; i++) {
        const id = 'evt_due_operational_' + i;
        await enqueueOperational(id);
        assert.equal(await notifications.deliverStripeWebhookNotification(id), 'sent');
      }
      assert.equal(successfulSends, 200);
    });
    await check('200 claimed webhook notices are immediately eligible with the same clock skew', async () => {
      for (let i = 0; i < 200; i++) {
        const id = 'evt_due_webhook_' + i;
        const claim = await receipts.claimStripeWebhookEvent(id, 'synthetic_test');
        assert.equal(claim.kind, 'claimed');
        await notifications.enqueueStripeWebhookNotification(id, 'synthetic_test', claim.token, payload);
        await receipts.finishStripeWebhookEvent(id, claim.token, true);
        assert.equal(await notifications.deliverStripeWebhookNotification(id), 'sent');
      }
      assert.equal(successfulSends, 400);
    });
    await check('a wrong webhook receipt token cannot create a notice', async () => {
      const id = 'evt_due_wrong_claim';
      await receipts.claimStripeWebhookEvent(id, 'synthetic_test');
      await assert.rejects(() => notifications.enqueueStripeWebhookNotification(id, 'synthetic_test', 'wrong-token', payload));
      assert.equal(await db.stripeWebhookNotification.count({ where: { eventId: id } }), 0);
    });
    await check('re-enqueueing a sent event does not reset its delivery state', async () => {
      const before = await db.stripeWebhookNotification.findUniqueOrThrow({ where: { eventId: 'evt_due_operational_0' } });
      await enqueueOperational('evt_due_operational_0');
      const after = await db.stripeWebhookNotification.findUniqueOrThrow({ where: { eventId: before.eventId } });
      assert.deepEqual(after, before);
      assert.equal(await notifications.deliverStripeWebhookNotification(before.eventId), 'skipped');
      assert.equal(successfulSends, 400);
    });
    await check('transport failure retains its future backoff when the same event is enqueued again', async () => {
      transportFails = true;
      await enqueueOperational('evt_due_retry');
      assert.equal(await notifications.deliverStripeWebhookNotification('evt_due_retry'), 'failed');
      const before = await db.stripeWebhookNotification.findUniqueOrThrow({ where: { eventId: 'evt_due_retry' } });
      assert.equal(before.status, 'pending');
      assert.equal(before.attempts, 1);
      assert(before.nextAttemptAt.getTime() > appNow);
      await enqueueOperational('evt_due_retry');
      const after = await db.stripeWebhookNotification.findUniqueOrThrow({ where: { eventId: before.eventId } });
      assert.deepEqual(after, before);
      assert.equal(await notifications.deliverStripeWebhookNotification(before.eventId), 'skipped');
      transportFails = false;
    });
    await check('the actual Cron rejects missing authorization and waits for retry eligibility', async () => {
      assert.equal((await cron.GET({ headers: new Headers() })).status, 401);
      const waiting = await cron.GET(cronRequest());
      assert.equal(waiting.status, 200);
      assert.equal((await waiting.json()).examined, 0);
      assert.equal(successfulSends, 400);
    });
    await check('advancing only the fixture clock lets the actual Cron recover the failed notice once', async () => {
      appNow += 120000;
      const result = await cron.GET(cronRequest());
      assert.equal(result.status, 200);
      assert.deepEqual(await result.json(), { examined: 1, sent: 1, failed: 0 });
      const row = await db.stripeWebhookNotification.findUniqueOrThrow({ where: { eventId: 'evt_due_retry' } });
      assert.equal(row.status, 'sent');
      assert.equal(row.attempts, 2);
      assert.equal(successfulSends, 401);
    });
    await check('two concurrent claims deliver a fresh notice only once', async () => {
      await enqueueOperational('evt_due_concurrent');
      const outcomes = await Promise.all([
        notifications.deliverStripeWebhookNotification('evt_due_concurrent'),
        notifications.deliverStripeWebhookNotification('evt_due_concurrent'),
      ]);
      assert.deepEqual(outcomes.sort(), ['sent', 'skipped']);
      assert.equal(successfulSends, 402);
    });
    await check('a repeated Cron invocation cannot resend any completed notice', async () => {
      const result = await cron.GET(cronRequest());
      assert.equal(result.status, 200);
      assert.deepEqual(await result.json(), { examined: 0, sent: 0, failed: 0 });
      assert.equal(await db.stripeWebhookNotification.count({ where: { status: 'sent' } }), 402);
      assert.equal(successfulSends, 402);
      assert.equal(transportAttempts, 403);
    });
    completed = true;
    failedCase = null;
  } finally {
    const sources = ['src/lib/stripe-webhook-notifications.ts', 'src/lib/stripe-webhook-receipts.ts', 'src/app/api/cron/stripe-notifications/route.ts'];
    fs.writeFileSync(evidenceDir + '/outbox-due-results.json', JSON.stringify({
      checkedAt: new Date().toISOString(), completed, count: cases.length, cases, failedCase,
      initialNoticeIterations: 400, initialClockSkewMs: -5000, fixtureClockFrozen: true,
      recoveryClockAdvanceMs: 120000, successfulSyntheticDeliveries: successfulSends,
      realPrivatePostgres: true, actualOutboxAndCronFunctions: true,
      realProviderRequests: 0, realExternalNotifications: 0, productionWrites: 0,
      sourceHashes: Object.fromEntries(sources.map(f => [f, crypto.createHash('sha256').update(fs.readFileSync(seatSourcePath(f))).digest('hex')])),
    }, null, 2) + '\n');
    await db.$disconnect();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
