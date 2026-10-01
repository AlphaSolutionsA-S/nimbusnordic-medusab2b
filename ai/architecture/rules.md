# Rules

Every rule ID, its severity and what enforces it. Baselines hold only findings that predate a rule;
anything new fails, and a baseline is never regenerated to clear a finding. A violation is a design
error: never suppress it or weaken the rule to pass a task.

| Rule IDs | Severity | Enforced by |
|---|---|---|
| `bound-*` (`boundaries.md`) | high, blocker | review; `medusa lint` for module relationships |
| `lock-*`, `NO_LOCKING_IN_ROUTES` (`boundaries.md`) | high, blocker | review |
| `NO_UNKNOWN_CAST`, `data-schema-vs-model`, `data-core-read-workflows`, `data-no-core-internals`, `data-service-*` (`medusa-boundary.md`) | high | review |
| `limit-route-body`, `limit-service-one-module` (`layers.md`) | medium | review |
| `arch-*`, `data-*`, `type-*`, `file-*`, `logic-*`, `sdk-*` (Medusa skills) | as the skill states | review; `medusa lint` for workflow composition |
| `type-no-any` | high | review; baseline: 16 storefront files, `workflows/order/steps/update-order.ts` |
| `no-plan-id-comments` (comments citing task, test-case or scope ids) | high | review |
| One home per business rule | high | `decisions.md`; review |
| `trust-no-client-company`: never authorize from client `metadata.company_id` | high, blocker | review; baseline: `workflows/hooks/{cart,order}-created.ts` |
| `ui-text-translated`: storefront UI text is a translation key | medium | `react/jsx-no-literals` (warn) |

Open security findings 7 (spending limit per order only), 8 (client company id) and 10 (claims live
preview bypasses login) are tracked in
`docs/security-remediation.md`; work touching carts, checkout or company access reads it first.
