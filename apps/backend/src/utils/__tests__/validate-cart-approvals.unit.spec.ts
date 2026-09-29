import { validateCartApprovals } from '../validate-cart-approvals';

describe('checkout approvals', () => {
  const company = {
    approval_settings: { requires_admin_approval: true, requires_sales_manager_approval: true },
  };

  it('blocks checkout when required approvals were never requested', () => {
    expect(() => validateCartApprovals({ company, approvals: [] })).toThrow('requires approval');
  });

  it('uses the customer company even when the cart company link is missing', () => {
    expect(() => validateCartApprovals({ customer: { employee: { company } } })).toThrow();
  });

  it.each(['pending', 'rejected'])('blocks a %s approval', (status) => {
    expect(() => validateCartApprovals({ company, approvals: [
      { type: 'admin', status: 'approved' },
      { type: 'sales_manager', status },
    ] })).toThrow();
  });

  it('requires each approval type, not just one approved record', () => {
    expect(() => validateCartApprovals({ company, approvals: [
      { type: 'admin', status: 'approved' },
    ] })).toThrow();
  });

  it('permits checkout after all required approvals', () => {
    expect(() => validateCartApprovals({ company, approvals: [
      { type: 'admin', status: 'approved' },
      { type: 'sales_manager', status: 'approved' },
    ] })).not.toThrow();
  });

  it('permits carts without approval requirements', () => {
    expect(() => validateCartApprovals({ approvals: [] })).not.toThrow();
  });
});
