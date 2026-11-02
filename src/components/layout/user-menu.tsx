"use client";

import Link from "next/link";
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

export function UserMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="group flex h-11 items-center gap-2.5 rounded-full border border-border bg-background pl-1.5 pr-3 transition-colors hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-muted/80"
        >
          <Avatar className="h-8 w-8 ring-2 ring-purple-soft">
            <AvatarFallback className="bg-purple text-xs font-semibold tracking-wide text-purple-foreground">
              AD
            </AvatarFallback>
          </Avatar>
          <div className="hidden min-w-0 text-left sm:block">
            <p className="truncate text-sm font-semibold leading-tight tracking-tight text-foreground">
              Aditya
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
            <span>Aditya Sharma</span>
            <span className="text-xs font-normal text-muted-foreground">
              aditya@aapkabazar.com
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings">
            <User className="h-4 w-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings">
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/login">
            <LogOut className="h-4 w-4" />
            Sign out
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
