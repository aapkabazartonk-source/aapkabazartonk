"use client";

import { useMemo } from "react";
import { Bell, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserMenu } from "@/components/layout/user-menu";

interface TopbarProps {
  onMenuClick: () => void;
}

function getGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function SmilingFace() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="animate-smile-bob h-11 w-11 shrink-0 text-foreground"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" className="fill-purple" />
      <circle
        cx="9"
        cy="10"
        r="1.25"
        className="animate-smile-blink fill-foreground"
      />
      <circle
        cx="15"
        cy="10"
        r="1.25"
        className="animate-smile-blink fill-foreground"
        style={{ animationDelay: "0.08s" }}
      />
      <path
        d="M9.5 15c1.8 1.8 5.2 1.8 7 0"
        className="animate-smile-widen stroke-foreground"
        strokeWidth="1.7"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const greeting = useMemo(() => getGreeting(), []);

  return (
    <header className="sticky top-0 z-30 flex h-[72px] items-center gap-3 border-b border-border bg-card px-4 sm:px-6">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="rounded-full lg:hidden"
        onClick={onMenuClick}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="hidden min-w-0 md:flex md:items-center md:gap-3">
        <SmilingFace />
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {greeting}
          </p>
          <p className="truncate text-base font-semibold tracking-tight text-foreground">
            Welcome back, Aditya
          </p>
        </div>
      </div>

      <div className="relative mx-auto hidden w-full max-w-md flex-1 lg:block">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search products, orders, customers..."
          className="h-11 rounded-full border-border bg-background pl-10 shadow-none"
          aria-label="Global search"
        />
      </div>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-full lg:hidden"
          aria-label="Search"
        >
          <Search className="h-5 w-5" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative rounded-full bg-background hover:bg-muted"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5 text-foreground/80" />
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-purple px-1 text-[10px] font-semibold text-purple-foreground">
            3
          </span>
        </Button>

        <UserMenu />
      </div>
    </header>
  );
}
