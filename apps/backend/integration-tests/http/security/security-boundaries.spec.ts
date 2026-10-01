import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type {
  ICartModuleService,
  IRegionModuleService,
  ISalesChannelModuleService,
  MedusaContainer,
} from '@medusajs/framework/types';
import CompanyModuleService from '../../../src/modules/company/service';
import QuoteModuleService from '../../../src/modules/quote/service';
import ApprovalModuleService from '../../../src/modules/approval/service';
import { ApprovalStatusType, ApprovalType, type IApprovalModuleService } from '../../../src/types';
import { createStoreUser } from '../../utils/admin';
import { generatePublishableKey, generateStoreHeaders } from '../../utils/store';

jest.setTimeout(120_000);

medusaIntegrationTestRunner({
  inApp: true,
  env: { JWT_SECRET: 'supersecret' },
  testSuite: ({ api, getContainer }) => {
    let container: MedusaContainer;
    let headers: { headers: Record<string, string> };
    let publicHeaders: { headers: Record<string, string> };
    let customerId: string;
    let companyId: string;
    let foreignCompanyId: string;
    let companyService: CompanyModuleService;

    beforeEach(async () => {
      container = getContainer();
      publicHeaders = generateStoreHeaders({ publishableKey: await generatePublishableKey(container) });
      const user = await createStoreUser({ api, storeHeaders: publicHeaders });
      customerId = user.customer.id;
      headers = { headers: { ...publicHeaders.headers, authorization: `Bearer ${user.token}` } };
      const response = await api.post('/store/companies', {
        name: 'Own company', email: 'own@example.test', currency_code: 'dkk',
      }, headers);
      companyId = response.data.companies[0].id;
      companyService = container.resolve('company');
      const foreign = await companyService.createCompanies({
        name: 'Foreign empty company', email: 'foreign@example.test', currency_code: 'dkk',
      });
      foreignCompanyId = foreign.id;
    });

    async function createApproval(status: ApprovalStatusType, targetCompany = companyId) {
      const cart = await container.resolve<ICartModuleService>(Modules.CART).createCarts({
        currency_code: 'dkk', customer_id: customerId,
      });
      const service = container.resolve<ApprovalModuleService>('approval');
      const approval = await service.createApprovals({
        cart_id: cart.id, type: ApprovalType.ADMIN, status, created_by: customerId,
      });
      const [approvalStatus] = await container.resolve<IApprovalModuleService>('approval')
        .createApprovalStatuses([{ cart_id: cart.id, status }]);
      await container.resolve(ContainerRegistrationKeys.LINK).create([
        { company: { company_id: targetCompany }, [Modules.CART]: { cart_id: cart.id } },
        { [Modules.CART]: { cart_id: cart.id }, approval: { approval_id: approval.id } },
        { [Modules.CART]: { cart_id: cart.id }, approval: { approval_status_id: approvalStatus.id } },
      ]);
      return { cart, approval, service };
    }

    it('creates the first company administrator on the server and prevents repeat registration', async () => {
      const response = await api.get(`/store/companies/${companyId}`, headers);
      expect(response.data.company.employees).toEqual(expect.arrayContaining([
        expect.objectContaining({ is_admin: true }),
      ]));
      const second = await api.post('/store/companies', {
        name: 'Second', email: 'second@example.test', currency_code: 'dkk',
      }, { ...headers, validateStatus: () => true });
      expect(second.status).toBe(403);
    });

    it.each([['GET', 403], ['POST', 404], ['DELETE', 403]] as const)(
      'denies %s access to another company', async (method, status) => {
        const response = await api.request({
          url: `/store/companies/${foreignCompanyId}`, method, ...headers,
          data: method === 'POST' ? { name: 'Stolen' } : undefined,
          validateStatus: () => true,
        });
        expect(response.status).toBe(status);
        expect((await companyService.retrieveCompany(foreignCompanyId)).name)
          .toBe('Foreign empty company');
      },
    );

    it('denies joining an empty foreign company as its administrator', async () => {
      const response = await api.post(`/store/companies/${foreignCompanyId}/employees`, {
        customer_id: customerId, is_admin: true,
      }, { ...headers, validateStatus: () => true });
      expect(response.status).toBe(403);
    });

    it('ignores a stale global admin role after the employee is demoted', async () => {
      const [employee] = await companyService.listEmployees({ company_id: companyId });
      await companyService.updateEmployees({ id: employee.id, is_admin: false });
      expect((await api.get(`/store/companies/${companyId}`, headers)).status).toBe(200);
      const response = await api.post(`/store/companies/${companyId}/approval-settings`,
        { requires_admin_approval: true }, { ...headers, validateStatus: () => true });
      expect(response.status).toBe(403);
    });

    it.each(['accept', 'reject', 'messages', 'preview'])('denies foreign quote %s', async (operation) => {
      const quotes = container.resolve<QuoteModuleService>('quote');
      const quote = await quotes.createQuotes({
        customer_id: 'foreign-customer', draft_order_id: 'foreign-order',
        order_change_id: 'foreign-change', cart_id: 'foreign-cart', status: 'pending_customer',
      });
      const response = await api.request({
        url: `/store/quotes/${quote.id}/${operation}?fields=id,status,draft_order_id`, ...headers,
        method: operation === 'preview' ? 'GET' : 'POST',
        data: operation === 'messages' ? { text: 'Unauthorized' } : {},
        validateStatus: () => true,
      });
      expect({ status: response.status, body: response.data }).toMatchObject({ status: 404 });
      expect((await quotes.retrieveQuote(quote.id)).status).toBe('pending_customer');
      expect(await quotes.listMessages({ quote_id: quote.id })).toHaveLength(0);
    });

    it('denies deciding another company approval', async () => {
      const { approval, service } = await createApproval(ApprovalStatusType.PENDING, foreignCompanyId);
      const response = await api.post(`/store/approvals/${approval.id}`, { status: 'approved' },
        { ...headers, validateStatus: () => true });
      expect(response.status).toBe(403);
      expect((await service.retrieveApproval(approval.id)).status).toBe('pending');
    });

    it('allows the company administrator to decide a pending approval', async () => {
      const { approval, service } = await createApproval(ApprovalStatusType.PENDING);
      const response = await api.post(`/store/approvals/${approval.id}`, { status: 'approved' }, headers);
      expect(response.status).toBe(200);
      expect((await service.retrieveApproval(approval.id)).status).toBe('approved');
    });

    it('cannot approve a previously rejected request after its cart is edited', async () => {
      const { approval } = await createApproval(ApprovalStatusType.REJECTED);
      const response = await api.post(`/store/approvals/${approval.id}`, { status: 'approved' },
        { ...headers, validateStatus: () => true });
      expect(response.status).toBe(400);
    });

    it.each([ApprovalStatusType.PENDING, ApprovalStatusType.APPROVED])(
      'blocks cart mutations while approval is %s', async (status) => {
        const { cart } = await createApproval(status);
        for (const [method, suffix, data] of [
          ['POST', '', { email: 'changed@example.test' }],
          ['POST', '/line-items', { variant_id: 'variant', quantity: 1 }],
          ['POST', '/line-items/line', { quantity: 2 }],
          ['DELETE', '/line-items/line', undefined],
          ['POST', '/promotions', { promo_codes: ['discount'] }],
          ['DELETE', '/promotions', { promo_codes: ['discount'] }],
          ['POST', '/shipping-methods', { option_id: 'shipping-option' }],
        ] as const) {
          const response = await api.request({
            url: `/store/carts/${cart.id}${suffix}`, method, data, ...headers,
            validateStatus: () => true,
          });
          expect({ method, suffix, status: response.status }).toEqual({ method, suffix, status: 403 });
        }
      },
    );

    it('does not expose Business Central operations', async () => {
      const response = await api.get('/store/business-central/operations', {
        ...headers, validateStatus: () => true,
      });
      expect(response.status).toBe(404);
    });

    it.each(['/store/bc-returns', '/store/bc-returns/1001'])(
      'requires customer authentication for %s',
      async (path) => {
        const response = await api.get(path, { ...publicHeaders, validateStatus: () => true });
        expect(response.status).toBe(401);
      },
    );

    it.each([false, true])('allows cart edits and item deletion with rejected approval: %s',
      async (hasRejectedApproval) => {
        const region = await container.resolve<IRegionModuleService>(Modules.REGION).createRegions({
          name: 'Test region', currency_code: 'dkk', countries: ['dk'],
        });
        const channel = await container.resolve<ISalesChannelModuleService>(Modules.SALES_CHANNEL)
          .createSalesChannels({ name: 'Test channel' });
        const carts = container.resolve<ICartModuleService>(Modules.CART);
        const cart = hasRejectedApproval
          ? (await createApproval(ApprovalStatusType.REJECTED)).cart
          : await carts.createCarts({ currency_code: 'dkk', customer_id: customerId });
        await carts.updateCarts(cart.id, { region_id: region.id, sales_channel_id: channel.id });
        const [item] = await carts.addLineItems([{
          cart_id: cart.id, title: 'Custom test item', quantity: 1, unit_price: 100,
        }]);

        const edited = await api.post(`/store/carts/${cart.id}`, { email: 'edited@example.test' },
          { ...headers, validateStatus: () => true });
        expect({ status: edited.status, body: edited.data }).toMatchObject({
          status: 200, body: { cart: { email: 'edited@example.test' } },
        });
        const deleted = await api.delete(`/store/carts/${cart.id}/line-items/${item.id}`,
          { ...headers, validateStatus: () => true });
        expect({ status: deleted.status, body: deleted.data }).toMatchObject({ status: 200 });
        expect(await carts.listLineItems({ cart_id: cart.id })).toHaveLength(0);
      },
    );

    it('scopes employee IDs to the company in the URL', async () => {
      const foreignEmployee = await companyService.createEmployees({
        company_id: foreignCompanyId, is_admin: true, spending_limit: 0,
      });
      const response = await api.post(`/store/companies/${companyId}/employees/${foreignEmployee.id}`,
        { is_admin: false }, { ...headers, validateStatus: () => true });
      expect(response.status).toBe(404);
      expect((await companyService.retrieveEmployee(foreignEmployee.id)).is_admin).toBe(true);
    });

    it('allows the owner to reject a quote', async () => {
      const quotes = container.resolve<QuoteModuleService>('quote');
      const quote = await quotes.createQuotes({
        customer_id: customerId, draft_order_id: 'draft-order',
        order_change_id: 'order-change', cart_id: 'cart', status: 'pending_customer',
      });
      const response = await api.post(`/store/quotes/${quote.id}/reject?fields=id,status`, {}, headers);
      expect(response.status).toBe(200);
      expect((await quotes.retrieveQuote(quote.id)).status).toBe('customer_rejected');
    });

    it('denies creating a quote from another customer cart', async () => {
      const cart = await container.resolve<ICartModuleService>(Modules.CART).createCarts({
        currency_code: 'dkk', customer_id: 'foreign-customer',
      });
      const response = await api.post('/store/quotes?fields=id,status', { cart_id: cart.id },
        { ...headers, validateStatus: () => true });
      expect(response.status).toBe(404);
      expect(await container.resolve<QuoteModuleService>('quote').listQuotes({ cart_id: cart.id }))
        .toHaveLength(0);
    });

    it('replaces rejected approvals when an edited cart is submitted again', async () => {
      const { cart, approval, service } = await createApproval(ApprovalStatusType.REJECTED);
      const company = await api.get(`/store/companies/${companyId}`, headers);
      await service.updateApprovalSettings({
        id: company.data.company.approval_settings.id, requires_admin_approval: true,
        requires_sales_manager_approval: false,
      });
      const response = await api.post(`/store/carts/${cart.id}/approvals`, {},
        { ...headers, validateStatus: () => true });
      expect(response.data).not.toHaveProperty('message');
      expect(response.status).toBe(200);
      const approvals = await service.listApprovals({ cart_id: cart.id });
      expect(approvals).toHaveLength(1);
      expect(approvals[0]).toMatchObject({ status: 'pending', type: 'admin' });
      expect(approvals[0].id).not.toBe(approval.id);
    });
  },
});
