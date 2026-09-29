import { render, screen } from '@testing-library/react';
import type { HttpTypes } from '@medusajs/types';

import CompanyCard from '@/modules/account/components/company-card';
import type { QueryCompany } from '@/types/company/query';

jest.mock('next/cache', () => ({ revalidateTag: jest.fn() }));
jest.mock('@vercel/analytics/server', () => ({ track: jest.fn() }));
jest.mock('@/lib/data/cookies', () => ({
  getAuthHeaders: jest.fn(),
  getCacheOptions: jest.fn(),
  getCacheTag: jest.fn(),
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
  vat_number: 'DK12345678',
  business_central_customer_number: '123456',
  created_at: '2026-08-19T00:00:00.000Z',
  updated_at: '2026-08-19T00:00:00.000Z',
  deleted_at: null,
};

const regions = [] as HttpTypes.StoreRegion[];

describe('CompanyCard - Business Central fields read-only', () => {
  it('TC-1: shows BC-synchronized values without any editable input', () => {
    render(<CompanyCard company={company} regions={regions} />);

    expect(screen.getByText('123456')).toBeInTheDocument();
    expect(screen.getByText('DK12345678')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('TC-2: the storefront data layer exposes no company update helper', () => {
    const companies = jest.requireActual('@/lib/data/companies');

    expect(companies).not.toHaveProperty('updateCompany');
    expect(companies).toHaveProperty('retrieveCompany');
  });
});
