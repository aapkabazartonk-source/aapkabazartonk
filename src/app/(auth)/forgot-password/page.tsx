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
          <Link
            href="/login"
            className="font-medium text-[#128C7E] hover:underline"
          >
            Back to sign in
          </Link>
        </>
      }
    >
      <div className="space-y-4 text-sm leading-relaxed text-[#252B24]">
        <p>
          Aapka Bazar uses a single owner account. Password resets are done
          securely on the server with an environment-backed command — nothing is
          emailed and no public reset tokens are issued.
        </p>
        <ol className="list-decimal space-y-2 pl-5 text-[#858C80]">
          <li>
            On the host that can reach MongoDB, set{" "}
            <code className="rounded bg-[#F4F6EF] px-1.5 py-0.5 text-xs text-[#252B24]">
              OWNER_EMAIL
            </code>{" "}
            (optional if only one owner exists) and{" "}
            <code className="rounded bg-[#F4F6EF] px-1.5 py-0.5 text-xs text-[#252B24]">
              OWNER_PASSWORD
            </code>{" "}
            to the new password.
          </li>
          <li>
            Run{" "}
            <code className="rounded bg-[#F4F6EF] px-1.5 py-0.5 text-xs text-[#252B24]">
              npm run auth:reset-owner-password
            </code>
            .
          </li>
          <li>Sign in again with the new password. Old sessions are invalidated.</li>
        </ol>
        <Link
          href="/login"
          className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-[#128C7E] text-sm font-medium text-white transition-colors hover:bg-[#0f7a6e]"
        >
          Return to sign in
        </Link>
      </div>
    </AuthShell>
  );
}
