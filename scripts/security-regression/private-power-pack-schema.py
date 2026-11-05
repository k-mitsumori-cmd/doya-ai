from pathlib import Path
import subprocess

def prepare_cash_schema(root, pg, socket, folder, env):
    # Only called after the driver creates a fresh private Unix-socket cluster.
    assert str(folder).startswith('/tmp/doya-power-recovery-')
    assert str(socket).startswith(str(folder)+'/')
    common=[str(pg/'psql'),'-h',str(socket),'-p','56519','-U','power_recovery_test','-d','power_recovery_synthetic','-v','ON_ERROR_STOP=1']
    setup=folder/'cash-schema-preparation.sql'
    setup.write_text("CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS;\nCREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS;\nGRANT USAGE ON SCHEMA public TO anon, authenticated;\nALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;\nDROP TABLE power_pack_purchases;\n")
    # The just-created table is empty; recreate it using the actual candidate migration.
    with (folder/'cash-migration.log').open('w') as log:
        subprocess.run(common+['-f',str(setup)],env=env,stdout=log,stderr=subprocess.STDOUT,check=True,timeout=30)
        subprocess.run(common+['-f',str(root/'prisma/migrations-refund-v3.sql')],env=env,stdout=log,stderr=subprocess.STDOUT,check=True,timeout=30)
