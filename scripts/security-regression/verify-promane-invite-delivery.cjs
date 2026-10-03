const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

function fixture({ lookupFails = false, deliveryFails = false } = {}) {
  let deliveries = 0;
  let html = '';
  const route = load('src/app/api/promane/invite/route.ts', {
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => ({ user: { id: 'admin' } }) },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma: { user: { findUnique: async () => {
      if (lookupFails) throw Error('temporary lookup failure');
      return { name: 'Inviter', email: 'inviter@example.com' };
    } } } },
    '@/lib/email': { sendEmail: async (payload) => {
      deliveries++;
      html = payload.html;
      if (deliveryFails) throw Error('private provider detail');
      return { success: true };
    } },
    '@/lib/promane/invite-admission': { issuePromaneInvitation: async () => ({
      success: true, reused: false, workspaceName: 'Workspace',
      invitation: { token: 'secret-token', expiresAt: new Date(Date.now() + 86400000) },
    }) },
  });
  return {
    post: () => route.POST(new Request('https://example.test/api/promane/invite', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspaceId: 'ws', email: 'invited@example.com' }),
    })),
    get deliveries() { return deliveries; }, get html() { return html; },
  };
}

(async () => {
  const normal = fixture();
  const sent = await normal.post();
  assert.equal(sent.status, 200);
  assert.equal((await sent.json()).emailSent, true);
  assert.equal(normal.deliveries, 1);
  assert.match(normal.html, /招待は <strong>invited@example\.com<\/strong> 宛/);
  assert.equal(normal.html.includes('招待は <strong>inviter@example.com</strong> 宛'), false);

  const failed = fixture({ lookupFails: true, deliveryFails: true });
  const response = await failed.post();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.emailSent, false);
  assert.equal(body.emailError, undefined);
  assert.equal(body.inviteUrl.includes('secret-token'), true);
  assert.equal(failed.deliveries, 1);
  console.log('PASS Promane invitation: correct recipient, post-create failures preserve link, no provider error leak');
})().catch((error) => { console.error(error); process.exitCode = 1; });
