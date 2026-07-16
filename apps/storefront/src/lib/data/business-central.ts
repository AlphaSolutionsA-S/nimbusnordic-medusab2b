"use server"

import { sdk } from "@/lib/config"
import { getAuthHeaders } from "@/lib/data/cookies"
import type { BCOrderListParams, BCOrderListResponse } from "@/types/bc-order"

type StoreBusinessCentralOperationsResponse = {
  operations: unknown
}

export const listBusinessCentralOperations = async () => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.client.fetch<StoreBusinessCentralOperationsResponse>(
    "/store/business-central/operations",
    {
      method: "GET",
      headers,
      credentials: "include",
    }
  )
}

export const listBCOrders = async (
  params: BCOrderListParams = {}
): Promise<BCOrderListResponse> => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.client.fetch<BCOrderListResponse>("/store/bc-orders", {
    method: "GET",
    headers,
    query: {
      limit: params.limit ?? 20,
      offset: params.offset ?? 0,
      ...(params.status ? { status: params.status } : {}),
      ...(params.date_from ? { date_from: params.date_from } : {}),
      ...(params.date_to ? { date_to: params.date_to } : {}),
      ...(params.search ? { search: params.search } : {}),
    },
    credentials: "include",
  })
}

