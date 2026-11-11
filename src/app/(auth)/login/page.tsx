import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back."
      subtitle="Sign in to manage your store."
      footer="Single owner access for Aapka Bazar."
    >
      <Suspense
        fallback={
          <div className="space-y-4">
            <div className="h-10 animate-pulse rounded-lg bg-[#F4F6EF]" />
            <div className="h-10 animate-pulse rounded-lg bg-[#F4F6EF]" />
            <div className="h-11 animate-pulse rounded-lg bg-[#F4F6EF]" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
