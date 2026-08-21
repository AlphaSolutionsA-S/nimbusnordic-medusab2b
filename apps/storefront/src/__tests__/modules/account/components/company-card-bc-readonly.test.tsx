import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { HttpTypes } from '@medusajs/types';

import { updateCompany } from '@/lib/data/companies';
import CompanyCard from '@/modules/account/components/company-card';
import type { QueryCompany } from '@/types/company/query';

jest.mock('@/lib/data/companies', () => ({
  updateCompany: jest.fn().mockResolvedValue({}),
}));

const company: QueryCompany = {
  id: 'company_01',
  name: 'Nimbus Nordic',
  email: 'accounts@nimbusnordic.test',
  phone: null,
  address: null,
  city: null,
  state: null,
  zip: null,
  country: null,
  logo_url: null,
  currency_code: 'usd',
  business_central_customer_number: '123456',
  spending_limit_reset_frequency: 'monthly',
  created_at: '2026-08-19T00:00:00.000Z',
  updated_at: '2026-08-19T00:00:00.000Z',
  deleted_at: null,
};

const regions = [] as HttpTypes.StoreRegion[];

describe('CompanyCard - BC customer number read-only', () => {
  it('TC-1: shows the configured BC number but renders no editable BC input in edit mode', async () => {
    const user = userEvent.setup();

    render(<CompanyCard company={company} regions={regions} />);

    await user.click(screen.getByRole('button', { name: 'Edit' }));

    expect(screen.getAllByText('123456')).toHaveLength(2);
    expect(
      screen.queryByRole('textbox', { name: 'BC Customer Number' })
    ).not.toBeInTheDocument();
  });

  it('TC-2: saving does not include business_central_customer_number in the payload', async () => {
    const user = userEvent.setup();

    render(<CompanyCard company={company} regions={regions} />);

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const companyNameInput = screen.getByDisplayValue('Nimbus Nordic');
    await user.clear(companyNameInput);
    await user.type(companyNameInput, 'Nimbus Nordic Updated');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(updateCompany).toHaveBeenCalledWith(
      expect.not.objectContaining({
        business_central_customer_number: expect.anything(),
      })
    );
  });
});