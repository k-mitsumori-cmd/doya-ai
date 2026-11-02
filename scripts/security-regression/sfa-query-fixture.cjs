// Synthetic query adapter only. Real PostgreSQL policy/aggregation/MVCC tests are separate.
function matches(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'AND') return (Array.isArray(value) ? value : [value]).every(part => matches(row, part));
    if (key === 'OR') return value.some(part => matches(row, part));
    if (key === 'NOT') return !(Array.isArray(value) ? value : [value]).some(part => matches(row, part));
    const actual = row[key];
    if (value instanceof Date) return actual instanceof Date && actual.getTime() === value.getTime();
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.entries(value).every(([operator, operand]) => {
        if (operator === 'in') return operand.includes(actual);
        if (operator === 'not') return operand === null ? actual !== null && actual !== undefined : actual !== null && actual !== undefined && actual !== operand;
        if (operator === 'lt') return actual != null && operand != null && actual < operand;
        if (operator === 'lte') return actual != null && operand != null && actual <= operand;
        if (operator === 'gt') return actual != null && operand != null && actual > operand;
        if (operator === 'gte') return actual != null && operand != null && actual >= operand;
        if (operator === 'contains') return typeof actual === 'string' && (value.mode === 'insensitive' ? actual.toLowerCase().includes(String(operand).toLowerCase()) : actual.includes(String(operand)));
        if (operator === 'mode') return true;
        throw Error('Unsupported synthetic query operator: ' + operator);
      });
    }
    return actual === value;
  });
}
function exact(where, key) {
  if (Object.hasOwn(where, key) && (where[key] === null || typeof where[key] !== 'object')) return where[key];
  const parts = where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : [];
  const values = parts.map(part => exact(part, key)).filter(value => value !== undefined);
  return values.length && values.every(value => value === values[0]) ? values[0] : undefined;
}
module.exports = { matches, exact };
