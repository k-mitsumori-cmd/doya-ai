"""Verify c3c electric snapshots only in an owned disposable Unix-socket PostgreSQL."""
import datetime
import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import uuid

repo = pathlib.Path(__file__).resolve().parents[2]
migration = repo / 'prisma/manual-migrations/2026-10-22-tenjikai-electric-snapshot.sql'
bins = [pathlib.Path(os.environ['DOYA_PRIVATE_POSTGRES_BIN'])] if os.environ.get('DOYA_PRIVATE_POSTGRES_BIN') else [pathlib.Path('/opt/homebrew/opt/postgresql@17/bin'), *sorted(pathlib.Path('/usr/lib/postgresql').glob('*/bin'), reverse=True)]
pg = next((p for p in bins if all((p / n).is_file() for n in ('initdb', 'pg_ctl', 'psql'))), None)
if pg is None:
    raise SystemExit('Private PostgreSQL binaries unavailable')
for _ in range(4):
    root = pathlib.Path('/tmp') / ('doya-tenjikai-c3c-' + uuid.uuid4().hex[:8])
    try:
        root.mkdir(mode=0o700)
        break
    except FileExistsError:
        continue
else:
    raise SystemExit('Unable to reserve owned private PostgreSQL directory')
(root / 'socket').mkdir(mode=0o700)
evidence = pathlib.Path(os.environ.get('DOYA_TENJIKAI_C3C_EVIDENCE_DIR', str(repo.parent / 'sandbox/doya-tenjikai-c3c-migration-20261022'))).resolve()
evidence.mkdir(parents=True, exist_ok=True)
run_id = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S') + '-' + uuid.uuid4().hex[:6]
env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
started = False
cases = []
report = {
    'runId': run_id,
    'sourceSha256': hashlib.sha256(migration.read_bytes()).hexdigest(),
    'schemaSha256': hashlib.sha256((repo / 'prisma/schema.prisma').read_bytes()).hexdigest(),
    'runnerSha256': hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),
    'privateRoot': str(root), 'cases': cases,
    'scope': 'owned Unix-socket PostgreSQL; synthetic empty/legacy rows; no production or provider',
}


def sql(statement, expect=0, schema='public'):
    command = [str(pg / 'psql'), '-h', str(root / 'socket'), '-p', '56531', '-U', 'doya_tenjikai_c3c', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq']
    command += ['-f', str(statement)] if isinstance(statement, pathlib.Path) else ['-c', statement]
    result = subprocess.run(command, env={**env, 'PGOPTIONS': '-c search_path=' + schema}, text=True, capture_output=True, timeout=65)
    if expect == 0 and result.returncode != 0:
        raise AssertionError(f'SQL unexpectedly failed: {result.stderr[-700:]}')
    if expect != 0 and result.returncode == 0:
        raise AssertionError('SQL unexpectedly passed')
    return result.stdout.strip()


try:
    with (root / 'init.log').open('w') as log:
        subprocess.run([str(pg / 'initdb'), '-D', str(root / 'data'), '-U', 'doya_tenjikai_c3c', '--auth=trust', '--no-locale', '--encoding=UTF8'], env=env, stdout=log, stderr=subprocess.STDOUT, check=True)
    subprocess.run([str(pg / 'pg_ctl'), '-D', str(root / 'data'), '-o', f"-k {root / 'socket'} -h '' -p 56531 -F -c timezone=UTC", '-l', str(root / 'server.log'), '-w', 'start'], env=env, stdout=subprocess.DEVNULL, check=True)
    started = True
    sql('CREATE TABLE tenjikai_booth_plan (id text PRIMARY KEY); INSERT INTO tenjikai_booth_plan(id) VALUES (\'legacy\')')
    sql(migration)
    columns = sql("SELECT column_name || ':' || data_type || ':' || is_nullable FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='tenjikai_booth_plan' AND column_name IN ('electricYen','electricDetail') ORDER BY column_name")
    if columns.splitlines() != ['electricDetail:text:YES', 'electricYen:integer:YES']:
        raise AssertionError(f'electric columns mismatch: {columns}')
    check = sql("SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE connamespace=current_schema()::regnamespace AND conname='tenjikai_booth_plan_electric_pair_ck' AND contype='c'")
    if 'electricYen' not in check or 'electricDetail' not in check:
        raise AssertionError(f'electric pair constraint absent: {check}')
    if sql('SELECT "electricYen" IS NULL AND "electricDetail" IS NULL FROM tenjikai_booth_plan WHERE id=\'legacy\'') != 't':
        raise AssertionError('legacy electric estimate was fabricated')
    cases.append('legacy remains unknown null pair')
    sql('INSERT INTO tenjikai_booth_plan(id,"electricYen","electricDetail") VALUES (\'zero\',0,\'配線なし\')')
    if sql('SELECT "electricYen" || \':\' || "electricDetail" FROM tenjikai_booth_plan WHERE id=\'zero\'') != '0:配線なし':
        raise AssertionError('zero snapshot was not retained')
    cases.append('generated zero pair accepted')
    for name, values in [
        ('yen_only', "1,NULL"), ('detail_only', "NULL,'電源'"),
        ('negative', "-1,'電源'"), ('empty', "0,''"),
        ('long', "0,repeat('x',241)"),
    ]:
        sql(f"INSERT INTO tenjikai_booth_plan(id,\"electricYen\",\"electricDetail\") VALUES ('{name}',{values})", expect=1)
        cases.append(f'{name} rejected without row')
    if sql("SELECT count(*) FROM tenjikai_booth_plan") != '2':
        raise AssertionError('invalid electric pair inserted a row')
    sql('CREATE SCHEMA electric_empty')
    sql('CREATE TABLE tenjikai_booth_plan (id text PRIMARY KEY)', schema='electric_empty')
    sql(migration, schema='electric_empty')
    if sql("SELECT count(*) FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='tenjikai_booth_plan' AND column_name IN ('electricYen','electricDetail')", schema='electric_empty') != '2':
        raise AssertionError('empty baseline migration did not add both columns')
    cases.append('empty baseline applies without backfill')
except Exception as error:
    report['error'] = f'{type(error).__name__}: {error}'
finally:
    if started:
        report['stopExitCode'] = subprocess.run([str(pg / 'pg_ctl'), '-D', str(root / 'data'), '-m', 'fast', '-w', 'stop'], env=env, stdout=subprocess.DEVNULL).returncode
    for name in ('init.log', 'server.log'):
        source = root / name
        if source.exists():
            target = evidence / (name + '-' + run_id + '.log')
            shutil.copyfile(source, target)
            report[name + 'Sha256'] = hashlib.sha256(target.read_bytes()).hexdigest()
    if not started or report.get('stopExitCode') == 0:
        shutil.rmtree(root)
    report['removedOwnedDirectory'] = not root.exists()
    target = evidence / ('migration-' + run_id + '.json')
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'evidence': str(target), **report}, ensure_ascii=False))
if report.get('error') or report.get('stopExitCode') != 0 or not report['removedOwnedDirectory'] or len(cases) != 8:
    raise SystemExit(1)
