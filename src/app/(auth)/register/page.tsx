import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = {
  title: "Create account",
};

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Set up Aapka Bazar for your store in a few steps."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-success hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" name="name" placeholder="Aditya Sharma" autoComplete="name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="store">Store name</Label>
          <Input id="store" name="store" placeholder="Aapka Bazar Tonk" />
        </div>
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
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            name="password"
            placeholder="Create a strong password"
            autoComplete="new-password"
          />
        </div>
        <Button className="w-full" asChild>
          <Link href="/dashboard">Create account</Link>
        </Button>
      </div>
    </AuthShell>
  );
}
