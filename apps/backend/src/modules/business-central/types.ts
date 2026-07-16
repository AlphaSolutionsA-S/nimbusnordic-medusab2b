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
  status: BCOrderStatus;
  currencyCode: string;
  totalAmountExcludingTax: number;
  totalAmountIncludingTax: number;
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

export type BCListOrdersResult = {
  orders: BCOrder[];
  count: number;
  offset: number;
  limit: number;
};

export interface IBusinessCentralModuleService {
  getOperations(): Promise<unknown>;
  listOrders(params: BCListOrdersParams): Promise<BCListOrdersResult>;
}
