import { redirect } from "next/navigation";

/** Staff / role management is disabled for this single-owner store. */
export default function UsersSettingsPage() {
  redirect("/dashboard/settings");
}
