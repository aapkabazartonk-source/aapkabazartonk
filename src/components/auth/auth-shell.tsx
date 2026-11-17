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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(163,202,105,0.28),_transparent_52%),radial-gradient(ellipse_at_bottom_right,_rgba(146,153,201,0.22),_transparent_42%),radial-gradient(ellipse_at_bottom_left,_rgba(163,202,105,0.12),_transparent_45%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.28]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(146,153,201,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(163,202,105,0.1) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative w-full max-w-md animate-fade-in-up">
        <div className="mb-8 text-center">
          <Link
            href="/login"
            className="mb-5 inline-flex items-center gap-2.5 text-foreground"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_10px_30px_rgba(163,202,105,0.35)] ring-4 ring-purple-soft">
              <Store className="h-5 w-5" />
            </span>
            <span className="text-xl font-semibold tracking-tight">
              Aapka Bazar
            </span>
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-md)] ring-1 ring-purple-soft/70 sm:p-8">
          {children}
        </div>

        {footer ? (
          <div className="mt-6 text-center text-sm text-muted-foreground">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
