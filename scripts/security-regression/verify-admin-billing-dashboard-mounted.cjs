const { run } = require('./admin-billing-mounted-harness.cjs');
run(['dashboard-success', 'dashboard-finance-error', 'dashboard-counts-error', 'dashboard-refresh-error'], 'PASS Admin billing dashboard: ', 'DOYA_ADMIN_BILLING_DASHBOARD_RESULT').catch(error => { console.error(error.stack); process.exitCode = 1 });
