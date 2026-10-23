import { validateAndTransformBody, type MiddlewareRoute } from '@medusajs/framework/http';
import { z } from '@medusajs/framework/zod';

export const CustomerPasswordRecoveryRequest = z.object({
  identifier: z.string().email(),
  metadata: z.object({ country_code: z.string().regex(/^[a-z]{2}$/).optional() }).optional(),
});
export type CustomerPasswordRecoveryRequest = z.infer<typeof CustomerPasswordRecoveryRequest>;

export const CustomerPasswordRecoveryUpdate = z.object({
  password: z.string().min(8),
  password_confirmation: z.string(),
}).refine((body) => body.password === body.password_confirmation, {
  message: 'Password confirmation does not match', path: ['password_confirmation'],
});
export type CustomerPasswordRecoveryUpdate = z.infer<typeof CustomerPasswordRecoveryUpdate>;

export const customerRecoveryMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/auth/customer/emailpass/reset-password',
    method: 'POST',
    middlewares: [validateAndTransformBody(CustomerPasswordRecoveryRequest)],
  },
  {
    matcher: '/auth/customer/emailpass/update',
    method: 'POST',
    // The static matcher runs before core's parameterized, token-consuming middleware.
    middlewares: [validateAndTransformBody(CustomerPasswordRecoveryUpdate)],
  },
];
