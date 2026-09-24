type EmployeePage<T> = {
  employees: T[]
  total: number
  page: number
  pageSize: number
}

/** 全ページを取得し、欠落・重複した一覧を「全従業員」として表示しない。 */
export async function loadAllEmployees<T extends { id: string }>(
  readPage: (page: number, pageSize: number) => Promise<EmployeePage<T>>,
  pageSize = 200
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 200) throw new Error('Invalid page size')

  const first = await readPage(1, pageSize)
  const validate = (result: EmployeePage<T>, page: number) => {
    if (!result || !Array.isArray(result.employees) || !Number.isSafeInteger(result.total) || result.total < 0 ||
      result.page !== page || result.pageSize !== pageSize ||
      result.employees.some((employee) => !employee || typeof employee.id !== 'string' || !employee.id)) {
      throw new Error('Invalid employee page')
    }
  }
  validate(first, 1)

  const employees = [...first.employees]
  const pages = Math.ceil(first.total / pageSize)
  for (let page = 2; page <= pages; page++) {
    const result = await readPage(page, pageSize)
    validate(result, page)
    if (result.total !== first.total) throw new Error('Employee list changed during loading')
    employees.push(...result.employees)
  }

  if (employees.length !== first.total || new Set(employees.map((employee) => employee.id)).size !== first.total) {
    throw new Error('Incomplete employee list')
  }
  return employees
}
