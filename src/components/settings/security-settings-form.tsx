"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SettingsShell } from "@/components/settings/settings-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ApiClientError, fetchJson } from "@/lib/fetch-json";

type SecurityForm = {
  requirePasswordChangeOnNextLogin: boolean;
  sessionTimeoutMinutes: number;
  authIntegrated: boolean;
  passwordChangeSupported: boolean;
  sessionManagementSupported: boolean;
  activeSessionsSupported: boolean;
};

export function SecuritySettingsForm() {
  const [form, setForm] = useState<SecurityForm | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchJson<{ data: SecurityForm }>("/api/settings/security")
      .then((response) => setForm(response.data))
      .catch((error) => {
        toast.error(
          error instanceof ApiClientError
            ? error.message
            : "Could not load security settings.",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        requirePasswordChangeOnNextLogin: form.requirePasswordChangeOnNextLogin,
        sessionTimeoutMinutes: form.sessionTimeoutMinutes,
      };
      if (newPassword || currentPassword || confirmPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
        payload.confirmPassword = confirmPassword;
      }
      const response = await fetchJson<{ data: SecurityForm }>(
        "/api/settings/security",
        { method: "PATCH", body: JSON.stringify(payload) },
      );
      setForm(response.data);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Security settings saved.");
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Could not save security settings.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsShell
      title="Security"
      description="Owner passwords are hashed with scrypt. Changing the password invalidates existing sessions."
    >
      <Card>
        <CardContent className="space-y-5">
          {loading || !form ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant={form.authIntegrated ? "success" : "warning"}>
                  {form.authIntegrated
                    ? "Auth integrated"
                    : "Auth shell (no sessions)"}
                </Badge>
                <Badge variant="secondary">
                  Password change{" "}
                  {form.passwordChangeSupported ? "available" : "pending auth"}
                </Badge>
                <Badge variant="secondary">
                  Active sessions{" "}
                  {form.activeSessionsSupported ? "available" : "not supported"}
                </Badge>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                <div>
                  <p className="text-sm font-medium">
                    Require password change on next login
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Preference stored for the owner account policy.
                  </p>
                </div>
                <Switch
                  checked={form.requirePasswordChangeOnNextLogin}
                  onCheckedChange={(requirePasswordChangeOnNextLogin) =>
                    setForm((current) =>
                      current
                        ? { ...current, requirePasswordChangeOnNextLogin }
                        : current,
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Preferred session timeout (minutes)</Label>
                <Input
                  type="number"
                  min={15}
                  value={form.sessionTimeoutMinutes}
                  onChange={(e) =>
                    setForm((current) =>
                      current
                        ? {
                            ...current,
                            sessionTimeoutMinutes: Number(e.target.value) || 480,
                          }
                        : current,
                    )
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Preferred timeout for future rolling session refresh. Active
                  cookies currently use 12 hours, or 30 days with Remember me.
                </p>
              </div>

              <div className="space-y-3 rounded-xl border border-border p-4">
                <p className="text-sm font-medium">Change password</p>
                {!form.passwordChangeSupported ? (
                  <p className="text-xs text-muted-foreground">
                    Password change requires a signed-in user. Login currently
                    opens the dashboard without creating a session.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Current password</Label>
                      <Input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>New password</Label>
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Confirm password</Label>
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button onClick={() => void save()} disabled={saving}>
                  {saving ? "Saving…" : "Save security settings"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </SettingsShell>
  );
}
