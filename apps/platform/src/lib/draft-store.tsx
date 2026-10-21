"use client";

import { type FormStepSlug, formSteps, type SiteDraft } from "@brotasites/schema";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  chooseDraft,
  fetchRemoteDraft,
  isEmptyDraft,
  pushRemoteDraft,
  type StoredDraft,
} from "./draft-sync";
import { getBrowserSupabase } from "./supabase/client";

// The draft is always autosaved on the device (localStorage). When the person is signed in,
// every save also goes to their account, so the draft follows them to other devices.

const STORAGE_KEY = "brotasites:rascunho:v1";
const SAVE_DELAY_MS = 400;

export type SaveState = "idle" | "saving" | "saved" | "failed" | "account-failed";

export interface Account {
  /** "unknown" until the session has been checked. */
  status: "unknown" | "signed-out" | "signed-in";
  email?: string;
}

interface DraftContextValue extends StoredDraft {
  /** False until the saved draft has been read, so the form does not flash empty values. */
  ready: boolean;
  saveState: SaveState;
  account: Account;
  updateDraft: (update: (draft: SiteDraft) => SiteDraft) => void;
  completeStep: (slug: FormStepSlug) => void;
  /** Steps the client may open: every finished step plus the next one. */
  isReachable: (slug: FormStepSlug) => boolean;
}

const DraftContext = createContext<DraftContextValue | null>(null);
const EMPTY: StoredDraft = { draft: {}, completed: [], updatedAt: 0 };

function readStored(): StoredDraft {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredDraft>;
      return {
        draft: parsed.draft ?? {},
        completed: parsed.completed ?? [],
        updatedAt: parsed.updatedAt ?? 0,
      };
    }
  } catch {
    // Private mode or corrupted data: start fresh.
  }
  return EMPTY;
}

function writeStored(state: StoredDraft): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function DraftProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StoredDraft>(EMPTY);
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [account, setAccount] = useState<Account>({ status: "unknown" });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const loaded = useRef(false);
  const siteId = useRef<string | null>(null);
  const latest = useRef(state);
  latest.current = state;

  // Read the device copy, then the account copy when signed in, and keep the right one.
  useEffect(() => {
    const local = readStored();
    setState(local);
    setReady(true);

    const supabase = getBrowserSupabase();
    if (!supabase) {
      setAccount({ status: "signed-out" });
      return;
    }
    let cancelled = false;
    supabase.auth.getClaims().then(async ({ data }) => {
      const claims = data?.claims;
      if (cancelled) return;
      if (!claims) {
        setAccount({ status: "signed-out" });
        return;
      }
      setAccount({ status: "signed-in", email: claims.email as string | undefined });
      try {
        const remote = await fetchRemoteDraft(supabase);
        if (cancelled) return;
        siteId.current = remote?.siteId ?? null;
        if (chooseDraft(latest.current, remote) === "remote" && remote) {
          const adopted = {
            draft: remote.draft,
            completed: remote.completed,
            updatedAt: remote.updatedAt,
          };
          writeStored(adopted);
          loaded.current = false; // adopting the account copy is not a new edit
          setState(adopted);
        } else if (!isEmptyDraft(latest.current)) {
          siteId.current = await pushRemoteDraft(supabase, siteId.current, latest.current);
        }
        setSaveState("saved");
      } catch {
        setSaveState("account-failed");
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        siteId.current = null;
        setAccount({ status: "signed-out" });
      } else if (session?.user) {
        setAccount({ status: "signed-in", email: session.user.email });
      }
    });
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Autosave after a short pause: device first, then the account.
  useEffect(() => {
    if (!ready) return;
    // Skip the run that only reflects a draft just loaded from storage or the account.
    if (!loaded.current) {
      loaded.current = true;
      return;
    }
    setSaveState("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (!writeStored(state)) {
        setSaveState("failed");
        return;
      }
      const supabase = getBrowserSupabase();
      if (!supabase || account.status !== "signed-in") {
        setSaveState("saved");
        return;
      }
      try {
        siteId.current = await pushRemoteDraft(supabase, siteId.current, state);
        setSaveState("saved");
      } catch {
        setSaveState("account-failed");
      }
    }, SAVE_DELAY_MS);
    return () => clearTimeout(saveTimer.current);
  }, [state, ready, account.status]);

  // Leaving or reloading the page right after typing must not lose the last answer.
  useEffect(() => {
    if (!ready) return;
    const flush = () => {
      if (loaded.current) writeStored(latest.current);
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [ready]);

  const updateDraft = useCallback((update: (draft: SiteDraft) => SiteDraft) => {
    setState((current) => ({ ...current, draft: update(current.draft), updatedAt: Date.now() }));
  }, []);

  const completeStep = useCallback((slug: FormStepSlug) => {
    setState((current) =>
      current.completed.includes(slug)
        ? current
        : { ...current, completed: [...current.completed, slug], updatedAt: Date.now() },
    );
  }, []);

  const value = useMemo<DraftContextValue>(() => {
    const firstOpen = formSteps.findIndex((step) => !state.completed.includes(step.slug));
    const lastReachable = firstOpen === -1 ? formSteps.length - 1 : firstOpen;
    return {
      ...state,
      ready,
      saveState,
      account,
      updateDraft,
      completeStep,
      isReachable: (slug) =>
        state.completed.includes(slug) ||
        formSteps.findIndex((step) => step.slug === slug) <= lastReachable,
    };
  }, [state, ready, saveState, account, updateDraft, completeStep]);

  return <DraftContext value={value}>{children}</DraftContext>;
}

export function useDraft(): DraftContextValue {
  const context = useContext(DraftContext);
  if (!context) throw new Error("useDraft must be used inside <DraftProvider>.");
  return context;
}
