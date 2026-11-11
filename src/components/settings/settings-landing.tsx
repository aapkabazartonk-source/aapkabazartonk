"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { SETTINGS_NAV } from "@/lib/settings-nav";

export function SettingsLanding() {
  return (
    <div>
      <PageHeader
        className="mb-0 sm:mb-0"
        title="Settings"
        description="Configure business profile, tax, invoices, printing, billing, and owner security."
      />
      <div className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-2 xl:grid-cols-3">
        {SETTINGS_NAV.map((item, index) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card
                className={`h-full animate-fade-in-up transition-all duration-200 hover:border-primary/25 hover:shadow-[var(--shadow-md)] group-focus-visible:border-primary/40 stagger-${Math.min(index + 1, 6)}`}
              >
                <CardContent className="flex items-start gap-4">
                  <span className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-base font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
                        {item.title}
                      </h2>
                      <ChevronRight
                        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
                        aria-hidden
                      />
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
