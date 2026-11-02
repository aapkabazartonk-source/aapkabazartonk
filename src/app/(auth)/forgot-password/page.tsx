import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = {
  title: "Reset password",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we'll send reset instructions."
      footer={
        <>
          Remembered your password?{" "}
          <Link href="/login" className="font-medium text-success hover:underline">
            Back to sign in
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            name="email"
            placeholder="you@store.com"
            autoComplete="email"
          />
        </div>
        <Button className="w-full" asChild>
          <Link href="/login">Send reset link</Link>
        </Button>
      </div>
    </AuthShell>
  );
}
