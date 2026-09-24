const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

let owner = 'owner';
let sessionStatus = 'ended';
let firstPageReads = 0;
let recentReads = 0;
const tx = {
  user: { findUnique: async () => ({ id: owner }) },
  cunningSession: { findUnique: async () => ({
    id: 'session', userId: 'owner', status: sessionStatus, durationSec: 45, recordingVersion: 2, mode: 'sales',
    answers: [], _count: { transcripts: 501, answers: 201 },
  }) },
  cunningAnswer: { findMany: async () => [{ id: 'latest-answer', questionText: 'Latest', summary: 'Saved', script: 'Saved script' }] },
  cunningRecordingLease: { findUnique: async () => ({ stoppedAt: null }) },
};
const route = load('src/app/api/cunning/sessions/[id]/route.ts', {
  'next/server': { NextResponse: Response },
  '@prisma/client': { Prisma: { TransactionIsolationLevel: { RepeatableRead: 'RepeatableRead' } } },
  '@/lib/prisma': { prisma: { $transaction: async fn => fn(tx) } },
  '@/lib/cunning/access': { getUserId: async () => owner },
  '@/lib/cunning/history-read': {
    readCunningTranscripts: async () => { firstPageReads++; return []; },
    readRecentCunningTranscripts: async () => { recentReads++; return [{ id: 'latest-transcript', text: 'Latest', speaker: 'remote' }]; },
  },
  '@/lib/cunning/history-cursor': {},
  '@/lib/cunning/report-freshness': {},
  '@/lib/cunning/session-write': {},
  '@/lib/cunning/modes': { MODE_IDS: ['sales'] },
});

(async () => {
  const req = { url: 'https://offline.invalid/api/cunning/sessions/session?view=live' };
  const ctx = { params: Promise.resolve({ id: 'session' }) };
  let response = await route.GET(req, ctx);
  assert.equal(response.status, 200);
  let body = await response.json();
  assert.equal(body.session.liveHistory.transcripts[0].id, 'latest-transcript');
  assert.equal(body.session.liveHistory.answers[0].id, 'latest-answer');
  assert.deepEqual(body.session.liveHistory.totals, { transcripts: 501, answers: 201 });
  assert.equal(body.session.interruptedRecording, false, 'ended sessions do not offer recording restart');
  assert.equal(firstPageReads, 0, 'live view avoids the old first page');
  assert.equal(recentReads, 1);
  sessionStatus = 'active';
  response = await route.GET(req, ctx);
  body = await response.json();
  assert.equal(body.session.interruptedRecording, true, 'open server lease blocks restart even without browser storage');
  owner = 'other';
  response = await route.GET(req, ctx);
  assert.equal(response.status, 404, 'another user cannot read live history');
  assert.equal(recentReads, 2, 'foreign session is rejected before history query');
  console.log('PASS Cunning live view returns recent saved history and enforces ownership');
})().catch(error => { console.error(error); process.exitCode = 1; });
