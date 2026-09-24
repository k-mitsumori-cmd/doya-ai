const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')
const { loadAllEmployees } = load('src/lib/kintai/load-employees.ts');

(async () => {
  await check('all 501 employees remain reachable beyond the first 50 and 200', async () => {
    const rows = Array.from({ length: 501 }, (_, i) => ({ id: `employee-${i}` }))
    const pages = []
    const result = await loadAllEmployees(async (page, pageSize) => {
      pages.push(page)
      return { employees: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize }
    })
    assert.deepEqual(pages, [1, 2, 3])
    assert.equal(result.length, 501)
    assert.equal(result.at(-1).id, 'employee-500')
  })
  await check('failed later page cannot masquerade as a complete employee list', async () => {
    await assert.rejects(loadAllEmployees(async (page, pageSize) => {
      if (page === 2) throw new Error('503')
      return { employees: Array.from({ length: 200 }, (_, i) => ({ id: `employee-${i}` })), total: 201, page, pageSize }
    }), /503/)
  })
  await check('duplicate, changed total, or malformed page is rejected', async () => {
    const first = { employees: [{ id: 'a' }, { id: 'b' }], total: 3, page: 1, pageSize: 2 }
    await assert.rejects(loadAllEmployees(async (page) => page === 1 ? first : { employees: [{ id: 'b' }], total: 3, page: 2, pageSize: 2 }, 2), /Incomplete/)
    await assert.rejects(loadAllEmployees(async (page) => page === 1 ? first : { employees: [{ id: 'c' }], total: 4, page: 2, pageSize: 2 }, 2), /changed/)
    await assert.rejects(loadAllEmployees(async () => ({ employees: [], total: 0, page: 2, pageSize: 2 }), 2), /Invalid/)
  })
})().catch((error) => { console.error(error); process.exitCode = 1 })
