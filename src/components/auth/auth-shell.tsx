import Link from "next/link";
import { Store } from "lucide-react";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(165,203,98,0.2),_transparent_50%),radial-gradient(ellipse_at_bottom_right,_rgba(18,140,126,0.1),_transparent_40%)]" />
      <div className="relative w-full max-w-md animate-fade-in-up">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="mb-5 inline-flex items-center gap-2.5 text-foreground"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-md)]">
              <Store className="h-5 w-5 text-foreground" />
            </span>
            <span className="text-lg font-semibold tracking-tight">Aapka Bazar</span>
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-md)] sm:p-8">
          {children}
        </div>

        {footer ? (
          <div className="mt-6 text-center text-sm text-muted-foreground">
            {footer}
          </div>
        ) : null}

        <p className="mt-4 text-center text-xs text-muted-foreground">
          UI preview only — authentication is not functional in Phase 1.
        </p>
      </div>
    </div>
  );
}
