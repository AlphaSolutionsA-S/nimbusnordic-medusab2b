import { retrieveCustomer } from "@/lib/data/customer"
import FeaturedProducts from "@/modules/home/components/featured-products"
import Hero from "@/modules/home/components/hero"
import SkeletonFeaturedProducts from "@/modules/skeletons/templates/skeleton-featured-products"
import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"
import { Suspense } from "react"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata.home")

  return {
    title: t("title"),
    description: t("description"),
  }
}

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  const customer = await retrieveCustomer()
  const params = await props.params

  const { countryCode } = params

  if (!customer) {
    redirect(`/${countryCode}/account`)
  }

  return (
    <div className="flex flex-col">
      <Hero />
      <Suspense fallback={<SkeletonFeaturedProducts />}>
        <FeaturedProducts countryCode={countryCode} />
      </Suspense>
    </div>
  )
}
