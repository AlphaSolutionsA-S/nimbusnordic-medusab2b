const assert = require('node:assert/strict');
const { prepareRetrieveQuery, prepareListQuery } = require('../../apps/backend/node_modules/@medusajs/framework/dist/http/utils/get-query-config.js');
const { validateRelationsLimit } = require('../../apps/backend/node_modules/@medusajs/framework/dist/http/utils/relations-limit.js');
const defaults = ['id', 'created_at', 'customer.email', 'customer.employee.spending_limit', 'customer.employee.company.name', 'messages.admin.first_name', 'messages.customer.last_name', '*draft_order.items.variant.product'];
const allowed = defaults.map(field => field.replace(/^\*/, ''));
async function main() {
  const config = { defaults, allowed };
  for (const fields of ['+customer.employee.company.credit_limit,+messages.admin.email', '*customer,*customer.employee,*customer.employee.company,*messages.admin,*messages.customer', 'customer.employee.company.*,messages.admin.*,messages.customer.*', 'id,customer.employee.company.employees.spending_limit', 'id,customer.employee.company.credit_limit']) {
    const result = await prepareRetrieveQuery({ fields }, config);
    assert(!result.remoteQueryConfig.fields.some(field => /credit_limit|employees|admin.email/.test(field)));
    assert(!result.remoteQueryConfig.fields.some(field => ['customer.*', 'customer.employee.*', 'customer.employee.company.*', 'messages.admin.*', 'messages.customer.*'].includes(field)));
  }
  const first = await prepareRetrieveQuery({}, config);
  const second = await prepareRetrieveQuery({}, config);
  assert.deepEqual(first, second);
  validateRelationsLimit(first.remoteQueryConfig.fields, 4);
  assert.throws(() => validateRelationsLimit(first.remoteQueryConfig.fields, 3));
  const parallel = await Promise.all(Array.from({ length: 10 }, () => prepareRetrieveQuery({}, config)));
  parallel.forEach(result => assert.deepEqual(result, first));
  const sort = await prepareListQuery({ order: '-created_at' }, { ...config, isList: true });
  assert.deepEqual(sort.remoteQueryConfig.pagination.order, { created_at: 'DESC' });
  await assert.rejects(prepareListQuery({ order: 'customer.employee.company.credit_limit' }, config));
  const narrow = await prepareRetrieveQuery({ fields: 'id,customer.employee.company.name' }, config);
  assert.deepEqual(narrow.remoteQueryConfig.fields, ['id', 'customer.employee.company.name']);
  console.log('PASS: five expansion forms stripped; missing fields deterministic across repeated and ten concurrent calls; safe field retained; created_at sort retained; forbidden sort rejected; depth four passes and depth three rejects existing product relation. Query-config probe only, no HTTP/database verification.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
