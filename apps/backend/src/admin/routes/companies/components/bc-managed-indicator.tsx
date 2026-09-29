import { Badge } from "@medusajs/ui";
import { BC_MANAGED_INDICATOR_LABEL } from "../bc-managed-fields";

export function BcManagedIndicator() {
  return (
    <Badge size="2xsmall" color="orange">
      {BC_MANAGED_INDICATOR_LABEL}
    </Badge>
  );
}
