import Link from "next/link";

/**
 * Fallback only — middleware redirects `/` → `/dashboard`.
 * Avoids `redirect()` during Cache Components prerender/instant validation.
 */
export default function HomePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6">
      <Link
        href="/dashboard"
        className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
      >
        Continue to dashboard
      </Link>
    </main>
  );
}
