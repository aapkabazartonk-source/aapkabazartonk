"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Menu, Search } from "lucide-react";
import { useOwnerSession } from "@/components/layout/owner-session";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";

const GlobalSearch = dynamic(
  () =>
    import("@/components/layout/global-search").then(
      (module) => module.GlobalSearch,
    ),
  { ssr: false },
);

interface TopbarProps {
  onMenuClick: () => void;
}

function getGreeting(date: Date) {
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
        className="animate-smile-blink fill-white"
      />
      <circle
        cx="15"
        cy="10"
        r="1.25"
        className="animate-smile-blink fill-white"
        style={{ animationDelay: "0.08s" }}
      />
      <path
        d="M9.5 15c1.8 1.8 5.2 1.8 7 0"
        className="animate-smile-widen stroke-white"
        strokeWidth="1.7"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function firstName(fullName: string) {
  const part = fullName.trim().split(/\s+/).filter(Boolean)[0];
  return part || "";
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { displayName } = useOwnerSession();
  const [greeting, setGreeting] = useState("Welcome");
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    setGreeting(getGreeting(new Date()));
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const welcomeName = firstName(displayName);

  return (
    <>
      <header className="sticky top-2 z-30 mx-2 mt-2 flex h-[72px] items-center gap-3 rounded-2xl border border-border bg-card px-4 shadow-[var(--shadow-sm)] sm:px-6">
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
              {welcomeName ? `Welcome back, ${welcomeName}` : "Welcome back"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="relative mx-auto hidden h-11 w-full max-w-md flex-1 items-center rounded-full border border-border bg-background pl-10 pr-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/60 lg:flex"
          aria-label="Open search"
        >
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <span className="truncate">Search products, orders...</span>
          <kbd className="ml-auto hidden rounded-md border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground xl:inline-block">
            Ctrl K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-full lg:hidden"
            aria-label="Search"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-5 w-5" />
          </Button>

          <UserMenu />
        </div>
      </header>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
