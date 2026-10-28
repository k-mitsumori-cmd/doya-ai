"""Run the list reader against a disposable PostgreSQL server with no TCP listener."""
import os
import pathlib
import shutil
import subprocess
import tempfile

root = pathlib.Path(__file__).resolve().parents[2]
candidates = ([pathlib.Path(os.environ['DOYA_PRIVATE_POSTGRES_BIN'])]
              if os.environ.get('DOYA_PRIVATE_POSTGRES_BIN') else
              [pathlib.Path('/opt/homebrew/opt/postgresql@17/bin'),
               *sorted(pathlib.Path('/usr/lib/postgresql').glob('*/bin'),
                       key=lambda p: int(p.parent.name), reverse=True)])
pg = next((p for p in candidates if (p / 'initdb').is_file() and (p / 'pg_ctl').is_file()), None)
if pg is None:
    raise SystemExit('PostgreSQL initdb/pg_ctl is required for the isolated SEO list regression')

folder = pathlib.Path(tempfile.mkdtemp(prefix='doya-seo-list-', dir='/tmp'))
folder.chmod(0o700)
socket = folder / 'socket'
socket.mkdir(mode=0o700)
port = '56483'
env = {key: os.environ[key] for key in ['PATH', 'HOME', 'LANG', 'TMPDIR'] if key in os.environ}
started = False
try:
    with (folder / 'init.log').open('w') as log:
        subprocess.run([str(pg / 'initdb'), '-D', str(folder / 'data'), '-U', 'doya_seo',
                        '--auth=trust', '--no-locale', '--encoding=UTF8'],
                       env=env, stdout=log, stderr=subprocess.STDOUT, check=True, timeout=60)
    started = True
    subprocess.run([str(pg / 'pg_ctl'), '-D', str(folder / 'data'), '-o',
                    f"-k {socket} -h '' -p {port} -F -c timezone=UTC",
                    '-l', str(folder / 'server.log'), '-w', 'start'],
                   env=env, stdout=subprocess.DEVNULL, check=True, timeout=30)
    url = f'postgresql://doya_seo@localhost:{port}/postgres?host={socket}&sslmode=disable&connection_limit=1'
    result = subprocess.run(['node', '--import', 'tsx', '--test',
                             'scripts/regression/seo-list-postgres.test.ts'], cwd=root,
                            env={**env, 'DOYA_PRIVATE_TEST_DATABASE_URL': url,
                                 'DOYA_PRIVATE_TEST_SOCKET': str(socket)}, timeout=120)
    if result.returncode:
        raise SystemExit(result.returncode)
finally:
    if started:
        stop = subprocess.run([str(pg / 'pg_ctl'), '-D', str(folder / 'data'),
                               '-m', 'fast', '-w', 'stop'], env=env,
                              stdout=subprocess.DEVNULL, timeout=30)
        status = subprocess.run([str(pg / 'pg_ctl'), '-D', str(folder / 'data'), 'status'],
                                env=env, stdout=subprocess.DEVNULL, timeout=10)
        if status.returncode != 3:
            raise SystemExit('Private PostgreSQL did not stop; temporary files retained')
    # Only this invocation's private synthetic database is removed.
    if folder.parent == pathlib.Path('/tmp') and folder.name.startswith('doya-seo-list-'):
        shutil.rmtree(folder)
