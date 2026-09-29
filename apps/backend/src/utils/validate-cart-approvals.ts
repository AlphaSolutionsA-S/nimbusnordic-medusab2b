import { MedusaError } from '@medusajs/framework/utils';
import { ApprovalStatusType, ApprovalType } from '../types/approval';

interface ApprovalSettings {
  requires_admin_approval?: boolean | null;
  requires_sales_manager_approval?: boolean | null;
}

interface ApprovalCart {
  approvals?: ({ type: string; status: string } | null)[] | null;
  company?: { approval_settings?: ApprovalSettings | null } | null;
  customer?: {
    employee?: { company?: { approval_settings?: ApprovalSettings | null } | null } | null;
  } | null;
}

export function validateCartApprovals(cart: ApprovalCart): void {
  const approvals = (cart.approvals ?? []).filter((approval) => approval !== null);
  const settings = [
    cart.company?.approval_settings,
    cart.customer?.employee?.company?.approval_settings,
  ];
  const requiredTypes = [
    ...(settings.some((value) => value?.requires_admin_approval) ? [ApprovalType.ADMIN] : []),
    ...(settings.some((value) => value?.requires_sales_manager_approval)
      ? [ApprovalType.SALES_MANAGER] : []),
  ];

  if (approvals.some((approval) => approval.status !== ApprovalStatusType.APPROVED) ||
    requiredTypes.some((type) => !approvals.some((approval) =>
      approval.type === type && approval.status === ApprovalStatusType.APPROVED))) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, 'Cart requires approval before checkout');
  }
}
