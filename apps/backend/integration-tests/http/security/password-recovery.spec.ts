import jwt from 'jsonwebtoken';
import { medusaIntegrationTestRunner, TestEventUtils } from '@medusajs/test-utils';
import { generateResetPasswordTokenWorkflow } from '@medusajs/core-flows';
import type { IAuthModuleService, IEventBusModuleService, INotificationModuleService, MedusaContainer } from '@medusajs/framework/types';
import { AuthWorkflowEvents, Modules } from '@medusajs/framework/utils';
import { createStoreUser } from '../../utils/admin';
import { generatePublishableKey, generateStoreHeaders } from '../../utils/store';
import { sendCustomerPasswordResetWorkflow } from '../../../src/workflows/customer/workflows/send-password-reset';

jest.setTimeout(120_000);
const secret = 'supersecret';
const email = 'recovery@example.test';
const password = 'replacement-password';

medusaIntegrationTestRunner({
  inApp: true,
  env: { JWT_SECRET: secret, STORE_CORS: 'https://shop.example.test' },
  testSuite: ({ api, getContainer }) => {
    let container: MedusaContainer;

    beforeEach(async () => {
      container = getContainer();
      const storeHeaders = generateStoreHeaders({ publishableKey: await generatePublishableKey(container) });
      await createStoreUser({ api, storeHeaders, email });
    });

    async function proof() {
      const { result } = await generateResetPasswordTokenWorkflow(container).run({
        input: { entityId: email, actorType: 'customer', provider: 'emailpass', secret },
      });
      return result;
    }

    async function update(token: string, body: Record<string, unknown> = { password, password_confirmation: password }) {
      return api.post('/auth/customer/emailpass/update', body, {
        headers: { authorization: `Bearer ${token}` }, validateStatus: () => true,
      });
    }

    it('acknowledges known and absent accounts equally without creating an identity', async () => {
      const known = await api.post('/auth/customer/emailpass/reset-password', { identifier: email });
      const absent = await api.post('/auth/customer/emailpass/reset-password', { identifier: 'absent@example.test' });
      expect({ status: known.status, body: known.data }).toEqual({ status: absent.status, body: absent.data });
      expect(known.status).toBe(201);
      const auth = container.resolve<IAuthModuleService>(Modules.AUTH);
      expect(await auth.listProviderIdentities({ entity_id: 'absent@example.test' })).toHaveLength(0);
    });

    it('acknowledges provider failures without revealing account or provider details', async () => {
      const auth = container.resolve<IAuthModuleService>(Modules.AUTH);
      const failed = jest.spyOn(auth, 'createPasswordResetToken').mockRejectedValueOnce(new Error('Internal provider detail'));
      try {
        const response = await api.post('/auth/customer/emailpass/reset-password', { identifier: email });
        expect(response.status).toBe(201);
        expect(response.data).toBe('Created');
        expect(JSON.stringify(response.data)).not.toContain('Internal provider detail');
      } finally {
        failed.mockRestore();
      }
    });

    it.each([
      { password: 'short', password_confirmation: 'short' },
      { password, password_confirmation: 'does-not-match' },
      { password },
    ])('rejects invalid new credentials before consumption and permits valid retry', async (body) => {
      const token = await proof();
      const invalid = await update(token, body);
      expect(invalid.status).toBe(400);
      expect(JSON.stringify(invalid.data)).not.toContain(body.password);
      expect((await api.post('/auth/customer/emailpass', { email, password: 'password' })).status).toBe(200);
      const valid = await update(token);
      expect(valid.status).toBe(200);
      expect(valid.data).toEqual({ success: true });
      expect(valid.headers['set-cookie']).toBeUndefined();
      expect((await api.post('/auth/customer/emailpass', { email, password })).status).toBe(200);
      expect((await api.post('/auth/customer/emailpass', { email, password: 'password' }, { validateStatus: () => true })).status).toBe(401);
    });

    it('rejects sequential reuse and superseded links', async () => {
      const previous = await proof();
      const latest = await proof();
      expect((await update(previous)).status).toBe(401);
      expect((await update(latest)).status).toBe(200);
      expect((await update(latest)).status).toBe(401);
    });

    it.each(['expired', 'actor', 'account', 'provider', 'tampered'] as const)('rejects %s proof without consuming the original', async (kind) => {
      const token = await proof();
      const claims = jwt.decode(token);
      if (!claims || typeof claims === 'string') throw new Error('Expected JWT claims');
      expect(Number(claims.exp) - Number(claims.iat)).toBe(900);
      const changed = { ...claims };
      if (kind === 'expired') changed.exp = Math.floor(Date.now() / 1000) - 1;
      if (kind === 'actor') changed.actor_type = 'user';
      if (kind === 'account') changed.entity_id = 'other@example.test';
      const invalid = kind === 'tampered' ? jwt.sign(changed, 'wrong-secret') : jwt.sign(changed, secret);
      const url = kind === 'provider' ? '/auth/customer/unknown-provider/update' : '/auth/customer/emailpass/update';
      const response = await api.post(url, { password, password_confirmation: password }, {
        headers: { authorization: `Bearer ${invalid}` }, validateStatus: () => true,
      });
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
      expect((await update(token)).status).toBe(200);
    });

    it('refuses identity substitution without changing either account or consuming the proof', async () => {
      const other = 'other@example.test';
      await api.post('/auth/customer/emailpass/register', { email: other, password: 'original-other-password' });
      const token = await proof();
      expect((await update(token, { password, password_confirmation: password, entity_id: other, email: other })).status).toBe(400);
      expect((await api.post('/auth/customer/emailpass', { email: other, password: 'original-other-password' })).status).toBe(200);
      expect((await api.post('/auth/customer/emailpass', { email, password: 'password' })).status).toBe(200);
      expect((await update(token)).status).toBe(200);
      expect((await api.post('/auth/customer/emailpass', { email, password })).status).toBe(200);
    });

    it('dispatches a usable reset link through the registered subscriber after a public request', async () => {
      const eventBus = container.resolve<IEventBusModuleService>(Modules.EVENT_BUS);
      const notifications = container.resolve<INotificationModuleService>(Modules.NOTIFICATION);
      await Promise.all([
        TestEventUtils.waitSubscribersExecution(AuthWorkflowEvents.PASSWORD_RESET, eventBus),
        api.post('/auth/customer/emailpass/reset-password', {
          identifier: email, metadata: { country_code: 'se' },
        }),
      ]);
      const stored = await notifications.listNotifications({ to: email, template: 'customer-password-reset' });
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({ channel: 'email', status: 'success' });
      const resetUrl = new URL(String(stored[0].data?.reset_url));
      expect(resetUrl.origin).toBe('https://shop.example.test');
      expect(resetUrl.pathname).toBe('/se/reset-password');
      const token = resetUrl.searchParams.get('token');
      expect(token).toEqual(expect.any(String));
      if (!token) throw new Error('Expected a reset proof in the notification');
      expect((await update(token)).status).toBe(200);
      expect((await api.post('/auth/customer/emailpass', { email, password })).status).toBe(200);
    });

    it('dispatches English email through the existing Notification module and skips non-customers', async () => {
      const token = await proof();
      const input = { entity_id: email, actor_type: 'customer', token, metadata: { country_code: 'dk' } };
      const { result } = await sendCustomerPasswordResetWorkflow(container).run({ input });
      expect(result).toEqual([expect.objectContaining({ channel: 'email', to: email })]);
      const notifications = container.resolve<INotificationModuleService>(Modules.NOTIFICATION);
      const stored = await notifications.retrieveNotification(result[0].id);
      const resetUrl = new URL(String(stored.data?.reset_url));
      expect(resetUrl.origin).toBe('https://shop.example.test');
      expect(resetUrl.pathname).toBe('/dk/reset-password');
      expect(resetUrl.searchParams.get('token')).toBe(token);
      const skipped = await sendCustomerPasswordResetWorkflow(container).run({ input: { ...input, actor_type: 'user' } });
      expect(skipped.result).toEqual([]);
    });
  },
});
