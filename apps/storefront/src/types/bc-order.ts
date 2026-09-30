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
  shippedQuantity: number
  returnableQuantity: number
  reservations: BCOrderLineReservation[]
}

export type BCOrderLineReservation = {
  id: string
  quantity: number
  reservedFrom: string
  locationCode: string
  freightType: string
  expectedReceiptDate: string | null
  shipmentDate: string | null
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

export type BCReturnState = "open" | "processed"

export type BCReturnSource = "return_order" | "posted_receipt"

export type BCPostedReturnReceiptSummary = {
  number: string
  receivedDate: string
  externalDocumentNumber: string
}

export type BCReturnListItem = {
  id: string
  number: string
  documentDate: string
  status: string
  state: BCReturnState
  source: BCReturnSource
  itemCount: number
  receipts: BCPostedReturnReceiptSummary[]
}

export type BCReturnListParams = {
  limit?: number
  offset?: number
  state?: BCReturnState
  date_from?: string
  date_to?: string
  search?: string
}

export type BCReturnListResponse = {
  returns: BCReturnListItem[]
  count: number
  offset: number
  limit: number
}

export type BCPostedReturnReceiptLine = {
  lineNumber: number
  itemNumber: string
  variantCode: string
  description: string
  quantity: number
  unitOfMeasureCode: string
  returnReasonCode: string
}

export type BCPostedReturnReceipt = BCPostedReturnReceiptSummary & {
  lines: BCPostedReturnReceiptLine[]
}

export type BCReturnDetailLine = {
  id: string
  sequence: number
  lineType: string
  itemNumber: string
  variantCode: string
  description: string
  unitOfMeasureCode: string
  quantity: number
  quantityReceived: number
  returnReasonCode: string
}

export type BCReturnExpectedCredit = {
  currencyCode: string
  amountIncludingTax: number
  amountExcludingTax: number | null
}

export type BCReturnDetail = {
  id: string
  number: string
  documentDate: string
  status: string
  state: BCReturnState
  source: BCReturnSource
  lines: BCReturnDetailLine[]
  expectedCredit: BCReturnExpectedCredit | null
  receipts: BCPostedReturnReceipt[]
}
