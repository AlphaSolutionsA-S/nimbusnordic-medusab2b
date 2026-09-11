export type BCOrderStatus =
  | "Open"
  | "Draft"
  | "Released"
  | "Pending Approval"
  | "Pending Prepayment"
  | "Shipped"
  | "Invoiced"

export type BCOrderInvoiceStatus = "open" | "partially_invoiced" | "fully_invoiced"

export type BCOrder = {
  id: string
  number: string
  orderDate: string
  customerNumber: string
  customerName: string
  billToAddress: string[]
  shipToAddress: string[]
  status: string
  invoiceStatus: BCOrderInvoiceStatus
  currencyCode: string
  totalAmountExcludingTax: number
  totalAmountIncludingTax: number
}

export type BCOrderLine = {
  id: string
  sequence: number
  lineType: string
  itemId?: string
  itemNumber?: string
  itemDisplayName?: string
  description: string
  quantity: number
  unitPrice: number
  lineAmount: number
}

export type BCOrderInvoiceSummary = {
  id: string
  number: string
  invoiceDate: string
  status: string
  totalAmountExcludingTax: number
  totalAmountIncludingTax: number
}

export type BCOrderDetail = BCOrder & {
  lines: BCOrderLine[]
  invoices: BCOrderInvoiceSummary[]
}

export type BCOrderListParams = {
  limit?: number
  offset?: number
  status?: string
  date_from?: string
  date_to?: string
  search?: string
}

export type BCOrderListResponse = {
  orders: BCOrder[]
  count: number
  offset: number
  limit: number
}

export type BCReturnReason = {
  id: string
  description: string
}

export type BCReturnLineInput = {
  source_line_no: number
  quantity: number
  return_reason_code: string
}

export type BCReturnRequestBody = {
  lines: BCReturnLineInput[]
}

export type BCReturnLine = {
  sourceLineNo: number
  quantityToReturn: number
  returnReasonCode: string
}

export type BCReturnOrder = {
  id: string
  number: string
  status: string
  requestId: string
  sourceOrderNo: string
  lines: BCReturnLine[]
}
