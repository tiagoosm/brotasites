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

// The draft lives in the browser for now (autosaved to localStorage). It moves to Supabase
// once login exists, keeping the same shape.

const STORAGE_KEY = "brotasites:rascunho:v1";
const SAVE_DELAY_MS = 400;

interface StoredDraft {
  draft: SiteDraft;
  completed: FormStepSlug[];
}

export type SaveState = "idle" | "saving" | "saved" | "failed";

interface DraftContextValue extends StoredDraft {
  /** False until the saved draft has been read, so the form does not flash empty values. */
  ready: boolean;
  saveState: SaveState;
  updateDraft: (update: (draft: SiteDraft) => SiteDraft) => void;
  completeStep: (slug: FormStepSlug) => void;
  /** Steps the client may open: every finished step plus the next one. */
  isReachable: (slug: FormStepSlug) => boolean;
}

const DraftContext = createContext<DraftContextValue | null>(null);

function readStored(): StoredDraft {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredDraft>;
      return { draft: parsed.draft ?? {}, completed: parsed.completed ?? [] };
    }
  } catch {
    // Private mode or corrupted data: start fresh.
  }
  return { draft: {}, completed: [] };
}

export function DraftProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StoredDraft>({ draft: {}, completed: [] });
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const loaded = useRef(false);

  useEffect(() => {
    setState(readStored());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    // The first run only reflects what was just read from storage.
    if (!loaded.current) {
      loaded.current = true;
      return;
    }
    setSaveState("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        setSaveState("saved");
      } catch {
        // Storage full or blocked: the draft still works for this visit.
        setSaveState("failed");
      }
    }, SAVE_DELAY_MS);
    return () => clearTimeout(saveTimer.current);
  }, [state, ready]);

  // Leaving or reloading the page right after typing must not lose the last answer.
  const latest = useRef(state);
  latest.current = state;
  useEffect(() => {
    if (!ready) return;
    const flush = () => {
      if (!loaded.current) return;
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(latest.current));
      } catch {
        // Nothing else to do while the page goes away.
      }
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [ready]);

  const updateDraft = useCallback((update: (draft: SiteDraft) => SiteDraft) => {
    setState((current) => ({ ...current, draft: update(current.draft) }));
  }, []);

  const completeStep = useCallback((slug: FormStepSlug) => {
    setState((current) =>
      current.completed.includes(slug)
        ? current
        : { ...current, completed: [...current.completed, slug] },
    );
  }, []);

  const value = useMemo<DraftContextValue>(() => {
    const firstOpen = formSteps.findIndex((step) => !state.completed.includes(step.slug));
    const lastReachable = firstOpen === -1 ? formSteps.length - 1 : firstOpen;
    return {
      ...state,
      ready,
      saveState,
      updateDraft,
      completeStep,
      isReachable: (slug) =>
        state.completed.includes(slug) ||
        formSteps.findIndex((step) => step.slug === slug) <= lastReachable,
    };
  }, [state, ready, saveState, updateDraft, completeStep]);

  return <DraftContext value={value}>{children}</DraftContext>;
}

export function useDraft(): DraftContextValue {
  const context = useContext(DraftContext);
  if (!context) throw new Error("useDraft must be used inside <DraftProvider>.");
  return context;
}
