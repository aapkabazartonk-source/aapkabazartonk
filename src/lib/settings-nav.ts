import type { LucideIcon } from "lucide-react";
import {
  Building2,
  FileText,
  KeyRound,
  Percent,
  Printer,
  Receipt,
  Shield,
} from "lucide-react";

export interface SettingsNavItem {
  title: string;
  href: string;
  description: string;
  icon: LucideIcon;
}

export const SETTINGS_NAV: SettingsNavItem[] = [
  {
    title: "Business profile",
    href: "/dashboard/settings/business",
    description: "Name, logo, address, and store details",
    icon: Building2,
  },
  {
    title: "GST & tax",
    href: "/dashboard/settings/tax",
    description: "GSTIN, inclusive pricing, and invoice eligibility",
    icon: Percent,
  },
  {
    title: "Invoice",
    href: "/dashboard/settings/invoice",
    description: "Prefixes, paper size, footer, and preview",
    icon: FileText,
  },
  {
    title: "Printer",
    href: "/dashboard/settings/printer",
    description: "Browser print preferences and paper size",
    icon: Printer,
  },
  {
    title: "Billing",
    href: "/dashboard/settings/billing",
    description: "Payment methods, discounts, and POS behaviour",
    icon: Receipt,
  },
  {
    title: "Security",
    href: "/dashboard/settings/security",
    description: "Owner password and session preferences",
    icon: Shield,
  },
];

export function getSettingsNavItem(pathname: string) {
  return SETTINGS_NAV.find((item) => pathname.startsWith(item.href));
}

export const SettingsKeyIcon = KeyRound;
