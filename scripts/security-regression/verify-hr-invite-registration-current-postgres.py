"""Run the current H3 invitation snapshot probe against its own private PostgreSQL cluster."""
import datetime
import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import uuid

PROBE = pathlib.Path('docs/audits/2026-10-06-all-services-recheck/verify-hr-invite-registration-snapshot-current.cjs')
evidence_dir = pathlib.Path(os.environ.get('DOYA_OWNER_HR_EVIDENCE_DIR', 'docs/audits/2026-10-06-all-services-recheck'))
evidence_dir.mkdir(parents=True, exist_ok=True)
result_file = evidence_dir / 'h3-current-after-results.json'
supervisor_file = evidence_dir / 'h3-current-after-supervisor.json'
probe_log = evidence_dir / 'h3-current-after.log'

EXPECTED = {'current-after snapshot then registration and retirement',
            'current-after unregistered recipient positive'}

def valid_race(results):
    if not isinstance(results, list) or len(results) != 2 or {row.get('name') for row in results} != EXPECTED:
        return False
    race = next(row for row in results if row.get('name').startswith('current-after snapshot'))
    positive = next(row for row in results if row.get('name').endswith('positive'))
    events = race.get('events', [])
    attempts = race.get('attempts', [])
    discoveries = race.get('discoveries', [])
    wait = next((row for row in events if row.get('name') == 'actual-user-wait'), {})
    statements = [row for row in events if row.get('name') == 'read-committed-statement']
    first_rejected = next((row for row in events if row.get('name') == 'transaction-rejected' and row.get('attempt') == 1), {})
    second_outer = next((row for row in events if row.get('name') == 'recipient-discovery'
                         and row.get('place') == 'outer' and row.get('id') == 'late'
                         and row.get('order', -1) > first_rejected.get('order', 10**9)), {})
    second_lock = next((row for row in events if row.get('name') == 'user-lock-requested' and row.get('attempt') == 2), {})
    second_fence = next((row for row in events if row.get('name') == 'retirement-fence-rejected' and row.get('attempt') == 2), {})
    retry_trace = (
        len(attempts) == 2
        and [(row.get('index'), row.get('isolationRequested'), row.get('isolationObserved'),
              row.get('outcome'), row.get('errorCode')) for row in attempts]
            == [(1, 'ReadCommitted', 'read committed', 'rejected', 'HR_MEMBERSHIP_CHANGED'),
                (2, 'ReadCommitted', 'read committed', 'rejected', 'ACCOUNT_RETIREMENT_IN_PROGRESS')]
        and all(isinstance(row.get('pid'), int) and isinstance(row.get('statementSnapshot'), str)
                and bool(row.get('statementSnapshot')) for row in attempts)
        and len(statements) == 2
        and [row.get('attempt') for row in statements] == [1, 2]
        and any(row.get('place') == 'outer' and row.get('id') is None for row in discoveries)
        and any(row.get('place') == 'inner' and row.get('attempt') == 1 and row.get('id') == 'late'
                for row in discoveries)
        and first_rejected.get('code') == 'HR_MEMBERSHIP_CHANGED'
        and second_lock.get('ids') == ['late', 'old']
        and second_fence.get('ids') == ['late', 'old']
        and second_fence.get('code') == 'ACCOUNT_RETIREMENT_IN_PROGRESS'
        and first_rejected.get('order', 10**9) < second_outer.get('order', -1)
        < second_lock.get('order', -1) < second_fence.get('order', -1)
    )
    return (race.get('classification') == 'fence-rejected'
            and race.get('httpStatus') == 409 and race.get('invitations') == 0
            and race.get('fullGraphUnchanged') is True
            and race.get('privateCacheControl') is True and race.get('varyCookie') is True
            and race.get('retirementReceiptUnchanged') is True
            and isinstance(race.get('graphBeforeSha256'), str)
            and len(race['graphBeforeSha256']) == 64
            and race.get('graphAfterSha256') == race['graphBeforeSha256']
            and set(race.get('graphChanges', {})) == {'settings', 'users', 'subscriptions', 'orgs', 'members', 'invitations'}
            and all(not detail.get('changed') and detail.get('before') == detail.get('after')
                    for detail in race['graphChanges'].values())
            and race.get('lateMembers') == 0 and race.get('syntheticMailCalls') == 0
            and race.get('syntheticAuditCalls') == 0
            and retry_trace and statements[0].get('pid') == wait.get('waiterPid')
            and wait.get('waitEventType') == 'Lock' and wait.get('queryContainsUser') is True
            and isinstance(wait.get('holderPid'), int) and isinstance(wait.get('waiterPid'), int)
            and wait['holderPid'] != wait['waiterPid']
            and wait['holderPid'] in wait.get('blockingPids', [])
            and positive.get('httpStatus') == 200 and positive.get('invitations') == 1
            and positive.get('issueIsolation') == 'read committed'
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
    'scripts/security-regression/retirement-fixture.cjs', 'prisma/schema.prisma', 'package.json', 'package-lock.json',
    'node_modules/.prisma/client/schema.prisma', 'node_modules/.prisma/client/index.js', str(PROBE.resolve()),
}
assert len(SOURCE_FILES) == 25

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
                 'DOYA_OWNER_HR_PG_PORT': str(port), 'DOYA_OWNER_HR_H3_CURRENT_AFTER': '1', 'DOYA_OWNER_HR_H3_CURRENT_EVIDENCE': str(result_file)}
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
    evidence_valid = (
        result.returncode == 0 and proof.get('phase') == 'current-h3-after'
        and proof.get('passed') == 2 and valid_race(proof.get('results'))
        and proof.get('checkedAt', '') >= state['startedAt']
        and set(hashes) == SOURCE_FILES
        and (not os.environ.get('DOYA_OWNER_HR_H5_EXPECTED') or
             proof.get('h5ExpectedSha256') == os.environ.get('DOYA_OWNER_HR_H5_EXPECTED_SHA256'))
        and all(pathlib.Path(name).is_file() and hashlib.sha256(pathlib.Path(name).read_bytes()).hexdigest() == digest
                for name, digest in hashes.items())
    )
    state.update(probeExitCode=result.returncode, evidenceValid=evidence_valid,
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
