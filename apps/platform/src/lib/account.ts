"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getBrowserSupabase } from "./supabase/client";

// Pages that need an account (the form and "Meus sites") check the session in the browser and
// send people to sign in, coming back to the same page afterwards.

export type AccountState =
  | { status: "checking" }
  | { status: "unavailable" }
  | { status: "signed-in"; userId: string; email?: string };

export function useRequiredAccount(): AccountState {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<AccountState>({ status: "checking" });

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setState({ status: "unavailable" });
      return;
    }
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      if (!data.user) {
        const back = `${pathname}${window.location.search}`;
        router.replace(`/entrar?voltar=${encodeURIComponent(back)}`);
        return;
      }
      setState({ status: "signed-in", userId: data.user.id, email: data.user.email });
    });
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return state;
}
