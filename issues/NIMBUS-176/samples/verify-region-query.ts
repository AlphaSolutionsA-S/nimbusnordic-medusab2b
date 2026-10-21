import assert from "node:assert/strict"
import type { ExecArgs, RemoteQueryFunction } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function verifyRegionQuery({ container }: ExecArgs) {
  const query: Omit<RemoteQueryFunction, symbol> = container.resolve(
    ContainerRegistrationKeys.QUERY
  )

  // Deliberate narrow country-membership check for NIMBUS-176; no core entity details.
  const { data } = await query.graph({
    entity: "region",
    fields: ["id", "countries.iso_2"],
  })

  assert(Array.isArray(data), "Expected a region array")
  assert(data.length > 0, "No regions: cannot verify the populated relation")
  let countryCount = 0
  const regions = data.map((region) => {
    assert.equal(typeof region.id, "string", "Region id must be a string")
    assert(Array.isArray(region.countries), "Region countries must be an array")
    const countries = region.countries.map((country) => {
      assert.equal(typeof country.iso_2, "string", "Country iso_2 must be a string")
      assert.match(country.iso_2, /^[a-z]{2}$/, "Expected lowercase alpha-2 code")
      countryCount += 1
      return country.iso_2
    })
    return { id: region.id, countries: countries.sort() }
  })
  assert(countryCount > 0, "No assigned countries: relation remains unverified")

  const { data: missing } = await query.graph({
    entity: "region",
    fields: ["id", "countries.iso_2"],
    filters: { id: "__nimbus176_nonexistent_region__" },
  })
  assert.deepEqual(missing, [], "Unknown region must return an empty array")

  console.log(JSON.stringify({
    check: "NIMBUS-176 region Query projection",
    result: "PASS",
    regionCount: regions.length,
    countryCount,
    regions,
    missingRegion: missing,
    mutations: 0,
    notExercised: ["country removal/re-addition lifecycle"],
  }, null, 2))
}
