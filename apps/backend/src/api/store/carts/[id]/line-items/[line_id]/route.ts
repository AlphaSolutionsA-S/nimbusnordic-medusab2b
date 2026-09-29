import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { refetchCart } from '@medusajs/medusa/api/store/carts/helpers';
import { deleteEditableCartLineItemWorkflow } from '../../../../../../workflows/approval/workflows/delete-editable-cart-line-item';

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  await deleteEditableCartLineItemWorkflow(req.scope).run({
    input: { cart_id: req.params.id, line_id: req.params.line_id },
  });
  const cart = await refetchCart(req.params.id, req.scope, req.queryConfig.fields);
  res.status(200).json({ id: req.params.line_id, object: 'line-item', deleted: true, parent: cart });
}
