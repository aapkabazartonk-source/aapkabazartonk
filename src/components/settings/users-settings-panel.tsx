"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SettingsShell } from "@/components/settings/settings-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiClientError, fetchJson } from "@/lib/fetch-json";
import { permissionsForRole } from "@/lib/permissions";
import type { UserRole } from "@/lib/constants";

type UsersResponse = {
  data: Array<{
    _id: string;
    name: string;
    email: string;
    phone?: string;
    role: UserRole;
    isActive: boolean;
  }>;
  meta: {
    authIntegrated: boolean;
    roles: string[];
    migrationNote?: string;
  };
};

export function UsersSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [response, setResponse] = useState<UsersResponse | null>(null);

  useEffect(() => {
    fetchJson<UsersResponse>("/api/settings/users")
      .then(setResponse)
      .catch((error) => {
        toast.error(
          error instanceof ApiClientError
            ? error.message
            : "Could not load users.",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <SettingsShell
      title="Users & permissions"
      description="Server-side roles control products, inventory, purchases, POS, discounts, reports, and settings."
    >
      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-3">
            <h3 className="text-sm font-semibold">Role matrix</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["owner", "admin", "manager", "cashier"] as UserRole[]).map(
                (role) => (
                  <div
                    key={role}
                    className="rounded-xl border border-border px-3 py-3 text-sm"
                  >
                    <p className="font-medium capitalize">{role}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {permissionsForRole(role).join(" · ")}
                    </p>
                  </div>
                ),
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : !response?.meta.authIntegrated ? (
              <div className="space-y-2 text-sm">
                <Badge variant="warning">Auth not integrated</Badge>
                <p>
                  {response?.meta.migrationNote ||
                    "Sessions are not issued yet. The bootstrap workspace runs as owner."}
                </p>
                <p className="text-muted-foreground">
                  Migration: implement session cookies in getAuthContext, set
                  User.businessId / defaultStoreId / role on registration, then
                  user create/list APIs become active. Permissions are already
                  enforced on settings and billing APIs via TenantContext.role.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {response.data.map((user) => (
                      <TableRow key={user._id}>
                        <TableCell>{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell className="capitalize">{user.role}</TableCell>
                        <TableCell>
                          {user.isActive ? (
                            <Badge variant="success">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!response.data.length ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="py-8 text-center text-muted-foreground"
                        >
                          No users yet.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SettingsShell>
  );
}
