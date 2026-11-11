import { redirect } from "next/navigation";

/** Public registration is intentionally unavailable for this single-owner store. */
export default function RegisterPage() {
  redirect("/login");
}
