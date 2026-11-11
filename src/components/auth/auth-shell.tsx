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
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#F4F6EF] px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(165,203,98,0.22),_transparent_52%),radial-gradient(ellipse_at_bottom_right,_rgba(18,140,126,0.12),_transparent_42%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(37,43,36,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(37,43,36,0.03) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative w-full max-w-md animate-fade-in-up">
        <div className="mb-8 text-center">
          <Link
            href="/login"
            className="mb-5 inline-flex items-center gap-2.5 text-[#252B24]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#128C7E] text-white shadow-[0_10px_30px_rgba(18,140,126,0.28)]">
              <Store className="h-5 w-5" />
            </span>
            <span className="text-xl font-semibold tracking-tight">
              Aapka Bazar
            </span>
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-[#252B24]">
            {title}
          </h1>
          <p className="mt-2 text-sm text-[#858C80]">{subtitle}</p>
        </div>

        <div className="rounded-2xl border border-[#E8EBE2] bg-white p-6 shadow-[0_16px_40px_rgba(37,43,36,0.06)] sm:p-8">
          {children}
        </div>

        {footer ? (
          <div className="mt-6 text-center text-sm text-[#858C80]">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
