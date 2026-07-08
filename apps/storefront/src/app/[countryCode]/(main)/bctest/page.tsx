import { listBusinessCentralOperations } from "@/lib/data/business-central"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "BC API Test",
}

export default async function BcTestPage() {
  let operations: unknown = null
  let error: string | null = null

  try {
    const result = await listBusinessCentralOperations()
    operations = result.operations
  } catch (e) {
    error = e instanceof Error ? e.message : "Unknown error"
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-4">
        Business Central API Operations
      </h1>

      {error ? (
        <div className="rounded border border-red-300 bg-red-50 p-4 text-red-700">
          <p className="font-medium">Error</p>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      ) : (
        <pre className="overflow-auto rounded border border-neutral-200 bg-neutral-50 p-4 text-sm">
          {JSON.stringify(operations, null, 2)}
        </pre>
      )}
    </div>
  )
}
