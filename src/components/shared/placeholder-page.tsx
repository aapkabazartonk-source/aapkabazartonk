import { Construction } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import type { LucideIcon } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  description: string;
  icon: LucideIcon;
  highlights?: string[];
}

export function PlaceholderPage({
  title,
  description,
  icon: Icon,
  highlights = [
    "Data models prepared",
    "Navigation ready",
    "Full workflow coming in a later phase",
  ],
}: PlaceholderPageProps) {
  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={<Badge variant="purple">Coming soon</Badge>}
      />

      <Card className="overflow-hidden">
        <CardContent className="relative p-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(165,203,98,0.18),_transparent_45%),radial-gradient(circle_at_bottom_left,_rgba(18,140,126,0.08),_transparent_40%)]" />
          <div className="relative flex flex-col items-center px-6 py-16 text-center sm:px-10 sm:py-20">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-md)]">
              <Icon className="h-7 w-7 text-foreground" />
            </div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <Construction className="h-3.5 w-3.5" />
              Phase 1 placeholder
            </div>
            <h2 className="max-w-lg text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {title} module foundation is ready
            </h2>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
              {description} This screen establishes the route, navigation, and design
              language. Business logic and data workflows will arrive in upcoming phases.
            </p>
            <ul className="mt-8 grid w-full max-w-2xl gap-3 sm:grid-cols-3">
              {highlights.map((item) => (
                <li
                  key={item}
                  className="rounded-2xl border border-border bg-card/90 px-4 py-3 text-sm font-medium text-foreground shadow-[var(--shadow-sm)]"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
