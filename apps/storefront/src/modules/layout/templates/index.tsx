import React from "react"

import type { CountryLanguagePublication } from "@/lib/i18n/country-language-map"
import Footer from "@/modules/layout/templates/footer"
import { NavigationHeader } from "@/modules/layout/templates/nav"

const Layout: React.FC<{
  children: React.ReactNode
  countryLanguages: CountryLanguagePublication
}> = ({ children, countryLanguages }) => {
  return (
    <div>
      <NavigationHeader countryLanguages={countryLanguages} />
      <main className="relative">{children}</main>
      <Footer countryLanguages={countryLanguages} />
    </div>
  )
}

export default Layout
