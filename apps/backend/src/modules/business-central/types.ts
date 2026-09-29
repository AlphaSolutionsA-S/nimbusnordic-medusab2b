export type BCOrderInvoiceStatus = "open" | "partially_invoiced" | "fully_invoiced";

export type BCOrder = {
  id: string;
  number: string;
  orderDate: string;
  customerNumber: string;
  customerName: string;
  billToAddress: string[];
  shipToAddress: string[];
  status: string;
  invoiceStatus: BCOrderInvoiceStatus;
  currencyCode: string;
  totalAmountExcludingTax: number;
  totalAmountIncludingTax: number;
};

export type BCOrderLine = {
  id: string;
  sequence: number;
  lineType: string;
  itemId?: string;
  itemNumber?: string;
  itemDisplayName?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineAmount: number;
  shippedQuantity: number;
  returnableQuantity: number;
  reservations: BCOrderLineReservation[];
};

export type BCOrderLineReservation = {
  id: string;
  quantity: number;
  reservedFrom: string;
  locationCode: string;
  freightType: string;
  expectedReceiptDate: string | null;
  shipmentDate: string | null;
};

export type BCOrderInvoiceSummary = {
  id: string;
  number: string;
  invoiceDate: string;
  status: string;
  totalAmountExcludingTax: number;
  totalAmountIncludingTax: number;
};

export type BCOrderDetail = BCOrder & {
  lines: BCOrderLine[];
  invoices: BCOrderInvoiceSummary[];
};

export type BCListOrdersParams = {
  customerNumber: string;
  limit: number;
  offset: number;
  status?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
};

export type BCGetOrderParams = {
  customerNumber: string;
  orderNumber: string;
};

export type BCCustomerBlockedState =
  | "not_blocked"
  | "Ship"
  | "Invoice"
  | "All";

export type BCCustomer = {
  number: string;
  displayName: string;
  email: string;
  phoneNumber: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  blocked: BCCustomerBlockedState;
  creditLimit: number | null;
  taxRegistrationNumber: string;
  currencyCode: string | null;
};

export type BCListOrdersResult = {
  orders: BCOrder[];
  count: number;
  offset: number;
  limit: number;
};

export type BCReturnLineInput = {
  sourceLineNo: number;
  quantityToReturn: number;
  returnReasonCode: string;
};

export type BCCreateReturnParams = {
  requestId: string;
  sourceOrderNo: string;
  lines: BCReturnLineInput[];
};

export type BCReturnLine = {
  sourceLineNo: number;
  quantityToReturn: number;
  returnReasonCode: string;
};

export type BCReturnOrder = {
  id: string;
  number: string;
  status: string;
  requestId: string;
  sourceOrderNo: string;
  lines: BCReturnLine[];
};

export type BCReturnReason = {
  id: string;
  description: string;
};

export interface IBusinessCentralModuleService {
  getOperations(): Promise<unknown>;
  listOrders(params: BCListOrdersParams): Promise<BCListOrdersResult>;
  getOrder(params: BCGetOrderParams): Promise<BCOrderDetail | null>;
  getCustomer(customerNumber: string): Promise<BCCustomer | null>;
  findItemsForOrderLines(
    lines: BCItemLookupInput[]
  ): Promise<BCItemLookupResult[]>;
  createSalesOrder(
    params: BCCreateSalesOrderParams
  ): Promise<BCCreatedSalesOrder>;
  createReturnFromSalesOrder(
    params: BCCreateReturnParams
  ): Promise<BCReturnOrder>;
  listReturnReasons(): Promise<BCReturnReason[]>;
}

export type BCItem = {
  id: string;
  number: string;
  displayName: string;
  gtin: string;
  baseUnitOfMeasureCode: string;
};

export type BCItemMatchSource = "eanNo" | "itemNumber" | "custItemNo";

export type BCItemLookupFailureReason =
  | "no_identifiers"
  | "not_found"
  | "ambiguous";

export type BCItemLookupInput = {
  lineNumber: number;
  eanNo?: string;
  itemNumber?: string;
  custItemNo?: string;
};

export type BCItemLookupResult =
  | {
      lineNumber: number;
      matched: true;
      item: BCItem;
      matchedBy: BCItemMatchSource;
    }
  | {
      lineNumber: number;
      matched: false;
      reason: BCItemLookupFailureReason;
    };

export type BCSalesOrderAddressInput = {
  name?: string;
  contact?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postCode?: string;
  country?: string;
};

// Deliberately has no unitPrice / discount / tax / description fields: Business Central prices
// and describes the line from its own master data (NIMBUS-129 PROGRESS.md, 2026-09-16).
export type BCCreateSalesOrderLineInput = {
  lineNumber: number;
  itemId: string;
  quantity: number;
  unitOfMeasureCode?: string;
  shipmentDate?: string;
};

export type BCCreateSalesOrderParams = {
  customerNumber: string;
  externalDocumentNumber: string;
  orderDate?: string;
  requestedDeliveryDate?: string;
  // Only set when the order's currency differs from the BC customer's own currency (Task 04).
  currencyCode?: string;
  email?: string;
  phoneNumber?: string;
  billTo?: BCSalesOrderAddressInput;
  shipTo?: BCSalesOrderAddressInput;
  lines: BCCreateSalesOrderLineInput[];
};

export type BCSalesOrderLineRejection = {
  lineNumber: number;
  message: string;
};

export type BCCreatedSalesOrder = {
  id: string;
  number: string;
  status: string;
  acceptedLineNumbers: number[];
  rejectedLines: BCSalesOrderLineRejection[];
};
