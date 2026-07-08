"use server"

import { sdk } from "@/lib/config"
import { getAuthHeaders } from "@/lib/data/cookies"

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
