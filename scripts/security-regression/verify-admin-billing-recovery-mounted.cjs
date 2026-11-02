const { run } = require('./admin-billing-mounted-harness.cjs');
run(['http502', 'http503', 'network', 'refresh-failure', 'zero-success', 'unauthorized'], 'PASS Admin billing recovery: ', 'DOYA_ADMIN_BILLING_RECOVERY_RESULT').catch(error => { console.error(error.stack); process.exitCode = 1 });
