import { inspect } from 'node:util';
import jwt from 'jsonwebtoken';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { createCartWorkflow } from '@medusajs/core-flows';
import { ApiKeyType, ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type {
  IApiKeyModuleService,
  ICartModuleService,
  IPaymentModuleService,
  IRegionModuleService,
  ISalesChannelModuleService,
  MedusaContainer,
} from '@medusajs/framework/types';
import CompanyModuleService from '../../../src/modules/company/service';
import QuoteModuleService from '../../../src/modules/quote/service';
import ApprovalModuleService from '../../../src/modules/approval/service';
import { singleLineCanonicalOrder } from
  '../../../src/modules/order-ingestion/__fixtures__/canonical-order-fixtures';
import { ApprovalStatusType, ApprovalType, type IApprovalModuleService } from '../../../src/types';
import { STOREFRONT_TRANSLATION_MODULE } from '../../../src/modules/storefront-translation';
import type StorefrontTranslationModuleService from '../../../src/modules/storefront-translation/service';
import { createAdminSession, createAdminUser, createStoreUser } from '../../utils/admin';
import { generatePublishableKey, generateStoreHeaders } from '../../utils/store';
import {
  createApiCustomerCompany,
  EXAMPLE_SHIPMENT_NOTICE_PAYLOAD,
  orderApiSecretHeaders,
  storeShipmentNoticeRevision,
} from '../../utils/shipment-notices';

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

    it.each(['none', 'customer', 'publishable'] as const)(
      'denies %s credentials on both admin shipment tracking endpoints', async (credentials) => {
        const selected = credentials === 'customer' ? headers : credentials === 'publishable' ? publicHeaders : { headers: {} };
        for (const [method, url] of [
          ['GET', '/admin/shipment-tracking'],
          ['POST', '/admin/shipment-tracking/shtr_missing/retry'],
        ]) {
          const response = await api.request({ method, url, ...selected, data: method === 'POST' ? {} : undefined, validateStatus: () => true });
          expect({ method, status: response.status }).toEqual({ method, status: 401 });
        }
      },
    );

    async function attachAdminApproval(cartId: string, status: ApprovalStatusType, createdBy: string) {
      const service = container.resolve<ApprovalModuleService>('approval');
      const approval = await service.createApprovals({
        cart_id: cartId, type: ApprovalType.ADMIN, status, created_by: createdBy,
      });
      const [approvalStatus] = await container.resolve<IApprovalModuleService>('approval')
        .createApprovalStatuses([{ cart_id: cartId, status }]);
      await container.resolve(ContainerRegistrationKeys.LINK).create([
        { [Modules.CART]: { cart_id: cartId }, approval: { approval_id: approval.id } },
        { [Modules.CART]: { cart_id: cartId }, approval: { approval_status_id: approvalStatus.id } },
      ]);
      return { approval, service };
    }

    async function createApproval(status: ApprovalStatusType, targetCompany = companyId) {
      const cart = await container.resolve<ICartModuleService>(Modules.CART).createCarts({
        currency_code: 'dkk', customer_id: customerId,
      });
      await container.resolve(ContainerRegistrationKeys.LINK).create(
        { company: { company_id: targetCompany }, [Modules.CART]: { cart_id: cart.id } },
      );
      const { approval, service } = await attachAdminApproval(cart.id, status, customerId);
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

    // NIMBUS-192: an unknown customer number gets a generic 404 that never echoes the number.
    it('answers an unknown order API customer number without revealing it', async () => {
      const secretKey = await container.resolve<IApiKeyModuleService>(Modules.API_KEY)
        .createApiKeys({ title: 'orderapi key', type: ApiKeyType.SECRET, created_by: 'test' });
      const response = await api.post('/orderapi/orders?customerNumber=unknown-security-customer',
        { ...singleLineCanonicalOrder, externalOrderNumber: 'SECURITY-UNKNOWN-CUSTOMER-1' },
        { headers: { authorization: `Basic ${secretKey.token}` }, validateStatus: () => true });
      expect(response.status).toBe(404);
      expect(response.data).toEqual({ type: 'not_found', message: 'Customer not found' });
      expect(JSON.stringify(response.data)).not.toContain('unknown-security-customer');
    });

    // NIMBUS-130: shipment notices carry names and addresses; only the Logic App's secret key reads
    // them, and only for the company the customer number resolves to.
    describe('GET /orderapi/shipment-notices', () => {
      const path = '/orderapi/shipment-notices?customerNumber=security-notices-a';
      const seed = (company_id: string, bc_shipment_id: string, order_id?: string) =>
        storeShipmentNoticeRevision(container, {
          company_id, bc_shipment_id, revision: 1,
          payload: { ...EXAMPLE_SHIPMENT_NOTICE_PAYLOAD, order_id: order_id ?? 'order_own' },
        });

      it.each([
        ['no authentication', () => ({})],
        ['a publishable key', () => publicHeaders.headers],
      ])('rejects %s with 401', async (_label, requestHeaders) => {
        const companyA = await createApiCustomerCompany(container, 'security-notices-a');
        await seed(companyA, 'security-ship-a');
        const response = await api.get(path,
          { headers: requestHeaders(), validateStatus: () => true });
        expect(response.status).toBe(401);
        expect(JSON.stringify(response.data)).not.toContain('shipment_notices');
      });

      it("never returns another company's notices", async () => {
        const companyA = await createApiCustomerCompany(container, 'security-notices-a');
        const companyB = await createApiCustomerCompany(container, 'security-notices-b');
        await seed(companyB, 'security-ship-b1', 'order_foreign');
        const own = await seed(companyA, 'security-ship-a');
        await seed(companyB, 'security-ship-b2', 'order_foreign');

        const response = await api.get(path, { headers: await orderApiSecretHeaders(container) });
        expect(response.status).toBe(200);
        expect(response.data.shipment_notices.map((notice) => [notice.cursor, notice.order_id]))
          .toEqual([[String(own), 'order_own']]);
        expect(response.data.has_more).toBe(false);
      });

      it('answers an unknown customer number with a 404 that does not reveal it', async () => {
        const response = await api.get(
          '/orderapi/shipment-notices?customerNumber=unknown-notices-customer',
          { headers: await orderApiSecretHeaders(container), validateStatus: () => true });
        expect(response.status).toBe(404);
        expect(response.data).toEqual({ type: 'not_found', message: 'Customer not found' });
        expect(JSON.stringify(response.data)).not.toContain('unknown-notices-customer');
      });
    });

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
        if (!hasRejectedApproval) {
          // An employee's unlinked cart is ambiguous and refused (NIMBUS-177).
          await container.resolve(ContainerRegistrationKeys.LINK).create(
            { company: { company_id: companyId }, [Modules.CART]: { cart_id: cart.id } },
          );
        }
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

    // NIMBUS-177: carts are personal. Creation needs a signed-in customer, and the company link
    // comes from the owner's employee record, never from client metadata.
    describe('POST /store/carts', () => {
      let regionId: string;
      const carts = () => container.resolve<ICartModuleService>(Modules.CART);

      async function cartCompany(cartId: string) {
        const { data: [cart] } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
          entity: 'cart', fields: ['id', 'customer_id', 'company.id'], filters: { id: cartId },
        });
        return { customer_id: cart.customer_id, company_id: cart.company?.id ?? null };
      }

      beforeEach(async () => {
        regionId = (await container.resolve<IRegionModuleService>(Modules.REGION).createRegions({
          name: 'Cart region', currency_code: 'dkk', countries: ['dk'],
        })).id;
      });

      // Without a publishable key the store routes already answer 400; the key alone is anonymous.
      it('answers an anonymous caller with 401 and creates no cart', async () => {
        const response = await api.post('/store/carts', {
          region_id: regionId, metadata: { company_id: companyId },
        }, { ...publicHeaders, validateStatus: () => true });
        expect(response.status).toBe(401);
        expect(await carts().listCarts({})).toHaveLength(0);
      });

      it("links an employee's cart to their own company, ignoring a forged metadata.company_id", async () => {
        const response = await api.post('/store/carts', {
          region_id: regionId, metadata: { company_id: foreignCompanyId },
        }, headers);
        expect(response.status).toBe(200);
        const link = await cartCompany(response.data.cart.id);
        expect(typeof link.customer_id).toBe('string');
        expect(typeof link.company_id).toBe('string');
        expect(link).toEqual({ customer_id: customerId, company_id: companyId });
      });

      it('creates a cart with no company link for a customer who is not an employee', async () => {
        const outsider = await createStoreUser({
          api, storeHeaders: publicHeaders, email: 'outsider@example.test',
        });
        const response = await api.post('/store/carts', {
          region_id: regionId, metadata: { company_id: companyId },
        }, { headers: { ...publicHeaders.headers, authorization: `Bearer ${outsider.token}` } });
        expect(response.status).toBe(200);
        expect(await cartCompany(response.data.cart.id))
          .toEqual({ customer_id: outsider.customer.id, company_id: null });
      });

      it('fails cart creation without a customer and leaves no cart behind', async () => {
        await expect(createCartWorkflow(container).run({
          input: { region_id: regionId, metadata: { company_id: companyId } },
        })).rejects.toMatchObject({ message: 'A signed-in customer is required to create a cart' });
        expect(await carts().listCarts({})).toHaveLength(0);
      });
    });

    // NIMBUS-177: every route that reads or changes a cart, directly or through a cart_id or a
    // payment collection, needs a signed-in customer, and answers a caller who is not entitled to
    // the cart exactly as it answers a cart that does not exist.
    describe('cart access guard', () => {
      type Target = { cartId: string; collectionId: string; lineId: string };
      type Operation = 'read' | 'owner' | 'pay';
      type GuardedRoute = readonly [Operation, string, (t: Target) => string, ((t: Target) => object)?];
      type Member = { customerId: string; employeeId: string; headers: { headers: Record<string, string> } };

      const NOT_FOUND = { type: 'not_found', message: 'Cart not found' };
      const MISSING: Target = { cartId: 'cart_missing', collectionId: 'pay_col_missing', lineId: 'line_missing' };
      const ROUTES: GuardedRoute[] = [
        ['read', 'GET', (t) => `/store/carts/${t.cartId}`],
        ['read', 'GET', (t) => `/store/shipping-options?cart_id=${t.cartId}`],
        ['read', 'POST', () => '/store/shipping-options/so_unknown/calculate', (t) => ({ cart_id: t.cartId })],
        ['read', 'GET', (t) => `/store/free-shipping/prices?cart_id=${t.cartId}`],
        ['owner', 'POST', (t) => `/store/carts/${t.cartId}`, () => ({ email: 'taken@example.test' })],
        ['owner', 'POST', (t) => `/store/carts/${t.cartId}/customer`, () => ({})],
        ['owner', 'POST', (t) => `/store/carts/${t.cartId}/line-items`, () => ({ variant_id: 'variant', quantity: 1 })],
        ['owner', 'POST', (t) => `/store/carts/${t.cartId}/line-items/${t.lineId}`, () => ({ quantity: 2 })],
        ['owner', 'DELETE', (t) => `/store/carts/${t.cartId}/line-items/${t.lineId}`],
        ['owner', 'POST', (t) => `/store/carts/${t.cartId}/line-items/bulk`,
          () => ({ line_items: [{ variant_id: 'variant', quantity: 1 }] })],
        ['owner', 'POST', (t) => `/store/carts/${t.cartId}/promotions`, () => ({ promo_codes: ['discount'] })],
        ['owner', 'DELETE', (t) => `/store/carts/${t.cartId}/promotions`, () => ({ promo_codes: ['discount'] })],
        ['owner', 'POST', (t) => `/store/carts/${t.cartId}/shipping-methods`, () => ({ option_id: 'so_unknown' })],
        ['owner', 'POST', (t) => `/store/carts/${t.cartId}/taxes`, () => ({})],
        ['owner', 'POST', (t) => `/store/carts/${t.cartId}/approvals`, () => ({})],
        ['owner', 'POST', () => '/store/quotes?fields=id', (t) => ({ cart_id: t.cartId })],
        ['pay', 'POST', () => '/store/payment-collections', (t) => ({ cart_id: t.cartId })],
        ['pay', 'POST', (t) => `/store/payment-collections/${t.collectionId}/payment-sessions`,
          () => ({ provider_id: 'pp_system_default' })],
        ['pay', 'POST', (t) => `/store/carts/${t.cartId}/complete`],
      ];
      const routesOf = (...operations: Operation[]) =>
        ROUTES.filter(([operation]) => operations.includes(operation));
      const label = ([, method, url]: GuardedRoute) => `${method} ${url(MISSING)}`;

      let regionId: string;
      let channelId: string;
      let colleague: Member;
      let foreignAdmin: { headers: Record<string, string> };

      const send = (route: GuardedRoute, target: Target, as: { headers: Record<string, string> }) =>
        api.request({
          method: route[1], url: route[2](target), data: route[3]?.(target), ...as,
          validateStatus: () => true,
        });

      async function login(email: string) {
        const { token } = (await api.post('/auth/customer/emailpass', { email, password: 'password' })).data;
        return { headers: { ...publicHeaders.headers, authorization: `Bearer ${token}` } };
      }

      async function addColleague(email: string): Promise<Member> {
        const response = await api.post(`/store/companies/${companyId}/employees`, {
          email, password: 'password', first_name: 'Col', last_name: 'League', spending_limit: 0,
          is_admin: false,
        }, headers);
        const memberHeaders = await login(email);
        const me = await api.get('/store/customers/me', memberHeaders);
        return { customerId: me.data.customer.id, employeeId: response.data.employee.id, headers: memberHeaders };
      }

      async function seedCart(
        ownerId: string, linkedCompany: string | null, email = 'owner@example.test',
      ): Promise<Target> {
        const cartModule = container.resolve<ICartModuleService>(Modules.CART);
        const cart = await cartModule.createCarts({
          currency_code: 'dkk', customer_id: ownerId, email,
          region_id: regionId, sales_channel_id: channelId,
        });
        const [item] = await cartModule.addLineItems([{
          cart_id: cart.id, title: 'Custom test item', quantity: 1, unit_price: 100,
        }]);
        const collection = await container.resolve<IPaymentModuleService>(Modules.PAYMENT)
          .createPaymentCollections({ currency_code: 'dkk', amount: 100 });
        await container.resolve(ContainerRegistrationKeys.LINK).create([
          { [Modules.CART]: { cart_id: cart.id }, [Modules.PAYMENT]: { payment_collection_id: collection.id } },
          ...(linkedCompany
            ? [{ company: { company_id: linkedCompany }, [Modules.CART]: { cart_id: cart.id } }]
            : []),
        ]);
        return { cartId: cart.id, collectionId: collection.id, lineId: item.id };
      }

      async function cartState(target: Target) {
        const { data: [cart] } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
          entity: 'cart',
          fields: [
            'customer_id', 'email', 'completed_at', 'company.id', 'items.id', 'items.quantity',
            'shipping_methods.id', 'approvals.id', 'approvals.status',
          ],
          filters: { id: target.cartId },
        });
        const sessions = await container.resolve<IPaymentModuleService>(Modules.PAYMENT)
          .listPaymentSessions({ payment_collection_id: target.collectionId });
        const quotes = await container.resolve<QuoteModuleService>('quote').listQuotes({ cart_id: target.cartId });
        return { cart, sessions: sessions.length, quotes: quotes.length };
      }

      async function expectRefused(
        routes: GuardedRoute[], target: Target, as: { headers: Record<string, string> },
      ) {
        for (const route of routes) {
          const missing = await send(route, MISSING, as);
          expect({ route: label(route), body: missing.data }).toEqual({ route: label(route), body: NOT_FOUND });
          const refused = await send(route, target, as);
          expect({
            route: label(route), status: refused.status, body: refused.data,
            cache: refused.headers['cache-control'],
          }).toEqual({ route: label(route), status: 404, body: missing.data, cache: 'private, no-store' });
        }
      }

      async function expectReachesRoute(
        routes: GuardedRoute[], target: Target, as: { headers: Record<string, string> },
      ) {
        for (const route of routes) {
          const response = await send(route, target, as);
          expect({ route: label(route), status: response.status, body: response.data })
            .not.toMatchObject({ status: 404, body: NOT_FOUND });
          expect({ route: label(route), status: response.status }).not.toEqual({ route: label(route), status: 401 });
        }
      }

      beforeEach(async () => {
        regionId = (await container.resolve<IRegionModuleService>(Modules.REGION).createRegions({
          name: 'Guard region', currency_code: 'dkk', countries: ['dk'],
        })).id;
        channelId = (await container.resolve<ISalesChannelModuleService>(Modules.SALES_CHANNEL)
          .createSalesChannels({ name: 'Guard channel' })).id;
        colleague = await addColleague('colleague@example.test');
        const outsider = await createStoreUser({ api, storeHeaders: publicHeaders, email: 'foreign-admin@example.test' });
        foreignAdmin = { headers: { ...publicHeaders.headers, authorization: `Bearer ${outsider.token}` } };
        await api.post('/store/companies', {
          name: 'Other company', email: 'other@example.test', currency_code: 'dkk',
        }, foreignAdmin);
      });

      it('answers an anonymous caller with 401 on every guarded route and changes nothing', async () => {
        const target = await seedCart(customerId, companyId);
        const before = await cartState(target);
        for (const route of ROUTES) {
          const response = await send(route, target, publicHeaders);
          expect({ route: label(route), status: response.status }).toEqual({ route: label(route), status: 401 });
        }
        expect(await cartState(target)).toEqual(before);
      });

      it.each([
        ['an administrator of another company', async () => ({ target: await seedCart(customerId, companyId), as: foreignAdmin })],
        ['a same-company colleague', async () => ({ target: await seedCart(customerId, companyId), as: colleague.headers })],
        ['the owner after leaving the company', async () => {
          const target = await seedCart(colleague.customerId, companyId);
          expect((await api.delete(`/store/companies/${companyId}/employees/${colleague.employeeId}`, headers)).status)
            .toBe(200);
          return { target, as: colleague.headers };
        }],
        ["the owner of an employee's cart with no company link", async () => ({
          target: await seedCart(customerId, null), as: headers,
        })],
        ['the owner of a cart linked to another company', async () => ({
          target: await seedCart(customerId, foreignCompanyId), as: headers,
        })],
        ['an administrator when the cart has no admin approval', async () => ({
          target: await seedCart(colleague.customerId, companyId), as: headers,
        })],
      ])('refuses %s on every guarded route like a missing cart and changes nothing', async (_label, setup) => {
        const { target, as } = await setup();
        const before = await cartState(target);
        await expectRefused(ROUTES, target, as);
        expect(await cartState(target)).toEqual(before);
      });

      it('refuses a stranger before the frozen-cart check on a cart under approval', async () => {
        const target = await seedCart(customerId, companyId);
        await attachAdminApproval(target.cartId, ApprovalStatusType.PENDING, customerId);
        const before = await cartState(target);
        await expectRefused(routesOf('owner'), target, colleague.headers);
        expect(await cartState(target)).toEqual(before);
      });

      it('never lets a non-owner take a cart over through the customer route', async () => {
        const target = await seedCart(customerId, companyId);
        const response = await api.post(`/store/carts/${target.cartId}/customer`, {},
          { ...colleague.headers, validateStatus: () => true });
        expect(response.status).toBe(404);
        expect((await cartState(target)).cart.customer_id).toBe(customerId);
      });

      it('lets the owner read and edit an editable cart', async () => {
        const target = await seedCart(customerId, companyId);
        const read = await api.get(`/store/carts/${target.cartId}`, headers);
        expect({ status: read.status, id: read.data.cart.id, cache: read.headers['cache-control'] })
          .toEqual({ status: 200, id: target.cartId, cache: 'private, no-store' });
        const edited = await api.post(`/store/carts/${target.cartId}`, { email: 'edited@example.test' }, headers);
        expect(edited.data.cart.email).toBe('edited@example.test');
        const kept = await api.post(`/store/carts/${target.cartId}/customer`, {}, headers);
        expect(kept.data.cart.customer_id).toBe(customerId);
        await expectReachesRoute(ROUTES, target, headers);
      });

      it('lets an administrator read but not pay or edit a cart under pending approval', async () => {
        const target = await seedCart(colleague.customerId, companyId);
        await attachAdminApproval(target.cartId, ApprovalStatusType.PENDING, colleague.customerId);
        const before = await cartState(target);
        const read = await api.get(`/store/carts/${target.cartId}`, headers);
        expect({ status: read.status, id: read.data.cart.id }).toEqual({ status: 200, id: target.cartId });
        await expectReachesRoute(routesOf('read'), target, headers);
        await expectRefused(routesOf('owner', 'pay'), target, headers);
        expect(await cartState(target)).toEqual(before);
      });

      it('lets an administrator pay but never edit an approved cart', async () => {
        const target = await seedCart(colleague.customerId, companyId);
        await attachAdminApproval(target.cartId, ApprovalStatusType.APPROVED, colleague.customerId);
        const before = await cartState(target);
        await expectRefused(routesOf('owner'), target, headers);
        expect(await cartState(target)).toEqual(before);
        await expectReachesRoute(routesOf('read', 'pay'), target, headers);
      });

      // An administrator neither sees nor decides approvals for a cart whose association is not
      // verified: the owner left the company, or the link differs from the owner's company.
      describe('approval list and decisions', () => {
        type Seeded = { target: Target; approvalId: string; email: string };
        let listed: Seeded;
        let omitted: Seeded[];

        async function seedPending(ownerId: string, email: string): Promise<Seeded> {
          const target = await seedCart(ownerId, companyId, email);
          const { approval } = await attachAdminApproval(target.cartId, ApprovalStatusType.PENDING, ownerId);
          return { target, approvalId: approval.id, email };
        }

        async function approvalState(seeded: Seeded) {
          const service = container.resolve<ApprovalModuleService>('approval');
          const { data: statuses } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
            entity: 'approval_status', fields: ['status'], filters: { cart_id: seeded.target.cartId },
          });
          return {
            approval: (await service.retrieveApproval(seeded.approvalId)).status,
            statuses: statuses.map((status) => status.status),
          };
        }

        beforeEach(async () => {
          listed = await seedPending(colleague.customerId, 'listed-cart@example.test');
          const leaver = await addColleague('leaver@example.test');
          const left = await seedPending(leaver.customerId, 'leaver-cart@example.test');
          expect((await api.delete(`/store/companies/${companyId}/employees/${leaver.employeeId}`, headers)).status)
            .toBe(200);
          const foreignOwner = (await api.get('/store/customers/me', foreignAdmin)).data.customer.id;
          const mismatched = await seedPending(foreignOwner, 'mismatched-cart@example.test');
          omitted = [left, mismatched];
        });

        it('lists only carts with a verified association and leaks nothing of the others', async () => {
          const response = await api.get('/store/approvals', headers);
          expect(response.status).toBe(200);
          const carts = response.data.carts_with_approvals;
          expect(carts.map((cart) => cart.id)).toEqual([listed.target.cartId]);
          expect(typeof carts[0].email).toBe('string');
          expect(carts[0].approvals.map((approval) => approval.id)).toEqual([listed.approvalId]);
          expect(response.data.count).toBe(1);
          const body = JSON.stringify(response.data);
          for (const { target, approvalId, email } of omitted) {
            for (const leaked of [target.cartId, target.lineId, approvalId, email]) {
              expect(body).not.toContain(leaked);
            }
          }
        });

        it.each([['whose owner left the company', 0], ['linked to a company the owner is not in', 1]])(
          'refuses deciding the approval of a cart %s and leaves it pending', async (_label, index) => {
            const seeded = omitted[index];
            const before = await approvalState(seeded);
            expect(before).toEqual({ approval: 'pending', statuses: ['pending'] });
            for (const status of ['approved', 'rejected']) {
              const response = await api.post(`/store/approvals/${seeded.approvalId}`, { status },
                { ...headers, validateStatus: () => true });
              expect({ status, code: response.status }).toEqual({ status, code: 403 });
            }
            expect(await approvalState(seeded)).toEqual(before);
          },
        );
      });
    });

    // NIMBUS-176: country-language management and language activation accept only the Admin
    // dashboard's session cookie. Bearer tokens and API keys are refused even for an admin user,
    // so logging out of the dashboard ends write access.
    describe('country-language Admin routes', () => {
      type RequestHeaders = Record<string, string>;
      let adminBearer: { headers: RequestHeaders };
      let adminSession: { headers: RequestHeaders };
      let adminUserId: string;
      const translations = () =>
        container.resolve<StorefrontTranslationModuleService>(STOREFRONT_TRANSLATION_MODULE);
      const routes = [
        ['GET', '/admin/country-languages', undefined, 200],
        ['POST', '/admin/country-languages/dk', { locale: 'en', expected_version: 1 }, 200],
        // English can never be deactivated: reaching that rule proves authentication passed.
        ['POST', '/admin/ui-translations/en/activation', { expected_version: 2, is_active: false }, 409],
      ] as const;

      async function state() {
        const [english] = await translations().listStorefrontTranslations({ locale: 'en' });
        return {
          configuration: await translations().getCountryLanguageConfiguration(),
          english: { is_active: english.is_active, version: english.version },
        };
      }

      beforeEach(async () => {
        adminBearer = { headers: {} };
        adminUserId = (await createAdminUser(adminBearer, container)).user.id;
        adminSession = await createAdminSession(api);
        await translations().mutateDocument({
          operation: 'import',
          input: { locale: 'en', expected_version: null, mode: 'replace', messages: { A: { b: 'B' } }, confirm_removed: false },
        });
        await translations().mutateDocument({ operation: 'activate', locale: 'en', expected_version: 1, is_active: true });
        await translations().bootstrapCountryLanguages({});
        await container.resolve<IRegionModuleService>(Modules.REGION).createRegions({
          name: 'Nordics', currency_code: 'dkk', countries: ['dk'],
        });
      });

      const credentials: Array<[string, () => Promise<RequestHeaders>]> = [
        ['no credentials', async () => ({})],
        ['a publishable key', async () => publicHeaders.headers],
        ['a customer token', async () => headers.headers],
        ['a customer session', async () => {
          const response = await api.post('/auth/session', {}, { headers: { authorization: headers.headers.authorization } });
          return { cookie: response.headers['set-cookie'][0].split(';')[0] };
        }],
        ['a secret API key', async () => {
          const key = await container.resolve<IApiKeyModuleService>(Modules.API_KEY)
            .createApiKeys({ title: 'admin key', type: ApiKeyType.SECRET, created_by: 'test' });
          return { authorization: `Basic ${key.token}` };
        }],
        ['a valid admin bearer token without a session', async () => adminBearer.headers],
        ['a bearer token spoofing the admin actor', async () => ({
          authorization: `Bearer ${jwt.sign({ actor_id: adminUserId, actor_type: 'user', auth_identity_id: 'x' }, 'not-the-secret')}`,
        })],
        ['a forged session cookie', async () => ({ cookie: 'connect.sid=s%3Aforged-session.c2lnbmF0dXJl' })],
        ['a logged-out session cookie', async () => {
          const ended = await createAdminSession(api);
          expect((await api.delete('/auth/session', ended)).status).toBe(200);
          return ended.headers;
        }],
      ];

      it.each(credentials)('rejects %s without a write or leaked session data', async (_label, credential) => {
        const requestHeaders = await credential();
        const before = await state();
        for (const [method, url, data] of routes) {
          const response = await api.request({ method, url, data, headers: requestHeaders, validateStatus: () => true });
          expect({ url, status: response.status, body: response.data }).toEqual({
            url, status: 401, body: { message: 'Unauthorized' },
          });
          expect(response.headers['set-cookie']).toBeUndefined();
        }
        expect(await state()).toEqual(before);
      });

      it('accepts a current Admin dashboard session', async () => {
        for (const [method, url, data, status] of routes) {
          const response = await api.request({ method, url, data, ...adminSession, validateStatus: () => true });
          expect({ url, status: response.status }).toEqual({ url, status });
        }
        expect((await state()).configuration).toEqual({ assignments: { dk: 'en' }, version: 2 });
      });

      it.each([
        ['text/plain', JSON.stringify({ locale: 'en', expected_version: 1 })],
        ['application/x-www-form-urlencoded', 'locale=en&expected_version=1'],
        ['multipart/form-data; boundary=x', '--x\r\nContent-Disposition: form-data; name="locale"\r\n\r\nen\r\n--x--'],
      ])('refuses a %s body that a foreign page could submit, even with a session', async (contentType, body) => {
        const before = await state();
        for (const url of ['/admin/country-languages/dk', '/admin/ui-translations/en/activation']) {
          const response = await api.post(url, body, {
            headers: { ...adminSession.headers, 'content-type': contentType }, validateStatus: () => true,
          });
          expect({ url, status: response.status }).toEqual({ url, status: 415 });
        }
        expect(await state()).toEqual(before);
      });

      it('grants no foreign origin a credentialed preflight', async () => {
        const preflight = (origin: string) => api.request({
          method: 'OPTIONS', url: '/admin/country-languages/dk', validateStatus: () => true,
          headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' },
        });
        expect((await preflight('https://attacker.example')).headers['access-control-allow-origin']).toBeUndefined();
        const dashboard = (process.env.ADMIN_CORS ?? '').split(',')[0];
        expect(dashboard).not.toBe('');
        expect((await preflight(dashboard)).headers['access-control-allow-origin']).toBe(dashboard);
      });

      it('keeps payload and session content out of error responses and logs', async () => {
        const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
        const spies = (['info', 'warn', 'error', 'debug', 'log'] as const)
          .filter((method) => typeof logger[method] === 'function')
          .map((method) => jest.spyOn(logger, method));
        const marker = 'x_leak_marker_7f3a';
        const sessionValue = adminSession.headers.cookie.split('=')[1];
        try {
          const responses = [
            await api.post('/admin/country-languages/dk', { locale: marker, expected_version: 1 },
              { ...adminSession, validateStatus: () => true }),
            await api.post('/admin/country-languages/dk', { locale: 'en', expected_version: 1 },
              { headers: { cookie: `connect.sid=${marker}` }, validateStatus: () => true }),
          ];
          expect(responses.map((response) => response.status)).toEqual([400, 401]);
          const output = [
            ...responses.map((response) => JSON.stringify(response.data)),
            ...spies.flatMap((spy) => spy.mock.calls.map((call) => inspect(call, { depth: 5 }))),
          ].join('\n');
          expect(output).not.toContain(marker);
          expect(output).not.toContain(sessionValue);
        } finally {
          spies.forEach((spy) => spy.mockRestore());
        }
      });
    });
  },
});
