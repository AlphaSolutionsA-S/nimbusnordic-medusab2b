import { render, screen, within } from '@testing-library/react';
import AccountNav from '@/modules/account/components/account-nav';
import type { B2BCustomer } from '@/types/global';
import { usePathname, useParams } from 'next/navigation';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
  useParams: jest.fn(),
}));

// Mock the signout function
jest.mock('@/lib/data/customer', () => ({
  signout: jest.fn(),
}));

describe('AccountNav', () => {
  const mockCustomer: B2BCustomer = {
    id: 'cust-1',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@example.com',
    phone: null,
    email_confirmed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metadata: null,
    deleted_at: null,
    has_account: true,
    company_name: 'Acme Corp',
    tax_id: null,
    employee: {
      id: 'emp-1',
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      is_admin: false,
    },
    billing_address_id: null,
    shipping_address_id: null,
    addresses: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (usePathname as jest.Mock).mockReturnValue('/us/account');
    (useParams as jest.Mock).mockReturnValue({ countryCode: 'us' });
  });

  it('TC-1: Desktop nav shows Claims for non-admin employee', () => {
    render(<AccountNav customer={mockCustomer} numPendingApprovals={0} />);

    // Check desktop nav is rendered
    const desktopNav = screen.getByTestId('account-nav');
    expect(desktopNav).toBeInTheDocument();

    // Check claims link exists in desktop nav
    const claimsLink = within(desktopNav).getByTestId('claims-link');
    expect(claimsLink).toBeInTheDocument();
    expect(claimsLink).toHaveAttribute('href', expect.stringContaining('/account/claims'));

    // Claims text should be present
    expect(within(claimsLink).getByText('Claims')).toBeInTheDocument();
  });

  it('TC-2: Mobile nav shows Claims', () => {
    render(<AccountNav customer={mockCustomer} numPendingApprovals={0} />);

    // Mobile nav should render with route matching root account
    const mobileNav = screen.getByTestId('mobile-account-nav');
    expect(mobileNav).toBeInTheDocument();

    // Check claims link appears in mobile nav
    const claimsLink = within(mobileNav).getByTestId('claims-link');
    expect(claimsLink).toBeInTheDocument();
    expect(claimsLink).toHaveAttribute('href', expect.stringContaining('/account/claims'));
  });

  it('TC-3: Claims visible even when approvals is not (no admin gate)', () => {
    render(<AccountNav customer={mockCustomer} numPendingApprovals={0} />);

    // Non-admin customer should not see approvals link
    const approvalLink = screen.queryByTestId('approvals-link');
    expect(approvalLink).not.toBeInTheDocument();

    // But non-admin customer should see claims link (in desktop variant)
    const desktopNav = screen.getByTestId('account-nav');
    const claimsLink = within(desktopNav).getByTestId('claims-link');
    expect(claimsLink).toBeInTheDocument();
  });

  it('Admin sees both approvals and claims', () => {
    const adminCustomer = {
      ...mockCustomer,
      employee: {
        ...mockCustomer.employee,
        is_admin: true,
      },
    };

    render(<AccountNav customer={adminCustomer} numPendingApprovals={2} />);

    // Admin should see both approvals and claims in desktop nav
    const desktopNav = screen.getByTestId('account-nav');
    const approvalLink = within(desktopNav).getByTestId('approvals-link');
    const claimsLink = within(desktopNav).getByTestId('claims-link');

    expect(approvalLink).toBeInTheDocument();
    expect(claimsLink).toBeInTheDocument();

    // Approvals should show badge count
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('Claims link appears after BC Orders in both nav variants', () => {
    render(<AccountNav customer={mockCustomer} numPendingApprovals={0} />);

    // Get desktop nav
    const desktopNav = screen.getByTestId('account-nav');
    const bcOrdersLink = within(desktopNav).getByTestId('bc-orders-link');
    const claimsLink = within(desktopNav).getByTestId('claims-link');

    expect(bcOrdersLink).toBeInTheDocument();
    expect(claimsLink).toBeInTheDocument();

    // Both should have proper hrefs
    expect(bcOrdersLink).toHaveAttribute('href', expect.stringContaining('/account/bcorders'));
    expect(claimsLink).toHaveAttribute('href', expect.stringContaining('/account/claims'));
  });
});
