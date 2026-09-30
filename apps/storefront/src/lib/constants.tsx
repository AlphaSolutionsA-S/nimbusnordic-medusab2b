import Bancontact from "@/modules/common/icons/bancontact"
import FilePlus from "@/modules/common/icons/file-plus"
import Ideal from "@/modules/common/icons/ideal"
import PayPal from "@/modules/common/icons/paypal"
import { CreditCard } from "@medusajs/icons"
import React from "react"

// Keys of the `Common.paymentMethods` catalog namespace.
export type PaymentMethodTitleKey =
  | "creditCard"
  | "ideal"
  | "bancontact"
  | "paypal"
  | "invoice"

export type PaymentInfo = {
  titleKey: PaymentMethodTitleKey
  icon: React.JSX.Element
}

/* Map of payment provider_id to its title key and icon. Titles are resolved
   through `Common.paymentMethods` at render time. */
export const paymentInfoMap: Record<string, PaymentInfo> = {
  pp_stripe_stripe: { titleKey: "creditCard", icon: <CreditCard /> },
  "pp_medusa-payments_default": { titleKey: "creditCard", icon: <CreditCard /> },
  "pp_stripe-ideal_stripe": { titleKey: "ideal", icon: <Ideal /> },
  "pp_stripe-bancontact_stripe": { titleKey: "bancontact", icon: <Bancontact /> },
  pp_paypal_paypal: { titleKey: "paypal", icon: <PayPal /> },
  pp_system_default: { titleKey: "invoice", icon: <FilePlus /> },
  // Add more payment providers here
}

// This only checks if it is native stripe or medusa payments for card payments, it ignores the other stripe-based providers
export const isStripeLike = (providerId?: string) => {
  return (
    providerId?.startsWith("pp_stripe") ||
    providerId?.startsWith("pp_medusa-payments")
  )
}
export const isPaypal = (providerId?: string) => {
  return providerId?.startsWith("pp_paypal")
}
export const isManual = (providerId?: string) => {
  return providerId?.startsWith("pp_system_default")
}

export const currencySymbolMap: Record<string, string> = {
  usd: "$",
  eur: "€",
  gbp: "£",
  cad: "C$",
  aud: "A$",
  jpy: "¥",
  cny: "¥",
  chf: "CHF",
  hkd: "HK$",
  nzd: "NZ$",
  sek: "kr",
  krw: "₩",
  sgd: "S$",
  nok: "kr",
  mxn: "$",
  inr: "₹",
  rub: "₽",
  zar: "R",
  try: "₺",
  brl: "R$",
  twd: "NT$",
  dkk: "kr",
  pln: "zł",
  thb: "฿",
  idr: "Rp",
  huf: "Ft",
  czk: "Kč",
  ils: "₪",
  clp: "$",
  php: "₱",
  aed: "د.إ",
  cop: "$",
  sar: "﷼",
  myr: "RM",
  ron: "lei",
  vnd: "₫",
  egp: "£",
  pkr: "₨",
  ngn: "₦",
  bdt: "৳",
  uah: "₴",
  kes: "KSh",
  ars: "$",
  qar: "﷼",
  kwd: "د.ك",
  omr: "﷼",
  bhd: "ب.د",
  lkr: "₨",
  mmk: "K",
  uzs: "лв",
}
