"use server"

import { sdk } from "@/lib/config"
import { getAuthHeaders } from "@/lib/data/cookies"
import type {
  BCOrderDetail,
  BCOrderListParams,
  BCOrderListResponse,
  BCReturnOrder,
  BCReturnReason,
  BCReturnRequestBody,
} from "@/types/bc-order"
import { FetchError } from "@medusajs/js-sdk"

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

type StoreBCOrderDetailResponse = {
  order: BCOrderDetail
}

export const retrieveBCOrder = async (
  id: string
): Promise<BCOrderDetail | null> => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  try {
    const response = await sdk.client.fetch<StoreBCOrderDetailResponse>(
      `/store/bc-orders/${id}`,
      {
        method: "GET",
        headers,
        credentials: "include",
      }
    )

    return response.order
  } catch (error) {
    if (error instanceof FetchError && error.status === 404) {
      return null
    }

    throw error
  }
}

type StoreBCReturnReasonsResponse = {
  return_reasons: BCReturnReason[]
}

type StoreBCReturnResponse = {
  return: BCReturnOrder
}

export const listBCReturnReasons = async (): Promise<BCReturnReason[]> => {
  const headers = {
    ...(await getAuthHeaders()),
  }
  const response = await sdk.client.fetch<StoreBCReturnReasonsResponse>(
    "/store/bc-orders/return-reasons",
    {
      method: "GET",
      headers,
      credentials: "include",
      cache: "no-store",
    }
  )

  return response.return_reasons
}

export const createBCReturn = async (
  orderId: string,
  body: BCReturnRequestBody
): Promise<BCReturnOrder> => {
  const headers = {
    ...(await getAuthHeaders()),
  }
  const response = await sdk.client.fetch<StoreBCReturnResponse>(
    `/store/bc-orders/${orderId}/returns`,
    {
      method: "POST",
      headers,
      body,
      credentials: "include",
    }
  )

  return response.return
}
