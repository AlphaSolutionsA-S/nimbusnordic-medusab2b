"use client"

import { Github } from "@medusajs/icons"
import { Heading } from "@medusajs/ui"
import Button from "@/modules/common/components/button"
import { useTranslations } from "next-intl"
import Image from "next/image"

const Hero = () => {
  const t = useTranslations("Home.hero")

  return (
    <div className="h-[75vh] w-full border-b border-ui-border-base relative bg-neutral-100">
      <Image
        src="/hero-image.jpg"
        alt={t("bannerAlt")}
        layout="fill"
        quality={100}
        priority
      />
      <div className="absolute inset-0 z-1 flex flex-col justify-center items-center text-center small:p-32 gap-6">
        <span>
          <p className="text-neutral-600 text-xs uppercase">
            {t("eyebrow")}
          </p>

          <Heading
            level="h1"
            className="text-6xl leading-10 text-ui-fg-base font-normal mt-10 mb-5"
          >
            {t("heading")}
          </Heading>

          <p className="leading-10 text-ui-fg-subtle font-normal text-lg">
            {t("subheading")}
          </p>
        </span>
        <a
          href="https://github.com/medusajs/b2b-starter-medusa"
          target="_blank"
        >
          <Button variant="secondary" className="rounded-2xl">
            <Github />
            {t("githubRepoLabel")}
          </Button>
        </a>
      </div>
    </div>
  )
}

export default Hero
