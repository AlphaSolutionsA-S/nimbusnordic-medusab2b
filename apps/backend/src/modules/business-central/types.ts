export type BCOrderStatus =
  | "Open"
  | "Released"
  | "Pending Approval"
  | "Pending Prepayment"
  | "Shipped"
  | "Invoiced";

export type BCOrder = {
  id: string;
  number: string;
  orderDate: string;
  customerNumber: string;
  customerName: string;
  billToAddress: string[];
  shipToAddress: string[];
  status: BCOrderStatus;
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
};

export type BCOrderDetail = BCOrder & {
  lines: BCOrderLine[];
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
  orderId: string;
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
  createReturnFromSalesOrder(
    params: BCCreateReturnParams
  ): Promise<BCReturnOrder>;
  listReturnReasons(): Promise<BCReturnReason[]>;
}
