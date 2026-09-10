"use client"

import { Heading } from "@medusajs/ui"
import Button from "@/modules/common/components/button"
import { useTranslations } from "next-intl"
import Image from "next/image"

const Hero = () => {
  const t = useTranslations("Home.hero")

  return (
    <div className="storefront-hero relative h-[75vh] min-h-[560px] w-full overflow-hidden bg-zinc-900 small:min-h-[680px]">
      <Image
        src="/nimbus-branding-banner.jpg"
        alt={t("bannerAlt")}
        layout="fill"
        quality={100}
        priority
        className="object-cover object-center"
      />
      <div className="absolute inset-0 z-[2] flex max-w-[1600px] flex-col justify-end gap-6 px-5 pb-10 text-left text-white small:mx-auto small:px-8 small:pb-20">
        <span className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-200">
            {t("eyebrow")}
          </p>

          <Heading
            level="h1"
            className="mt-5 mb-5 max-w-2xl text-5xl font-normal leading-[0.9] tracking-[-0.055em] text-white small:text-7xl medium:text-8xl"
          >
            {t("heading")}
          </Heading>

          <p className="max-w-xl text-base font-normal leading-7 text-neutral-100 small:text-lg">
            {t("subheading")}
          </p>
        </span>
        <a
          href="https://github.com/medusajs/b2b-starter-medusa"
          target="_blank"
        >
          <Button
            variant="secondary"
            className="rounded-none border border-white bg-transparent px-6 py-3 text-xs uppercase tracking-[0.16em] text-white hover:bg-white hover:text-zinc-900"
          >
            {t("githubRepoLabel")}
          </Button>
        </a>
      </div>
    </div>
  )
}

export default Hero
