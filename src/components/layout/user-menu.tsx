"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LogOut, Settings, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type OwnerProfile = {
  id: string;
  name: string;
  email: string;
  role: string;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "OB";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function UserMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const [owner, setOwner] = useState<OwnerProfile | null>(null);
  const [ownerName, setOwnerName] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [meResponse, businessResponse] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/settings/business"),
        ]);

        let authName = "";
        if (meResponse.ok) {
          const payload = (await meResponse.json()) as { data?: OwnerProfile };
          if (!cancelled && payload.data) {
            setOwner(payload.data);
            authName = payload.data.name?.trim() || "";
          }
        }

        let profileName = "";
        if (businessResponse.ok) {
          const payload = (await businessResponse.json()) as {
            data?: { ownerName?: string };
          };
          profileName = payload.data?.ownerName?.trim() || "";
        }

        if (!cancelled) {
          setOwnerName(profileName || authName);
        }
      } catch {
        /* ignore — proxy will force login if session is gone */
      }
    }

    void load();

    function onOwnerNameUpdated(event: Event) {
      const custom = event as CustomEvent<string>;
      const next = custom.detail?.trim();
      if (next) setOwnerName(next);
      else void load();
    }

    window.addEventListener("owner-name-updated", onOwnerNameUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener("owner-name-updated", onOwnerNameUpdated);
    };
  }, [pathname]);

  function signOut() {
    startTransition(async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    });
  }

  const displayName = ownerName || owner?.name || "Store Owner";
  const displayEmail = owner?.email || "Signed in";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="group flex h-11 items-center gap-2.5 rounded-full border border-border bg-background pl-1.5 pr-3 transition-colors hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-muted/80"
        >
          <Avatar className="h-8 w-8 ring-2 ring-purple-soft">
            <AvatarFallback className="bg-purple text-xs font-semibold tracking-wide text-purple-foreground">
              {initials(displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="hidden min-w-0 text-left sm:block">
            <p className="truncate text-sm font-semibold leading-tight tracking-tight text-foreground">
              {displayName}
            </p>
            <p className="truncate text-[11px] leading-tight text-muted-foreground">
              Store Owner
            </p>
          </div>
          <ChevronDown className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180 sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-0.5">
            <span>{displayName}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {displayEmail}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings/business">
            <User className="h-4 w-4" />
            Business profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings/security">
            <Settings className="h-4 w-4" />
            Security
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={pending}
          onSelect={(event) => {
            event.preventDefault();
            signOut();
          }}
        >
          <LogOut className="h-4 w-4" />
          {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
