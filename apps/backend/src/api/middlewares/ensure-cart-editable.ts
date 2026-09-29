import type { MedusaRequest, MedusaResponse, MedusaNextFunction } from '@medusajs/framework/http';
import { validateCartEditWorkflow } from '../../workflows/approval/workflows/validate-cart-edit';

export async function ensureCartEditable(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction,
): Promise<void> {
  await validateCartEditWorkflow(req.scope).run({ input: { cart_id: req.params.id } });
  next();
}
