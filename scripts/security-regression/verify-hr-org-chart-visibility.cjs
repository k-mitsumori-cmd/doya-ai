const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { load } = require('./load-typescript.cjs');
const file = 'src/app/api/hr/org-chart/route.ts';
const privateResponse = load('src/lib/private-api-response.ts', { 'next/server': { NextResponse: Response } });
const cases = [];
function ids(nodes) { return nodes.flatMap(n => [...n.employees.map(e => e.id), ...ids(n.children)]); }
(async () => {
  for (const scenario of ['active-root', 'active-child-of-inactive-parent', 'employee-in-inactive-department', 'unassigned-employee']) {
    const department = { id: 'synthetic-dept', parentId: scenario === 'active-child-of-inactive-parent' ? 'synthetic-inactive-parent' : null, sortOrder: 0, name: 'Synthetic', code: null, managerId: null, isActive: true };
    const employee = { id: 'synthetic-employee', departmentId: scenario === 'unassigned-employee' ? null : scenario === 'employee-in-inactive-department' ? 'synthetic-inactive-parent' : department.id, firstName: 'Synthetic', lastName: 'Employee', position: null, photoUrl: null, employeeNumber: 'SYNTHETIC' };
    const api = load(file, {
      '@/lib/hr/org-chart-pagination': { readHrOrgChartPage() { throw Error('Legacy fixture unexpectedly entered paged GET') }, HrOrgChartPageError: class extends Error {} }, 'next/server': { NextResponse: Response },
      '@/lib/private-api-response': privateResponse,
      '@/lib/hr/types': {},
      '@/lib/hr/access': { getHrContext: async () => ({ organizationId: 'synthetic-org', employeeId: employee.id, role: 'MANAGER' }), hasMinRole: () => true },
      '@/lib/prisma': { prisma: {
        hrOrganization: { findUnique: async q => { assert.equal(q.where.id, 'synthetic-org'); return { name: 'Synthetic org' }; } },
        hrDepartment: { findMany: async q => { assert.equal(q.where.organizationId, 'synthetic-org'); assert.equal(q.where.isActive, true); return [department]; } },
        hrEmployee: { findMany: async q => { assert.equal(q.where.organizationId, 'synthetic-org'); assert.equal(q.where.status, 'ACTIVE'); return [employee]; } },
      } },
    });
    const response = await api.GET();
    assert.equal(response.status, 200);
    const body = await response.json();
    const visible = [...ids(body.orgChart), ...body.unassignedEmployees.map(e => e.id)];
    cases.push({ scenario, employeeRepresented: visible.includes(employee.id), exactlyOnce: visible.filter(id => id === employee.id).length === 1, renderedDepartmentIds: body.orgChart.map(n => n.department.id), unassignedIds: body.unassignedEmployees.map(e => e.id) });
  }
  const report = { checkedAt: new Date().toISOString(), expected: 4, passed: cases.filter(c => c.employeeRepresented && c.exactlyOnce).length, cases, sourceHashes: { [file]: crypto.createHash('sha256').update(fs.readFileSync(process.env.DOYA_TEST_BASELINE ? require('node:path').join(process.env.DOYA_TEST_BASELINE, file) : file)).digest('hex') }, scope: 'Actual GET with synthetic organization-filtered rows. Checks representation of authorized ACTIVE employees when departments are inactive or have inactive parents. No production data, database, provider, or customer mutation. Client display of unassignedEmployees requires separate verification.' };
  assert.equal(report.passed, 4);
  console.log(JSON.stringify(report));
})().catch(error => { console.error(error); process.exitCode = 1; });
