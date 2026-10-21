import { inspect } from 'node:util';
import jwt from 'jsonwebtoken';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { ApiKeyType, ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type {
  IApiKeyModuleService,
  ICartModuleService,
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
