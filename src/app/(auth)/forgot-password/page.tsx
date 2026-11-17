import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = {
  title: "Reset password",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      subtitle="Email recovery is not configured for this store."
      footer={
        <>
          Remembered your password?{" "}
          <Link href="/login" className="font-medium text-purple hover:underline">
            Back to sign in
          </Link>
        </>
      }
    >
      <div className="space-y-4 text-sm leading-relaxed text-foreground">
        <p>
          Aapka Bazar uses a single owner account. Password resets are done
          securely on the server with an environment-backed command — nothing is
          emailed and no public reset tokens are issued.
        </p>
        <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
          <li>
            On the host that can reach MongoDB, set{" "}
            <code className="rounded bg-secondary px-1.5 py-0.5 text-xs text-foreground">
              OWNER_EMAIL
            </code>{" "}
            (optional if only one owner exists) and{" "}
            <code className="rounded bg-secondary px-1.5 py-0.5 text-xs text-foreground">
              OWNER_PASSWORD
            </code>{" "}
            to the new password.
          </li>
          <li>
            Run{" "}
            <code className="rounded bg-secondary px-1.5 py-0.5 text-xs text-foreground">
              npm run auth:reset-owner-password
            </code>
            .
          </li>
          <li>Sign in again with the new password. Old sessions are invalidated.</li>
        </ol>
        <Link
          href="/login"
          className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Return to sign in
        </Link>
      </div>
    </AuthShell>
  );
}
