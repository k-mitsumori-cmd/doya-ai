"""Apply the Tenjikai manual migration only to disposable, owned PostgreSQL schemas."""
import datetime
import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import uuid

repo = pathlib.Path(__file__).resolve().parents[2]
migration = repo / 'prisma/manual-migrations/2026-10-22-tenjikai-workspace-revision.sql'
bins = [pathlib.Path(os.environ['DOYA_PRIVATE_POSTGRES_BIN'])] if os.environ.get('DOYA_PRIVATE_POSTGRES_BIN') else [pathlib.Path('/opt/homebrew/opt/postgresql@17/bin'), *sorted(pathlib.Path('/usr/lib/postgresql').glob('*/bin'), reverse=True)]
pg = next((p for p in bins if all((p / n).is_file() for n in ('initdb', 'pg_ctl', 'psql'))), None)
if pg is None:
    raise SystemExit('Private PostgreSQL binaries unavailable')
for _ in range(4):
    root = pathlib.Path('/tmp') / ('doya-tenjikai-c3b2-' + uuid.uuid4().hex[:8])
    try:
        root.mkdir(mode=0o700)
        break
    except FileExistsError:
        continue
else:
    raise SystemExit('Unable to reserve owned private PostgreSQL directory')
root.chmod(0o700)
(root / 'socket').mkdir(mode=0o700)
evidence = pathlib.Path(os.environ.get('DOYA_TENJIKAI_C3B2_EVIDENCE_DIR', str(repo.parent / 'sandbox/doya-tenjikai-c3b2-20261022'))).resolve()
evidence.mkdir(parents=True, exist_ok=True)
run_id = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S') + '-' + uuid.uuid4().hex[:6]
port = 56529
env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
started = False
cases = []
report = {
    'runId': run_id,
    'sourceSha256': hashlib.sha256(migration.read_bytes()).hexdigest(),
    'schemaSha256': hashlib.sha256((repo / 'prisma/schema.prisma').read_bytes()).hexdigest(),
    'runnerSha256': hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),
    'baselineSha256': None,
    'privateRoot': str(root), 'cases': cases,
    'scope': 'owned Unix-socket PostgreSQL; synthetic legacy table rows and catalog; no production or provider',
}


def sql(schema, statement, expect=0):
    child = {**env, 'PGOPTIONS': '-c search_path=' + schema}
    command = [str(pg / 'psql'), '-h', str(root / 'socket'), '-p', str(port), '-U', 'doya_tenjikai_c3b2', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq']
    if isinstance(statement, pathlib.Path):
        command += ['-f', str(statement)]
    else:
        command += ['-c', statement]
    result = subprocess.run(command, env=child, text=True, capture_output=True, timeout=65)
    if expect == 0 and result.returncode != 0:
        raise AssertionError(f'{schema}: SQL unexpectedly failed: {result.stderr[-700:]}')
    if expect != 0 and result.returncode == 0:
        raise AssertionError(f'{schema}: SQL unexpectedly passed')
    return result


base = '''
CREATE TABLE tenjikai_project(id TEXT PRIMARY KEY);
CREATE TABLE tenjikai_site_analysis(id TEXT PRIMARY KEY, "projectId" TEXT UNIQUE REFERENCES tenjikai_project(id) ON DELETE CASCADE);
CREATE TABLE tenjikai_booth_plan(id TEXT PRIMARY KEY, "projectId" TEXT NOT NULL REFERENCES tenjikai_project(id) ON DELETE CASCADE, variant TEXT NOT NULL, selected BOOLEAN NOT NULL DEFAULT FALSE);
CREATE INDEX "tenjikai_booth_plan_projectId_variant_idx" ON tenjikai_booth_plan("projectId", variant);
CREATE TABLE tenjikai_booth_element(id TEXT PRIMARY KEY, "planId" TEXT NOT NULL REFERENCES tenjikai_booth_plan(id) ON DELETE CASCADE);
CREATE TABLE tenjikai_graphic_panel(id TEXT PRIMARY KEY, "planId" TEXT NOT NULL REFERENCES tenjikai_booth_plan(id) ON DELETE CASCADE, "elementId" TEXT NOT NULL);
CREATE TABLE tenjikai_creative(id TEXT PRIMARY KEY, "projectId" TEXT NOT NULL REFERENCES tenjikai_project(id) ON DELETE CASCADE, kind TEXT NOT NULL);
CREATE TABLE tenjikai_novelty(id TEXT PRIMARY KEY, "projectId" TEXT NOT NULL REFERENCES tenjikai_project(id) ON DELETE CASCADE);
CREATE TABLE tenjikai_budget_line(id TEXT PRIMARY KEY, "projectId" TEXT NOT NULL REFERENCES tenjikai_project(id) ON DELETE CASCADE);
CREATE TABLE tenjikai_document(id TEXT PRIMARY KEY, "projectId" TEXT NOT NULL REFERENCES tenjikai_project(id) ON DELETE CASCADE);
CREATE TABLE tenjikai_task(id TEXT PRIMARY KEY, "projectId" TEXT NOT NULL REFERENCES tenjikai_project(id) ON DELETE CASCADE, "documentId" TEXT);
ALTER TABLE tenjikai_task ADD CONSTRAINT "tenjikai_task_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES tenjikai_document(id) ON DELETE SET NULL ON UPDATE CASCADE;
'''
report['baselineSha256'] = hashlib.sha256(base.encode()).hexdigest()

try:
    with (root / 'init.log').open('w') as log:
        subprocess.run([str(pg / 'initdb'), '-D', str(root / 'data'), '-U', 'doya_tenjikai_c3b2', '--auth=trust', '--no-locale', '--encoding=UTF8'], env=env, stdout=log, stderr=subprocess.STDOUT, check=True)
    subprocess.run([str(pg / 'pg_ctl'), '-D', str(root / 'data'), '-o', f"-k {root / 'socket'} -h '' -p {port} -F -c timezone=UTC", '-l', str(root / 'server.log'), '-w', 'start'], env=env, stdout=subprocess.DEVNULL, check=True)
    started = True
    seeds = {
        'empty': '',
        'legacy': "INSERT INTO tenjikai_project VALUES ('p'),('p2'); INSERT INTO tenjikai_booth_plan VALUES ('b','p','A',TRUE),('b2','p','B',FALSE); INSERT INTO tenjikai_booth_element VALUES ('e','b'),('e2','b2'); INSERT INTO tenjikai_graphic_panel VALUES ('g','b','e'); INSERT INTO tenjikai_creative VALUES ('c','p','flyer'); INSERT INTO tenjikai_document VALUES ('d','p'); INSERT INTO tenjikai_task VALUES ('t','p','d');",
        'duplicate': "INSERT INTO tenjikai_project VALUES ('p'); INSERT INTO tenjikai_booth_plan VALUES ('b1','p','A',FALSE),('b2','p','A',FALSE);",
        'orphan': "INSERT INTO tenjikai_project VALUES ('p'); INSERT INTO tenjikai_booth_plan VALUES ('b','p','A',FALSE); INSERT INTO tenjikai_graphic_panel VALUES ('g','b','missing');",
        'cross_project': "INSERT INTO tenjikai_project VALUES ('p1'),('p2'); INSERT INTO tenjikai_document VALUES ('d','p1'); INSERT INTO tenjikai_task VALUES ('t','p2','d');",
    }
    for name, seed in seeds.items():
        schema = 'tenjikai_' + name
        sql('public', f'CREATE SCHEMA {schema}')
        sql(schema, base)
        if seed:
            sql(schema, seed)
        result = sql(schema, migration, expect=0 if name in ('empty', 'legacy') else 1)
        if name in ('empty', 'legacy'):
            columns = sql(schema, "SELECT count(*) FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='tenjikai_project' AND column_name='revision'").stdout.strip()
            if columns != '1':
                raise AssertionError(f'{name}: revision column missing')
            indexes = sql(schema, """SELECT count(*) FROM pg_index i JOIN pg_class idx ON idx.oid=i.indexrelid
                WHERE i.indrelid IN ('tenjikai_booth_plan'::regclass,'tenjikai_booth_element'::regclass,'tenjikai_graphic_panel'::regclass,'tenjikai_creative'::regclass,'tenjikai_novelty'::regclass,'tenjikai_budget_line'::regclass,'tenjikai_document'::regclass,'tenjikai_task'::regclass)
                AND i.indisunique AND idx.relname = ANY(ARRAY[
                  'tenjikai_booth_plan_project_variant_uq','tenjikai_booth_plan_one_selected_uq',
                  'tenjikai_booth_element_plan_id_uq','tenjikai_booth_element_source_uq',
                  'tenjikai_graphic_panel_source_uq','tenjikai_creative_project_kind_uq',
                  'tenjikai_novelty_source_uq','tenjikai_budget_line_source_uq',
                  'tenjikai_document_project_id_uq','tenjikai_task_source_uq'])""").stdout.strip()
            if indexes != '10':
                raise AssertionError(f'{name}: normalized unique indexes mismatch: {indexes}')
            index_columns = sql(schema, """SELECT idx.relname || ':' || string_agg(a.attname::text, ',' ORDER BY k.ordinality)
                FROM pg_index i JOIN pg_class idx ON idx.oid=i.indexrelid
                JOIN LATERAL unnest(i.indkey::smallint[]) WITH ORDINALITY k(attnum,ordinality) ON TRUE
                JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum
                WHERE idx.relnamespace=current_schema()::regnamespace AND idx.relname=ANY(ARRAY[
                  'tenjikai_booth_plan_project_variant_uq','tenjikai_booth_plan_one_selected_uq',
                  'tenjikai_booth_element_plan_id_uq','tenjikai_booth_element_source_uq',
                  'tenjikai_graphic_panel_source_uq','tenjikai_creative_project_kind_uq',
                  'tenjikai_novelty_source_uq','tenjikai_budget_line_source_uq',
                  'tenjikai_document_project_id_uq','tenjikai_task_source_uq'])
                GROUP BY idx.relname ORDER BY idx.relname""").stdout.splitlines()
            expected_index_columns = [
                'tenjikai_booth_element_plan_id_uq:planId,id',
                'tenjikai_booth_element_source_uq:planId,sourceElementId',
                'tenjikai_booth_plan_one_selected_uq:projectId',
                'tenjikai_booth_plan_project_variant_uq:projectId,variant',
                'tenjikai_budget_line_source_uq:projectId,sourceLineKey',
                'tenjikai_creative_project_kind_uq:projectId,kind',
                'tenjikai_document_project_id_uq:projectId,id',
                'tenjikai_graphic_panel_source_uq:planId,sourcePanelId',
                'tenjikai_novelty_source_uq:projectId,sourceNoveltyId',
                'tenjikai_task_source_uq:projectId,sourceDeadlineId',
            ]
            if index_columns != expected_index_columns:
                raise AssertionError(f'{name}: index columns mismatch: {index_columns}')
            old_index = sql(schema, "SELECT count(*) FROM pg_class WHERE relname='tenjikai_booth_plan_projectId_variant_idx' AND relnamespace=current_schema()::regnamespace").stdout.strip()
            if old_index != '0':
                raise AssertionError(f'{name}: old nonunique plan index remains')
            selected = sql(schema, "SELECT count(*) FROM pg_index i JOIN pg_class idx ON idx.oid=i.indexrelid WHERE idx.relnamespace=current_schema()::regnamespace AND idx.relname='tenjikai_booth_plan_one_selected_uq' AND i.indisunique AND i.indpred IS NOT NULL AND pg_get_expr(i.indpred,i.indrelid) LIKE '%selected%'").stdout.strip()
            if selected != '1':
                raise AssertionError(f'{name}: selected partial unique index mismatch')
            fks = sql(schema, """SELECT count(*) FROM pg_constraint WHERE connamespace=current_schema()::regnamespace AND conname IN
                ('tenjikai_graphic_panel_element_same_plan_fkey','tenjikai_task_document_same_project_fkey')
                AND contype='f' AND confdeltype='a' AND confupdtype='c'""").stdout.strip()
            old_fk = sql(schema, "SELECT count(*) FROM pg_constraint WHERE connamespace=current_schema()::regnamespace AND conname='tenjikai_task_documentId_fkey'").stdout.strip()
            if fks != '2' or old_fk != '0':
                raise AssertionError(f'{name}: FK parity mismatch: new={fks}, old={old_fk}')
            fk_columns = sql(schema, """SELECT c.conname || ':' || rel.relname || ':' ||
                (SELECT string_agg(a.attname::text, ',' ORDER BY k.ordinality) FROM unnest(c.conkey) WITH ORDINALITY k(attnum,ordinality) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum) || '>' || target.relname || ':' ||
                (SELECT string_agg(a.attname::text, ',' ORDER BY k.ordinality) FROM unnest(c.confkey) WITH ORDINALITY k(attnum,ordinality) JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.attnum)
                FROM pg_constraint c JOIN pg_class rel ON rel.oid=c.conrelid JOIN pg_class target ON target.oid=c.confrelid
                WHERE c.connamespace=current_schema()::regnamespace AND c.conname IN
                ('tenjikai_graphic_panel_element_same_plan_fkey','tenjikai_task_document_same_project_fkey') ORDER BY c.conname""").stdout.splitlines()
            expected_fks = [
                'tenjikai_graphic_panel_element_same_plan_fkey:tenjikai_graphic_panel:planId,elementId>tenjikai_booth_element:planId,id',
                'tenjikai_task_document_same_project_fkey:tenjikai_task:projectId,documentId>tenjikai_document:projectId,id',
            ]
            if fk_columns != expected_fks:
                raise AssertionError(f'{name}: FK columns/targets mismatch: {fk_columns}')
            if name == 'legacy':
                values = sql(schema, "SELECT revision::text || ':' || coalesce(\"planningVenueCode\",'NULL') FROM tenjikai_project WHERE id='p'").stdout.strip()
                if values != '0:NULL':
                    raise AssertionError(f'legacy values fabricated: {values}')
                sql(schema, "INSERT INTO tenjikai_graphic_panel(id,\"planId\",\"elementId\") VALUES ('invalid','b','missing')", expect=1)
                sql(schema, "INSERT INTO tenjikai_graphic_panel(id,\"planId\",\"elementId\") VALUES ('wrong_plan','b','e2')", expect=1)
                sql(schema, "INSERT INTO tenjikai_task(id,\"projectId\",\"documentId\") VALUES ('invalid','p2','d')", expect=1)
                sql(schema, "DELETE FROM tenjikai_booth_element WHERE id='e'", expect=1)
                sql(schema, "DELETE FROM tenjikai_document WHERE id='d'", expect=1)
                sql(schema, "UPDATE tenjikai_task SET \"documentId\"=NULL WHERE id='t'; DELETE FROM tenjikai_document WHERE id='d'")
                if sql(schema, "SELECT \"documentId\" IS NULL FROM tenjikai_task WHERE id='t'").stdout.strip() != 't':
                    raise AssertionError('explicit document detach did not persist')
                sql(schema, "DELETE FROM tenjikai_project WHERE id='p'")
                remaining = sql(schema, "SELECT (SELECT count(*) FROM tenjikai_booth_plan)+(SELECT count(*) FROM tenjikai_booth_element)+(SELECT count(*) FROM tenjikai_graphic_panel)+(SELECT count(*) FROM tenjikai_creative)+(SELECT count(*) FROM tenjikai_task)").stdout.strip()
                if remaining != '0':
                    raise AssertionError(f'project cascade left graph rows: {remaining}')
        else:
            columns = sql(schema, "SELECT count(*) FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='tenjikai_project' AND column_name='revision'").stdout.strip()
            if columns != '0':
                raise AssertionError(f'{name}: failed migration left partial DDL')
            if 'TENJIKAI_' not in result.stderr:
                raise AssertionError(f'{name}: preflight reason absent: {result.stderr[-400:]}')
        cases.append({'name': name, 'result': 'applied' if result.returncode == 0 else 'preflight_stopped'})
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
if report.get('error') or report.get('stopExitCode') != 0 or not report['removedOwnedDirectory'] or len(cases) != 5:
    raise SystemExit(1)
