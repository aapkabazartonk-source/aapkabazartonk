"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { redirectToLogin } from "@/lib/auth-client";

export type OwnerSession = {
  id: string;
  name: string;
  ownerDisplayName: string;
  email: string;
  role: string;
  avatarUrl: string;
};

type OwnerSessionContextValue = {
  owner: OwnerSession | null;
  displayName: string;
  loading: boolean;
  setDisplayName: (name: string) => void;
  refresh: () => Promise<void>;
};

const OwnerSessionContext = createContext<OwnerSessionContextValue | null>(
  null,
);

export function OwnerSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [owner, setOwner] = useState<OwnerSession | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "same-origin",
      });
      if (!response.ok) {
        setOwner(null);
        setDisplayName("");
        if (response.status === 401) {
          redirectToLogin();
        }
        return;
      }
      const payload = (await response.json()) as {
        data?: Partial<OwnerSession> & { id?: string };
      };
      const data = payload.data;
      if (!data?.id) {
        setOwner(null);
        setDisplayName("");
        return;
      }

      const next: OwnerSession = {
        id: String(data.id),
        name: String(data.name ?? ""),
        ownerDisplayName: String(
          data.ownerDisplayName || data.name || "",
        ).trim(),
        email: String(data.email ?? ""),
        role: String(data.role ?? "owner"),
        avatarUrl: String(data.avatarUrl ?? ""),
      };
      setOwner(next);
      setDisplayName(next.ownerDisplayName || next.name || "Store Owner");
    } catch {
      /* ignore — proxy forces login when session is gone */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    function onOwnerNameUpdated(event: Event) {
      const custom = event as CustomEvent<string>;
      const next = custom.detail?.trim();
      if (next) {
        setDisplayName(next);
        setOwner((current) =>
          current ? { ...current, ownerDisplayName: next } : current,
        );
        return;
      }
      void refresh();
    }

    window.addEventListener("owner-name-updated", onOwnerNameUpdated);
    return () => {
      window.removeEventListener("owner-name-updated", onOwnerNameUpdated);
    };
  }, [refresh]);

  const value = useMemo(
    () => ({
      owner,
      displayName: displayName || owner?.name || "Store Owner",
      loading,
      setDisplayName,
      refresh,
    }),
    [owner, displayName, loading, refresh],
  );

  return (
    <OwnerSessionContext.Provider value={value}>
      {children}
    </OwnerSessionContext.Provider>
  );
}

export function useOwnerSession() {
  const context = useContext(OwnerSessionContext);
  if (!context) {
    throw new Error("useOwnerSession must be used within OwnerSessionProvider");
  }
  return context;
}
