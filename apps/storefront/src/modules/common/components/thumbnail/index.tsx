import { Photo } from "@medusajs/icons"
import Image from "next/image"
import { useTranslations } from "next-intl"

type ThumbnailProps = {
  src?: string | null
  alt?: string
}

// NOTE: this component is not imported/used anywhere in the app (verified via
// repo-wide search). Left in place per this project's dead-code policy
// (flagged, not removed).
export const Thumbnail = ({ src, alt }: ThumbnailProps) => {
  const t = useTranslations("Common.thumbnail")

  return (
    <div className="bg-ui-bg-component flex h-8 w-6 items-center justify-center overflow-hidden rounded-[4px]">
      {src ? (
        <Image
          src={src}
          alt={alt! || t("altFallback")}
          className="h-full w-full object-cover object-center"
          draggable={false}
          quality={50}
          width={6}
          height={8}
        />
      ) : (
        <Photo className="text-ui-fg-subtle" />
      )}
    </div>
  )
}
