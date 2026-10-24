import { inspect } from 'node:util';
import jwt from 'jsonwebtoken';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import {
  createCartWorkflow,
  generateResetPasswordTokenWorkflow,
  createOrderFulfillmentWorkflow,
  createProductsWorkflow,
  createShippingOptionsWorkflow,
  createStockLocationsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from '@medusajs/core-flows';
import { ApiKeyType, ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type {
  IApiKeyModuleService,
  ICartModuleService,
  ICustomerModuleService,
  IFulfillmentModuleService,
  IOrderModuleService,
  IPaymentModuleService,
  IRegionModuleService,
  ISalesChannelModuleService,
  IUserModuleService,
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
  setOrderApiEnabled,
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

    it('refuses missing and ordinary login credentials on password recovery updates', async () => {
      for (const credentials of [{ headers: {} }, headers]) {
        const response = await api.post('/auth/customer/emailpass/update', {
          password: 'replacement-password', password_confirmation: 'replacement-password',
        }, { ...credentials, validateStatus: () => true });
        expect(response.status).toBe(401);
      }
      const readOnly = await api.get('/auth/customer/emailpass/update', { validateStatus: () => true });
      expect(readOnly.status).toBe(404);
    });

    it('preserves company membership and administrator role after password recovery', async () => {
      const before = await companyService.listEmployees({ company_id: companyId });
      expect(before).toHaveLength(1);
      expect(before[0].is_admin).toBe(true);
      const { result: proof } = await generateResetPasswordTokenWorkflow(container).run({
        input: { entityId: 'test@email.com', actorType: 'customer', provider: 'emailpass', secret: 'supersecret' },
      });
      const reset = await api.post('/auth/customer/emailpass/update', {
        password: 'recovered-password', password_confirmation: 'recovered-password',
      }, { headers: { authorization: `Bearer ${proof}` } });
      expect(reset.data).toEqual({ success: true });
      expect(reset.headers['set-cookie']).toBeUndefined();
      const { token } = (await api.post('/auth/customer/emailpass', {
        email: 'test@email.com', password: 'recovered-password',
      })).data;
      const recoveredHeaders = { headers: { ...publicHeaders.headers, authorization: `Bearer ${token}` } };
      const me = await api.get('/store/customers/me', recoveredHeaders);
      expect(me.data.customer.id).toBe(customerId);
      const after = await companyService.listEmployees({ company_id: companyId });
      expect(after).toEqual(before);
      expect((await api.post(`/store/companies/${companyId}/approval-settings`, {
        requires_admin_approval: true,
      }, recoveredHeaders)).status).toBe(201);
      expect((await api.get(`/store/companies/${foreignCompanyId}`, {
        ...recoveredHeaders, validateStatus: () => true,
      })).status).toBe(403);
    });

    it('keeps signed-in password changes dependent on the current password', async () => {
      const route = '/store/customers/me/password';
      const nextPassword = 'signed-in-replacement';
      expect((await api.post(route, {
        old_password: 'password', new_password: nextPassword,
      }, { ...publicHeaders, validateStatus: () => true })).status).toBe(401);
      expect((await api.post(route, {
        old_password: 'incorrect-password', new_password: nextPassword,
      }, { ...headers, validateStatus: () => true })).status).toBe(401);
      expect((await api.post('/auth/customer/emailpass', {
        email: 'test@email.com', password: 'password',
      })).status).toBe(200);
      expect((await api.post(route, {
        old_password: 'password', new_password: nextPassword,
      }, headers)).data).toEqual({ success: true });
      expect((await api.post('/auth/customer/emailpass', {
        email: 'test@email.com', password: 'password',
      }, { validateStatus: () => true })).status).toBe(401);
      expect((await api.post('/auth/customer/emailpass', {
        email: 'test@email.com', password: nextPassword,
      })).status).toBe(200);
    });

    it.each(['none', 'customer', 'publishable'] as const)(
      'denies %s credentials on every admin shipment tracking endpoint', async (credentials) => {
        const selected = credentials === 'customer' ? headers : credentials === 'publishable' ? publicHeaders : { headers: {} };
        for (const [method, url] of [
          ['GET', '/admin/shipment-tracking'],
          ['GET', '/admin/shipment-tracking/overview'],
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

    describe('store quote response privacy', () => {
      const forbidden = [
        'customer.employee.company.credit_limit', 'customer.employee.company.blocked',
        'customer.employee.company.business_central_synced_at', 'customer.employee.company.order_api_enabled',
        'customer.employee.company.employees.spending_limit', 'messages.admin.email', 'messages.customer.email',
        '*customer', 'customer.employee.*', '*customer.employee.company',
        'customer.employee.company.*', '*messages.admin', 'messages.customer.*',
      ];
      const safe = [
        'id', 'draft_order_id', 'customer.employee.company.name',
        'messages.admin.first_name', 'messages.admin.last_name',
        'messages.customer.first_name', 'messages.customer.last_name',
      ];
      const selections = [
        ['default', ''],
        ['additive malicious', `?fields=${encodeURIComponent(forbidden.map((field) => `+${field}`).join(','))}`],
        ['explicit malicious', `?fields=${encodeURIComponent([...safe, ...forbidden].join(','))}`],
      ] as const;
      let regionId: string;
      let staffId: string;

      beforeEach(async () => {
        const region = await container.resolve<IRegionModuleService>(Modules.REGION).createRegions({
          name: 'Quote privacy region', currency_code: 'dkk', countries: ['dk'],
        });
        regionId = region.id;
        const staff = await container.resolve<IUserModuleService>(Modules.USER).createUsers({
          email: 'quote-staff@example.test', first_name: 'Quote', last_name: 'Staff', metadata: { private: 'staff-only' },
        });
        staffId = staff.id;
        await container.resolve<ICustomerModuleService>(Modules.CUSTOMER).updateCustomers(customerId, {
          first_name: 'Quote', last_name: 'Customer', phone: '12345678',
        });
        await companyService.updateCompanies({
          id: companyId, credit_limit: 98765, blocked: 'All', spending_limit_reset_frequency: 'yearly',
          business_central_synced_at: new Date(), order_api_enabled: true,
        });
        await companyService.createEmployees({ company_id: companyId, spending_limit: 87654, is_admin: false });
      });

      async function createOwnedQuote(selection = '') {
        const { result: cart } = await createCartWorkflow(container).run({
          input: { customer_id: customerId, currency_code: 'dkk', region_id: regionId },
        });
        await container.resolve<ICartModuleService>(Modules.CART).addLineItems([{
          cart_id: cart.id, title: 'Quote privacy item', quantity: 1, unit_price: 100,
        }]);
        const created = await api.post(`/store/quotes${selection}`, { cart_id: cart.id }, headers);
        expect(created.status).toBe(200);
        return created.data.quote;
      }

      function expectPrivateQuote(quote: {
        customer: { employee: { company: unknown } };
        messages: { admin?: unknown; customer?: unknown }[];
      }, populated = true) {
        expect(quote.customer.employee.company).toEqual({ name: 'Own company' });
        if (populated) {
          expect(quote.messages).toEqual(expect.arrayContaining([
            expect.objectContaining({ admin: { first_name: 'Quote', last_name: 'Staff' } }),
            expect.objectContaining({ customer: { first_name: 'Quote', last_name: 'Customer' } }),
          ]));
        }
        for (const message of quote.messages) {
          if (message.admin) expect(message.admin).toEqual({ first_name: 'Quote', last_name: 'Staff' });
          if (message.customer) expect(message.customer).toEqual({ first_name: 'Quote', last_name: 'Customer' });
        }
      }

      it.each([false, true])('bounds every response route for is_admin=%s with default and malicious fields', async (isAdmin) => {
        const [employee] = await companyService.listEmployees({ company_id: companyId, is_admin: true });
        await companyService.updateEmployees({ id: employee.id, is_admin: isAdmin, spending_limit: 1000 });
        const quotes = container.resolve<QuoteModuleService>('quote');
        for (const [_label, selection] of selections) {
          const quote = await createOwnedQuote(selection);
          expectPrivateQuote(quote, false);
          expect(quote.messages).toEqual([]);
          await quotes.createMessages([
            { quote_id: quote.id, admin_id: staffId, text: 'Staff response' },
            { quote_id: quote.id, customer_id: customerId, text: 'Customer request' },
          ]);
          const list = await api.get(`/store/quotes${selection}`, headers);
          expect(list.status).toBe(200);
          expectPrivateQuote(list.data.quotes.find((entry: { id: string }) => entry.id === quote.id));
          for (const suffix of ['', '/preview']) {
            const response = await api.get(`/store/quotes/${quote.id}${suffix}${selection}`, headers);
            expect(response.status).toBe(200);
            expectPrivateQuote(response.data.quote);
          }
          const message = await api.post(`/store/quotes/${quote.id}/messages${selection}`, { text: 'New message' }, headers);
          expect(message.status).toBe(200);
          expectPrivateQuote(message.data.quote);
          await quotes.updateQuotes({ id: quote.id, status: 'pending_customer' });
          const rejected = await api.post(`/store/quotes/${quote.id}/reject${selection}`, {}, headers);
          expect(rejected.status).toBe(200);
          expectPrivateQuote(rejected.data.quote);

          const acceptedQuote = await createOwnedQuote();
          await quotes.createMessages([
            { quote_id: acceptedQuote.id, admin_id: staffId, text: 'Staff response' },
            { quote_id: acceptedQuote.id, customer_id: customerId, text: 'Customer request' },
          ]);
          await quotes.updateQuotes({ id: acceptedQuote.id, status: 'pending_customer' });
          const accepted = await api.post(`/store/quotes/${acceptedQuote.id}/accept${selection}`, {}, headers);
          expect(accepted.status).toBe(200);
          expectPrivateQuote(accepted.data.quote);
        }
      });

      it('keeps another customer quote absent on list, retrieve, preview and mutations with expanded fields', async () => {
        const quote = await createOwnedQuote();
        const quotes = container.resolve<QuoteModuleService>('quote');
        await quotes.updateQuotes({ id: quote.id, status: 'pending_customer' });
        const foreign = await createStoreUser({ api, storeHeaders: publicHeaders, email: 'quote-outsider@example.test' });
        const foreignHeaders = { headers: { ...publicHeaders.headers, authorization: `Bearer ${foreign.token}` } };
        const selection = selections[1][1];
        const list = await api.get(`/store/quotes${selection}`, foreignHeaders);
        expect(list.status).toBe(200);
        expect(list.data.quotes).toEqual([]);
        for (const operation of ['', '/preview', '/accept', '/reject', '/messages']) {
          const response = await api.request({
            method: ['', '/preview'].includes(operation) ? 'GET' : 'POST',
            url: `/store/quotes/${quote.id}${operation}${selection}`, ...foreignHeaders,
            data: operation === '/messages' ? { text: 'Unauthorized' }
              : ['', '/preview'].includes(operation) ? undefined : {},
            validateStatus: () => true,
          });
          expect(response.status).toBe(404);
          const body = JSON.stringify(response.data);
          for (const privateValue of ['Own company', 'test@email.com', '12345678', '98765', 'Staff response']) {
            expect(body).not.toContain(privateValue);
          }
        }
        expect((await quotes.retrieveQuote(quote.id)).status).toBe('pending_customer');
        expect(await quotes.listMessages({ quote_id: quote.id })).toEqual([]);
      });
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

    // NIMBUS-217: a company switched off for the order API places no order.
    it('refuses an order for a company switched off for the order API', async () => {
      const offCompanyId = await createApiCustomerCompany(container, 'security-off-orders');
      await setOrderApiEnabled(container, offCompanyId, false);
      const response = await api.post('/orderapi/orders?customerNumber=security-off-orders',
        { ...singleLineCanonicalOrder, externalOrderNumber: 'SECURITY-OFF-1' },
        { headers: await orderApiSecretHeaders(container), validateStatus: () => true });
      expect(response.status).toBe(403);
      expect(response.data)
        .toEqual({ type: 'forbidden', message: 'Customer not registered for the order API' });
      const { data } = await container.resolve('query').graph({
        entity: 'company', fields: ['id', 'orders.id'], filters: { id: offCompanyId },
      });
      expect(data[0].orders ?? []).toHaveLength(0);
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

      // NIMBUS-217: stored notices are not served while the company is switched off.
      it('refuses a company switched off for the order API without returning its notices', async () => {
        const companyA = await createApiCustomerCompany(container, 'security-notices-a');
        await seed(companyA, 'security-ship-a');
        await setOrderApiEnabled(container, companyA, false);
        const response = await api.get(path,
          { headers: await orderApiSecretHeaders(container), validateStatus: () => true });
        expect(response.status).toBe(403);
        expect(response.data)
          .toEqual({ type: 'forbidden', message: 'Customer not registered for the order API' });
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

      async function addColleague(email: string, isAdmin = false): Promise<Member> {
        const response = await api.post(`/store/companies/${companyId}/employees`, {
          email, password: 'password', first_name: 'Col', last_name: 'League', spending_limit: 0,
          is_admin: isAdmin,
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

      // NIMBUS-177: an order is read, or returned, by its owner, or by an administrator of the
      // source cart's company once that cart's admin approval is approved and while the owner is
      // still a member. The order–company link grants nothing.
      describe('order access guard', () => {
        type As = { headers: Record<string, string> };
        type OrderRoute = readonly ['read' | 'return', string, (orderId: string) => string, ((orderId: string) => object)?];

        const ORDER_NOT_FOUND = { type: 'not_found', message: 'Order not found' };
        const TRANSFER_REFUSED = { type: 'invalid_data', message: 'Order cannot be transferred' };
        const ORDER_ROUTES: OrderRoute[] = [
          ['read', 'GET', (id) => `/store/orders/${id}`],
          ['return', 'POST', () => '/store/returns', (id) => ({
            order_id: id, items: [{ id: 'ordli_missing', quantity: 1 }],
            return_shipping: { option_id: 'so_missing' },
          })],
        ];
        const ADDRESS = {
          first_name: 'Col', last_name: 'League', address_1: 'Testvej 1', city: 'Aarhus',
          postal_code: '8000', country_code: 'dk',
        };
        const orders = () => container.resolve<IOrderModuleService>(Modules.ORDER);
        const returnCount = async (orderId: string) => (await container.resolve(ContainerRegistrationKeys.QUERY)
          .graph({ entity: 'return', fields: ['id'], filters: { order_id: orderId } })).data.length;
        const changeCount = async (orderId: string) =>
          (await orders().listOrderChanges({ order_id: orderId })).length;

        let ownerCart: Target;
        let orderId: string;

        const sendOrder = (route: OrderRoute, id: string, as: As) => api.request({
          method: route[1], url: route[2](id), data: route[3]?.(id), ...as, validateStatus: () => true,
        });
        const transfer = (action: 'request' | 'cancel', id: string, as: As) =>
          api.post(`/store/orders/${id}/transfer/${action}`, {}, { ...as, validateStatus: () => true });

        async function seedOrder(ownerId: string | null, sourceCart?: Target): Promise<string> {
          const order = await orders().createOrders({
            currency_code: 'dkk', customer_id: ownerId ?? undefined, email: 'order@example.test',
            region_id: regionId, items: [{ title: 'Custom test item', quantity: 1, unit_price: 100 }],
          });
          if (sourceCart) {
            await container.resolve(ContainerRegistrationKeys.LINK).create({
              [Modules.ORDER]: { order_id: order.id }, [Modules.CART]: { cart_id: sourceCart.cartId },
            });
          }
          return order.id;
        }

        async function expectOrderRefused(id: string, as: As) {
          for (const route of ORDER_ROUTES) {
            const missing = await sendOrder(route, 'order_missing', as);
            expect({ route: route[0], body: missing.data }).toEqual({ route: route[0], body: ORDER_NOT_FOUND });
            const refused = await sendOrder(route, id, as);
            expect({
              route: route[0], status: refused.status, body: refused.data,
              cache: refused.headers['cache-control'],
            }).toEqual({ route: route[0], status: 404, body: missing.data, cache: 'private, no-store' });
          }
          expect(await returnCount(id)).toBe(0);
        }

        // The product seeder creates draft products, so the checkout fixture is built here: a
        // published product in the guard channel, a shipping option served from a stock location in
        // that channel, and the system payment provider enabled in the region.
        async function seedCheckout() {
          const link = container.resolve(ContainerRegistrationKeys.LINK);
          await link.create({
            [Modules.REGION]: { region_id: regionId }, [Modules.PAYMENT]: { payment_provider_id: 'pp_system_default' },
          });
          const { result: [location] } = await createStockLocationsWorkflow(container).run({
            input: { locations: [{ name: 'Guard warehouse', address: { address_1: 'Lagervej 1', city: 'Aarhus', country_code: 'dk' } }] },
          });
          await linkSalesChannelsToStockLocationWorkflow(container).run({ input: { id: location.id, add: [channelId] } });
          const fulfillment = container.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT);
          const set = await fulfillment.createFulfillmentSets({
            name: 'Guard shipping', type: 'shipping',
            service_zones: [{ name: 'Denmark', geo_zones: [{ type: 'country', country_code: 'dk' }] }],
          });
          await link.create([
            { [Modules.STOCK_LOCATION]: { stock_location_id: location.id }, [Modules.FULFILLMENT]: { fulfillment_provider_id: 'manual_manual' } },
            { [Modules.STOCK_LOCATION]: { stock_location_id: location.id }, [Modules.FULFILLMENT]: { fulfillment_set_id: set.id } },
          ]);
          const profile = await fulfillment.createShippingProfiles({ name: 'Guard profile', type: 'default' });
          const { result: [option] } = await createShippingOptionsWorkflow(container).run({
            input: [{
              name: 'Guard delivery', service_zone_id: set.service_zones[0].id, shipping_profile_id: profile.id,
              provider_id: 'manual_manual', price_type: 'flat',
              type: { label: 'Standard', description: 'Standard', code: 'standard' },
              prices: [{ currency_code: 'dkk', amount: 10 }],
            }],
          });
          const { result: [product] } = await createProductsWorkflow(container).run({
            input: {
              products: [{
                title: 'Guard product', status: 'published', shipping_profile_id: profile.id,
                options: [{ title: 'Size', values: ['One'] }],
                variants: [{
                  title: 'One', sku: 'guard-one', manage_inventory: false, options: { Size: 'One' },
                  prices: [{ currency_code: 'dkk', amount: 100 }],
                }],
                sales_channels: [{ id: channelId }],
              }],
            },
          });
          return { optionId: option.id, variantId: product.variants[0].id };
        }

        beforeEach(async () => {
          ownerCart = await seedCart(colleague.customerId, companyId);
          orderId = await seedOrder(colleague.customerId, ownerCart);
        });

        it('answers a signed-out caller with 401 on order read, returns and transfer routes', async () => {
          for (const route of ORDER_ROUTES) {
            const response = await sendOrder(route, orderId, publicHeaders);
            expect({ route: route[0], status: response.status }).toEqual({ route: route[0], status: 401 });
          }
          for (const action of ['request', 'cancel'] as const) {
            const response = await transfer(action, orderId, publicHeaders);
            expect({ action, status: response.status }).toEqual({ action, status: 401 });
          }
          expect(await returnCount(orderId)).toBe(0);
          expect(await changeCount(orderId)).toBe(0);
        });

        it.each([
          ['a same-company colleague', async () => (await addColleague('bystander@example.test')).headers],
          ['an administrator of another company', async () => foreignAdmin],
          ['a customer of no company', async () => {
            const outsider = await createStoreUser({ api, storeHeaders: publicHeaders, email: 'outsider@example.test' });
            return { headers: { ...publicHeaders.headers, authorization: `Bearer ${outsider.token}` } };
          }],
          ['an administrator when the source cart has no admin approval', async () => headers],
          ['an administrator with a pending admin approval', async () => {
            await attachAdminApproval(ownerCart.cartId, ApprovalStatusType.PENDING, colleague.customerId);
            return headers;
          }],
          ['an administrator with a rejected admin approval', async () => {
            await attachAdminApproval(ownerCart.cartId, ApprovalStatusType.REJECTED, colleague.customerId);
            return headers;
          }],
          ['an administrator after the owner left the company', async () => {
            await attachAdminApproval(ownerCart.cartId, ApprovalStatusType.APPROVED, colleague.customerId);
            expect((await api.delete(`/store/companies/${companyId}/employees/${colleague.employeeId}`, headers)).status)
              .toBe(200);
            return headers;
          }],
        ])('refuses %s on order read and returns like a missing order', async (_label, as) => {
          await expectOrderRefused(orderId, await as());
        });

        it('lets the owner read the order, privately', async () => {
          const read = await api.get(`/store/orders/${orderId}?fields=%2Bcustomer_id`, colleague.headers);
          expect({
            status: read.status, id: read.data.order.id, customer_id: read.data.order.customer_id,
            cache: read.headers['cache-control'],
          }).toEqual({ status: 200, id: orderId, customer_id: colleague.customerId, cache: 'private, no-store' });
        });

        it("grants nothing through an order–company link to the caller's company", async () => {
          const foreignOwner = (await api.get('/store/customers/me', foreignAdmin)).data.customer.id;
          const forged = await seedOrder(foreignOwner);
          await container.resolve(ContainerRegistrationKeys.LINK).create({
            [Modules.ORDER]: { order_id: forged }, company: { company_id: companyId },
          });
          await expectOrderRefused(forged, headers);
          await expectOrderRefused(forged, colleague.headers);
        });

        it("refuses a transfer of another account's order and of the caller's own with one body", async () => {
          const own = await seedOrder(customerId);
          for (const id of [orderId, own]) {
            const response = await transfer('request', id, headers);
            expect({ status: response.status, body: response.data }).toEqual({ status: 400, body: TRANSFER_REFUSED });
            expect(await changeCount(id)).toBe(0);
          }
        });

        it.each(['no customer', 'a guest customer'])(
          'lets a signed-in customer request and cancel a transfer of an order with %s, returning no order',
          async (kind) => {
            const guestId = kind === 'no customer' ? null : (await container
              .resolve<ICustomerModuleService>(Modules.CUSTOMER)
              .createCustomers({ email: 'guest@example.test', has_account: false })).id;
            const id = await seedOrder(guestId);
            const requested = await transfer('request', id, headers);
            expect({ status: requested.status, body: requested.data }).toEqual({ status: 200, body: { success: true } });
            expect(await changeCount(id)).toBe(1);
            const cancelled = await transfer('cancel', id, headers);
            expect({ status: cancelled.status, body: cancelled.data }).toEqual({ status: 200, body: { success: true } });
          },
        );

        it('answers a transfer request for an unknown order with 404', async () => {
          const response = await transfer('request', 'order_missing', headers);
          expect(response.status).toBe(404);
        });

        it.each(['another account', 'a guest customer', 'no customer'])(
          'answers a transfer request for a draft order of %s like an unknown order',
          async (kind) => {
            const ownerId = kind === 'another account' ? colleague.customerId
              : kind === 'no customer' ? null
                : (await container.resolve<ICustomerModuleService>(Modules.CUSTOMER)
                  .createCustomers({ email: 'draft-guest@example.test', has_account: false })).id;
            // CreateOrderDTO does not declare is_draft_order; UpdateOrderDTO does.
            const draft = await seedOrder(ownerId);
            await orders().updateOrders(draft, { is_draft_order: true });
            const missing = await transfer('request', 'order_missing', headers);
            const response = await transfer('request', draft, headers);
            expect({ status: response.status, body: response.data })
              .toEqual({ status: 404, body: missing.data });
            expect(response.data).toEqual(ORDER_NOT_FOUND);
            expect(await changeCount(draft)).toBe(0);
          },
        );

        it("lets the company's administrators read, and return, a colleague's order one of them paid", async () => {
          const { optionId, variantId } = await seedCheckout();
          const approvals = container.resolve<ApprovalModuleService>('approval');
          const company = await api.get(`/store/companies/${companyId}`, headers);
          await approvals.updateApprovalSettings({
            id: company.data.company.approval_settings.id, requires_admin_approval: true,
            requires_sales_manager_approval: false,
          });

          const cartId = (await api.post('/store/carts', { region_id: regionId, sales_channel_id: channelId },
            colleague.headers)).data.cart.id;
          await api.post(`/store/carts/${cartId}/line-items`, { variant_id: variantId, quantity: 2 }, colleague.headers);
          await api.post(`/store/carts/${cartId}`, { shipping_address: ADDRESS, billing_address: ADDRESS }, colleague.headers);
          await api.post(`/store/carts/${cartId}/shipping-methods`, { option_id: optionId }, colleague.headers);
          await api.post(`/store/carts/${cartId}/approvals`, {}, colleague.headers);
          const [approval] = await approvals.listApprovals({ cart_id: cartId });
          await api.post(`/store/approvals/${approval.id}`, { status: 'approved' }, headers);

          const collection = (await api.post('/store/payment-collections', { cart_id: cartId }, headers))
            .data.payment_collection;
          await api.post(`/store/payment-collections/${collection.id}/payment-sessions`,
            { provider_id: 'pp_system_default' }, headers);
          const completed = await api.post(`/store/carts/${cartId}/complete`, {}, headers);
          expect(completed.data.type).toBe('order');
          const order = completed.data.order;

          const adminB = await addColleague('admin-b@example.test', true);
          for (const as of [headers, adminB.headers]) {
            const read = await api.get(`/store/orders/${order.id}?fields=%2Bcustomer_id`, as);
            expect(read.status).toBe(200);
            expect(read.data.order.id).toBe(order.id);
            expect(read.data.order.customer_id).toBe(colleague.customerId);
            expect(Array.isArray(read.data.order.items)).toBe(true);
            expect(typeof read.data.order.items[0].id).toBe('string');
            expect(typeof read.data.order.items[0].quantity).toBe('number');
          }
          const bystander = await addColleague('bystander@example.test');
          const refused = await api.get(`/store/orders/${order.id}`, { ...bystander.headers, validateStatus: () => true });
          expect({ status: refused.status, body: refused.data }).toEqual({ status: 404, body: ORDER_NOT_FOUND });

          const itemId = order.items[0].id;
          await createOrderFulfillmentWorkflow(container).run({
            input: { order_id: order.id, items: [{ id: itemId, quantity: 2 }] },
          });
          const returnBody = { order_id: order.id, items: [{ id: itemId, quantity: 1 }], return_shipping: { option_id: optionId } };
          const byAdmin = await api.post('/store/returns', returnBody, { ...headers, validateStatus: () => true });
          expect({ status: byAdmin.status, order: byAdmin.data.return?.order_id }).toEqual({ status: 200, order: order.id });
          expect(await returnCount(order.id)).toBe(1);
          const byBystander = await api.post('/store/returns', returnBody, { ...bystander.headers, validateStatus: () => true });
          expect({ status: byBystander.status, body: byBystander.data }).toEqual({ status: 404, body: ORDER_NOT_FOUND });
          expect(await returnCount(order.id)).toBe(1);
          const byOwner = await api.post('/store/returns', returnBody, { ...colleague.headers, validateStatus: () => true });
          expect(byOwner.status).toBe(200);
          expect(await returnCount(order.id)).toBe(2);
        });
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
