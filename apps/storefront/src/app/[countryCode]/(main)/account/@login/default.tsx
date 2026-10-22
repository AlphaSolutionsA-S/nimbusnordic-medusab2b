import { redirect } from "next/navigation"

// Next.js 16 requires a default for this slot. The layout renders it only for a signed-out visitor
// on a deep account link, who goes to the front page (NIMBUS-209). The segment arrives decoded,
// so it is re-encoded to keep a crafted value from forming an off-site `//host` target.
export default async function LoginDefault({
  params,
}: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await params

  redirect(`/${encodeURIComponent(countryCode)}`)
}
