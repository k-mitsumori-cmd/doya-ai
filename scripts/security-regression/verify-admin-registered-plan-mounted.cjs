const { run } = require('./admin-billing-mounted-harness.cjs');
run(['dashboard-registration-tiers','dashboard-registration-unknown','analytics-registration-labels'], 'PASS Admin registered plan UI: ', 'DOYA_ADMIN_REGISTERED_PLAN_UI_RESULT').catch(error => { console.error(error.stack); process.exitCode = 1 });
