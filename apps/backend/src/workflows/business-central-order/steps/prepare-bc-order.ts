import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils";
import type { IOrderModuleService } from "@medusajs/framework/types";
import { BUSINESS_CENTRAL_MODULE } from "../../../modules/business-central";
import type {
  BCCreateSalesOrderLineInput,
  BCCreateSalesOrderParams,
  BCCustomer,
  BCItemLookupResult,
  BCSalesOrderAddressInput,
  IBusinessCentralModuleService,
} from "../../../modules/business-central/types";
import {
  BC_INTEGRATION_STATE_METADATA_KEY,
  hasBusinessCentralOrder,
  parseBcIntegrationState,
} from "../../../modules/order-ingestion/bc-integration-state";
import type {
  BcOrderLineFailure,
  BcSubmissionFailureReason,
} from "../../../modules/order-ingestion/bc-integration-state";
import {
  canonicalDateToBcDate,
  parseBcOrderPayload,
  readCompanyIdFromMetadata,
} from "../../../modules/order-ingestion/bc-order-payload";
import type {
  BcOrderPayload,
  BcOrderPayloadAddress,
} from "../../../modules/order-ingestion/bc-order-payload";
import { resolveBcCurrencyOverride } from "../utils/resolve-bc-currency-override";

export type PrepareBcOrderInput = {
  order_id: string;
};

export type PreparedBcOrderOutcome = "skip" | "abort" | "submit";

export type BcLineIdentifiers = {
  line_number: number;
  ean_no: string | null;
  item_number: string | null;
  cust_item_no: string | null;
};

export type PreparedBcOrder = {
  orderId: string;
  outcome: PreparedBcOrderOutcome;
  failureReason: BcSubmissionFailureReason | null;
  lineFailures: BcOrderLineFailure[];
  lineIdentifiers: BcLineIdentifiers[];
  params: BCCreateSalesOrderParams | null;
};

function toBcAddress(
  address: BcOrderPayloadAddress | undefined
): BCSalesOrderAddressInput | undefined {
  if (!address) {
    return undefined;
  }

  return {
    name: address.name,
    contact: address.contact,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    city: address.city,
    state: address.state,
    postCode: address.postCode,
    country: address.country,
  };
}

function toLineIdentifiers(payload: BcOrderPayload): BcLineIdentifiers[] {
  return payload.lines.map((line) => ({
    line_number: line.lineNumber,
    ean_no: line.eanNo || null,
    item_number: line.itemNumber || null,
    cust_item_no: line.custItemNo || null,
  }));
}

function toLineFailure(
  identifiers: BcLineIdentifiers[],
  result: Extract<BCItemLookupResult, { matched: false }>
): BcOrderLineFailure {
  const line = identifiers.find(
    (candidate) => candidate.line_number === result.lineNumber
  );

  return {
    line_number: result.lineNumber,
    ean_no: line?.ean_no ?? null,
    item_number: line?.item_number ?? null,
    cust_item_no: line?.cust_item_no ?? null,
    reason: result.reason,
    message: null,
  };
}

function aborted(
  orderId: string,
  failureReason: BcSubmissionFailureReason,
  lineFailures: BcOrderLineFailure[] = [],
  lineIdentifiers: BcLineIdentifiers[] = []
): PreparedBcOrder {
  return {
    orderId,
    outcome: "abort",
    failureReason,
    lineFailures,
    lineIdentifiers,
    params: null,
  };
}

export const prepareBcOrderStep = createStep(
  "prepare-bc-order",
  async (
    input: PrepareBcOrderInput,
    { container }
  ): Promise<StepResponse<PreparedBcOrder>> => {
    const orderModuleService = container.resolve<IOrderModuleService>(
      Modules.ORDER
    );
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
    const bcService = container.resolve<IBusinessCentralModuleService>(
      BUSINESS_CENTRAL_MODULE
    );

    const [order] = await orderModuleService.listOrders(
      { id: input.order_id },
      { select: ["id", "metadata"] }
    );

    if (!order) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Order '${input.order_id}' was not found`
      );
    }

    const metadata = (order.metadata ?? {}) as Record<string, unknown>;
    const integrationState = parseBcIntegrationState(
      metadata[BC_INTEGRATION_STATE_METADATA_KEY]
    );

    // Duplicate-submission guard: a Business Central sales order already exists for this Medusa
    // order, so do not create a second one. No attempt is made, so nothing is recorded.
    if (hasBusinessCentralOrder(integrationState)) {
      return new StepResponse({
        orderId: order.id,
        outcome: "skip",
        failureReason: null,
        lineFailures: [],
        lineIdentifiers: [],
        params: null,
      });
    }

    const payloadResult = parseBcOrderPayload(metadata);

    if (!payloadResult.ok) {
      return new StepResponse(
        aborted(order.id, "canonical_payload_unavailable")
      );
    }

    const payload = payloadResult.payload;
    const lineIdentifiers = toLineIdentifiers(payload);
    const companyId = readCompanyIdFromMetadata(metadata);

    if (!companyId) {
      return new StepResponse(
        aborted(order.id, "company_unresolved", [], lineIdentifiers)
      );
    }

    const { data: companies } = await query.graph({
      entity: "companies",
      fields: ["id", "business_central_customer_number"],
      filters: { id: companyId },
    });
    const company = companies[0];

    if (!company) {
      return new StepResponse(
        aborted(order.id, "company_unresolved", [], lineIdentifiers)
      );
    }

    const customerNumber = company.business_central_customer_number;

    if (typeof customerNumber !== "string" || customerNumber.length === 0) {
      return new StepResponse(
        aborted(order.id, "bc_customer_number_missing", [], lineIdentifiers)
      );
    }

    let bcCustomer: BCCustomer | null;

    try {
      bcCustomer = await bcService.getCustomer(customerNumber);
    } catch (error) {
      logger.error(
        `Business Central customer lookup failed for Medusa order ${order.id}: ${
          error instanceof Error ? error.message : "unknown error"
        }`
      );

      return new StepResponse(
        aborted(order.id, "bc_customer_lookup_failed", [], lineIdentifiers)
      );
    }

    if (!bcCustomer) {
      return new StepResponse(
        aborted(order.id, "bc_customer_not_found", [], lineIdentifiers)
      );
    }

    let lookupResults: BCItemLookupResult[];

    try {
      lookupResults = await bcService.findItemsForOrderLines(
        payload.lines.map((line) => ({
          lineNumber: line.lineNumber,
          eanNo: line.eanNo,
          itemNumber: line.itemNumber,
          custItemNo: line.custItemNo,
        }))
      );
    } catch (error) {
      logger.error(
        `Business Central item lookup failed for Medusa order ${order.id}: ${
          error instanceof Error ? error.message : "unknown error"
        }`
      );

      return new StepResponse(
        aborted(order.id, "bc_item_lookup_failed", [], lineIdentifiers)
      );
    }

    const lineFailures: BcOrderLineFailure[] = [];
    const resolvedLines: BCCreateSalesOrderLineInput[] = [];

    for (const result of lookupResults) {
      if (!result.matched) {
        lineFailures.push(toLineFailure(lineIdentifiers, result));
        continue;
      }

      const line = payload.lines.find(
        (candidate) => candidate.lineNumber === result.lineNumber
      );

      if (!line) {
        continue;
      }

      // No unitPrice, discount, tax or description: Business Central prices and describes the
      // line from its own master data (NIMBUS-129 PROGRESS.md, 2026-09-16).
      resolvedLines.push({
        lineNumber: line.lineNumber,
        itemId: result.item.id,
        quantity: line.quantity,
        unitOfMeasureCode: line.unitOfMeasureCode,
        shipmentDate: line.requestedShipmentDate
          ? canonicalDateToBcDate(line.requestedShipmentDate)
          : undefined,
      });
    }

    // SCOPE.md: if NO lines resolve, the submission fails rather than creating an empty BC order.
    if (resolvedLines.length === 0) {
      return new StepResponse(
        aborted(order.id, "no_lines_resolved", lineFailures, lineIdentifiers)
      );
    }

    return new StepResponse({
      orderId: order.id,
      outcome: "submit",
      failureReason: null,
      lineFailures,
      lineIdentifiers,
      params: {
        customerNumber,
        externalDocumentNumber: payload.externalOrderNumber,
        orderDate: canonicalDateToBcDate(payload.orderDate),
        requestedDeliveryDate: payload.requestedDeliveryDate
          ? canonicalDateToBcDate(payload.requestedDeliveryDate)
          : undefined,
        // Override only: omitted when it matches the BC customer's own currency.
        currencyCode: resolveBcCurrencyOverride(
          payload.currencyCode,
          bcCustomer.currencyCode
        ),
        email: payload.email,
        phoneNumber: payload.phoneNumber,
        billTo: toBcAddress(payload.billTo),
        shipTo: toBcAddress(payload.shipTo),
        lines: resolvedLines,
      },
    });
  }
);
