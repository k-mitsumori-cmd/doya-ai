"""Run the final-null/insert-dispatch counter-schedule in its own private PostgreSQL cluster."""
import datetime
import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import uuid

PROBE = pathlib.Path('docs/audits/2026-10-06-all-services-recheck/verify-hr-invite-final-null-counter-current.cjs')
evidence_dir = pathlib.Path(os.environ['DOYA_OWNER_HR_COUNTER_EVIDENCE_DIR'])
if not evidence_dir.is_absolute() or evidence_dir.is_symlink():
    raise ValueError('Counter evidence directory must be an owned absolute non-symlink path')
evidence_dir.mkdir(parents=True, exist_ok=True)
result_file = evidence_dir / 'h3-final-null-counter-results.json'
supervisor_file = evidence_dir / 'h3-final-null-counter-supervisor.json'
probe_log = evidence_dir / 'h3-final-null-counter.log'

EXPECTED = {'counter-final-null then late registration and retirement',
            'counter-final-null unregistered recipient positive'}

def valid_race(results):
    if not isinstance(results, list) or len(results) != 2 or {row.get('name') for row in results} != EXPECTED:
        return False
    race = next(row for row in results if row['name'].startswith('counter-final-null then'))
    positive = next(row for row in results if row['name'].endswith('positive'))
    events = race.get('events', [])
    attempts = race.get('attempts', [])
    reads = race.get('recipientReads', [])
    event = lambda name: next((row for row in events if row.get('name') == name), {})
    sequence = ['recipient-read-completed', 'issue-transaction-observed', 'insert-dispatch-paused',
                'late-registration-committed', 'late-retirement-reservation-committed',
                'third-connection-registration-and-receipt-visible', 'insert-dispatch-gate-released']
    orders = [event(name).get('order') for name in sequence]
    retry_bound = (len(attempts) == 1 or
                   (attempts[0].get('outcome') == 'rejected' and
                    any(row.get('place') == 'outer' and row.get('id') == 'late'
                        and row.get('call', 0) > 3 for row in reads)))
    three_reads = (len(reads) >= 3 and all(read.get('call') == index + 1 and read.get('completed') is True
                    for index, read in enumerate(reads))
                   and [row.get('place') for row in reads[:3]] == ['outer', 'inner', 'inner']
                   and all(row.get('id') is None for row in reads[:3]))
    paused = event('insert-dispatch-paused')
    pids = [race.get('issuePid'), race.get('externalPid'), race.get('observerPid')]
    reserve_pid = race.get('reservePid')
    return (race.get('classification') in {'fence-rejected', 'membership-changed-rejected'}
            and race.get('httpStatus') == 409 and race.get('invitations') == 0
            and race.get('fullGraphUnchanged') is True
            and race.get('privateCacheControl') is True and race.get('varyCookie') is True
            and race.get('retirementReceiptUnchanged') is True
            and race.get('retirementFenceUnchanged') is True
            and isinstance(race.get('graphBeforeSha256'), str)
            and len(race['graphBeforeSha256']) == 64
            and race.get('graphAfterSha256') == race['graphBeforeSha256']
            and set(race.get('graphChanges', {})) == {'settings', 'users', 'subscriptions', 'orgs', 'members', 'invitations'}
            and all(not detail.get('changed') and detail.get('before') == detail.get('after')
                    for detail in race['graphChanges'].values())
            and race.get('lateMembers') == 0 and race.get('syntheticMailCalls') == 0
            and race.get('syntheticAuditCalls') == 0
            and 1 <= len(attempts) <= 4
            and all(row.get('index') == index + 1 and row.get('isolationRequested') == 'ReadCommitted'
                    and row.get('actualIsolation') == 'read committed' and isinstance(row.get('pid'), int)
                    and row.get('outcome') in {'committed', 'rejected'}
                    for index, row in enumerate(attempts))
            and attempts[0].get('pid') == race.get('issuePid') and retry_bound
            and three_reads and paused.get('finalRecipientCall') == 3
            and paused.get('finalRecipientId') is None
            and paused.get('completedRecipientReads') == 3
            and paused.get('pid') == race.get('issuePid')
            and race.get('finalRecipientRead') == reads[2]
            and race.get('completedRecipientReadsBeforeInsert') == 3
            and race.get('receiptBeforeSha256') == race.get('receiptAfterSha256')
            and race.get('fenceBeforeSha256') == race.get('fenceAfterSha256')
            and race.get('cacheControl') == 'private, no-store'
            and 'Cookie' in (race.get('vary') or '')
            and all(isinstance(pid, int) for pid in pids) and len(set(pids)) == 3
            and isinstance(reserve_pid, int) and reserve_pid not in (race.get('issuePid'), race.get('observerPid'))
            and all(isinstance(order, int) for order in orders) and orders == sorted(set(orders))
            and positive.get('httpStatus') == 200 and positive.get('invitations') == 1
            and positive.get('invitationRole') == 'MEMBER'
            and positive.get('invitationStatus') == 'PENDING'
            and positive.get('invitedBy') == 'old'
            and isinstance(positive.get('invitationExpiresInDays'), (int, float))
            and 6 < positive['invitationExpiresInDays'] <= 7
            and positive.get('syntheticMailCalls') == 1 and positive.get('syntheticAuditCalls') == 1)

SOURCE_FILES = {
    'src/lib/hr/owner-transfer/types.ts', 'src/lib/hr/owner-transfer/receipt.ts', 'src/lib/hr/owner-transfer/store.ts',
    'src/lib/hr/access.ts', 'src/lib/hr/membership-write.ts', 'src/lib/account-lifecycle/state.ts',
    'src/lib/account-lifecycle/store.ts', 'src/lib/hr/types.ts', 'src/lib/hr/constants.ts', 'src/lib/hr/billing.ts',
    'src/lib/private-api-response.ts', 'src/app/api/hr/organization/route.ts',
    'src/app/api/hr/organization/members/[id]/route.ts', 'src/app/api/hr/organization/invite/route.ts',
    'src/app/api/hr/organization/invite/accept/route.ts', 'src/app/api/hr/organization/invite/[token]/route.ts',
    'src/lib/account-retirement.ts', 'scripts/security-regression/load-typescript.cjs',
    'scripts/security-regression/retirement-fixture.cjs',
    'scripts/security-regression/verify-hr-invite-final-null-counter-postgres.py', 'prisma/schema.prisma', 'package.json', 'package-lock.json',
    'node_modules/.prisma/client/schema.prisma', 'node_modules/.prisma/client/index.js', str(PROBE.resolve()),
}
assert len(SOURCE_FILES) == 26

candidates = ([pathlib.Path(os.environ['DOYA_PRIVATE_POSTGRES_BIN'])]
              if os.environ.get('DOYA_PRIVATE_POSTGRES_BIN') else
              [pathlib.Path('/opt/homebrew/opt/postgresql@17/bin'),
               *sorted(pathlib.Path('/usr/lib/postgresql').glob('*/bin'),
                       key=lambda item: int(item.parent.name), reverse=True)])
pg = next((item for item in candidates if (item / 'initdb').is_file() and (item / 'pg_ctl').is_file()), None)
if pg is None:
    raise SystemExit('Private PostgreSQL binaries unavailable')
folder = pathlib.Path('/tmp') / ('doya-owner-hr-' + uuid.uuid4().hex[:8])
folder.mkdir(mode=0o700, exist_ok=False)
(folder / 'socket').mkdir(mode=0o700)
port = 56483
env = {key: value for key, value in os.environ.items() if not key.startswith('PG') and key != 'DOYA_TEST_BASELINE'}
state = {'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
         'privateFolder': str(folder), 'status': 'running'}
supervisor_file.write_text(json.dumps(state, indent=2) + '\n')
started = False
try:
    with (folder / 'init.log').open('w') as output:
        subprocess.run([str(pg / 'initdb'), '-D', str(folder / 'data'), '-U', 'doya_owner_hr', '--auth=trust',
                        '--no-locale', '--encoding=UTF8'], env=env, stdout=output, stderr=subprocess.STDOUT, check=True)
    subprocess.run([str(pg / 'pg_ctl'), '-D', str(folder / 'data'),
                    '-o', "-k " + str(folder / 'socket') + " -h '' -p " + str(port) + ' -F -c timezone=UTC',
                    '-l', str(folder / 'server.log'), '-w', 'start'], env=env, stdout=subprocess.DEVNULL, check=True)
    started = True
    child_env = {**env, 'DOYA_OWNER_HR_PG_SOCKET': str(folder / 'socket'),
                 'DOYA_OWNER_HR_PG_PORT': str(port), 'DOYA_OWNER_HR_H3_FINAL_NULL_COUNTER': '1', 'DOYA_OWNER_HR_H3_FINAL_NULL_EVIDENCE': str(result_file)}
    if os.environ.get('DOYA_OWNER_HR_H5_EXPECTED'):
        assert os.environ.get('DOYA_OWNER_HR_H5_PHASE') == 'after'
        assert 'DOYA_TEST_BASELINE' not in os.environ
        assert os.environ.get('DOYA_OWNER_HR_H5_BASELINE')
        assert 'DOYA_TEST_BASELINE' not in child_env
    with probe_log.open('w') as output:
        result = subprocess.run(['node', str(PROBE)], env=child_env, stdout=output,
                                stderr=subprocess.STDOUT, timeout=600)
    proof = json.loads(result_file.read_text()) if result_file.exists() else {}
    hashes = proof.get('sourceHashes', {})
    source_set_valid = set(hashes) == SOURCE_FILES
    source_bytes_valid = source_set_valid and all(pathlib.Path(name).is_file()
        and hashlib.sha256(pathlib.Path(name).read_bytes()).hexdigest() == digest
        for name, digest in hashes.items())
    evidence_valid = (
        result.returncode == 0 and proof.get('phase') == 'counter-final-null-after'
        and proof.get('passed') == 2 and valid_race(proof.get('results'))
        and proof.get('checkedAt', '') >= state['startedAt']
        and source_set_valid and source_bytes_valid
        and (not os.environ.get('DOYA_OWNER_HR_H5_EXPECTED') or
             proof.get('h5ExpectedSha256') == os.environ.get('DOYA_OWNER_HR_H5_EXPECTED_SHA256'))
    )
    observed = proof.get('raceEvidence') or next((row for row in proof.get('results', [])
        if row.get('name') == 'counter-final-null then late registration and retirement'), {})
    state.update(probeExitCode=result.returncode, evidenceValid=evidence_valid,
                 observedClassification=observed.get('classification'), observedHttpStatus=observed.get('httpStatus'),
                 childResultSha256=hashlib.sha256(result_file.read_bytes()).hexdigest() if result_file.exists() else None,
                 childSourceHashSetMatches=source_set_valid, childSourceHashesMatchDisk=source_bytes_valid,
                 status='passed' if evidence_valid else 'failed')
except Exception as error:
    state.update(status='failed', errorType=type(error).__name__, error=str(error))
finally:
    if started:
        stop = subprocess.run([str(pg / 'pg_ctl'), '-D', str(folder / 'data'), '-m', 'fast', '-w', 'stop'],
                              env=env, stdout=subprocess.DEVNULL)
        state['stopExitCode'] = stop.returncode
        status = subprocess.run([str(pg / 'pg_ctl'), '-D', str(folder / 'data'), 'status'],
                                env=env, stdout=subprocess.DEVNULL)
        state['postStopStatusExitCode'] = status.returncode
        if stop.returncode == 0 and status.returncode == 3:
            shutil.rmtree(folder)
            state['privateFolderRemoved'] = not folder.exists()
    elif folder.exists():
        shutil.rmtree(folder)
        state['privateFolderRemoved'] = not folder.exists()
    state['endedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    supervisor_file.write_text(json.dumps(state, indent=2) + '\n')
    print(json.dumps(state))
if state['status'] != 'passed' or state.get('stopExitCode') != 0 or state.get('postStopStatusExitCode') != 3 or not state.get('privateFolderRemoved'):
    raise SystemExit(1)
