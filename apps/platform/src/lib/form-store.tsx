"use client";

import { type FormDraft, type FormStepSlug12, formSteps12 } from "@brotasites/schema/v1.2";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { designOpen } from "./site-status";
import { loadSite, type SiteRow, saveDraft } from "./sites";
import { getBrowserSupabase } from "./supabase/client";

// The answers of one site (docs/form-flow.md): signing in comes first, and every change is
// saved in the account after a short pause, with a copy on the device in case the network
// fails. Steps that shape the design lock once a direction is approved.

const SAVE_DELAY_MS = 500;
const storageKey = (siteId: string) => `brotasites:rascunho12:${siteId}`;

export type SaveState = "idle" | "saving" | "saved" | "failed";

export interface FormAccount {
  userId: string;
  email?: string;
}

interface FormContextValue {
  siteId: string;
  account: FormAccount;
  site: SiteRow | null;
  draft: FormDraft;
  completed: FormStepSlug12[];
  ready: boolean;
  /** The site is not in this account (or does not exist). */
  missing: boolean;
  saveState: SaveState;
  /** A direction was approved: the identity is locked and only content changes. */
  identityLocked: boolean;
  /** The design is being drawn or built: answers wait until it finishes. */
  busy: boolean;
  updateDraft: (update: (draft: FormDraft) => FormDraft) => void;
  completeStep: (slug: FormStepSlug12) => void;
  isReachable: (slug: FormStepSlug12) => boolean;
  reloadSite: () => Promise<void>;
}

const FormContext = createContext<FormContextValue | null>(null);

function readLocal(
  siteId: string,
): { draft: FormDraft; completed: FormStepSlug12[]; updatedAt: number } | null {
  try {
    const raw = window.localStorage.getItem(storageKey(siteId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLocal(
  siteId: string,
  value: { draft: FormDraft; completed: FormStepSlug12[]; updatedAt: number },
) {
  try {
    window.localStorage.setItem(storageKey(siteId), JSON.stringify(value));
  } catch {
    // Private mode: the account copy is enough.
  }
}

export function FormProvider({
  siteId,
  account,
  children,
}: {
  siteId: string;
  account: FormAccount;
  children: React.ReactNode;
}) {
  const [site, setSite] = useState<SiteRow | null>(null);
  const [draft, setDraft] = useState<FormDraft>({});
  const [completed, setCompleted] = useState<FormStepSlug12[]>([]);
  const [ready, setReady] = useState(false);
  const [missing, setMissing] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef({ draft, completed });
  latest.current = { draft, completed };

  /** Reads the site's status again (after sending answers or choosing a direction). */
  const reloadSite = useCallback(async () => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const loaded = await loadSite(supabase, siteId).catch(() => null);
    if (!loaded) return;
    const { draft: _draft, completed: _completed, ...row } = loaded;
    setSite(row);
  }, [siteId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getBrowserSupabase();
      if (!supabase) return;
      const loaded = await loadSite(supabase, siteId).catch(() => null);
      if (cancelled) return;
      if (!loaded) {
        setMissing(true);
        setReady(true);
        return;
      }
      const { draft: remoteDraft, completed: remoteCompleted, ...row } = loaded;
      setSite(row);
      // A device copy newer than the account's is an edit that did not reach the account.
      const local = readLocal(siteId);
      const useLocal = local && local.updatedAt > Date.parse(row.updated_at);
      setDraft(useLocal ? local.draft : remoteDraft);
      setCompleted((useLocal ? local.completed : remoteCompleted) as FormStepSlug12[]);
      if (useLocal) dirty.current = true;
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [siteId]);

  // Autosave: device right away, account after a short pause.
  useEffect(() => {
    if (!ready || !dirty.current) return;
    writeLocal(siteId, { draft, completed, updatedAt: Date.now() });
    setSaveState("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const supabase = getBrowserSupabase();
      if (!supabase) return;
      try {
        await saveDraft(supabase, siteId, latest.current.draft, latest.current.completed);
        setSaveState("saved");
      } catch {
        setSaveState("failed");
      }
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer.current);
  }, [draft, completed, ready, siteId]);

  const updateDraft = useCallback((update: (current: FormDraft) => FormDraft) => {
    dirty.current = true;
    setDraft((current) => update(current));
  }, []);

  const completeStep = useCallback((slug: FormStepSlug12) => {
    dirty.current = true;
    setCompleted((current) => (current.includes(slug) ? current : [...current, slug]));
  }, []);

  const value = useMemo<FormContextValue>(() => {
    const firstOpen = formSteps12.findIndex((step) => !completed.includes(step.slug));
    const lastReachable = firstOpen === -1 ? formSteps12.length - 1 : firstOpen;
    const status = site?.status ?? "draft";
    return {
      siteId,
      account,
      site,
      draft,
      completed,
      ready,
      missing,
      saveState,
      identityLocked: Boolean(site?.approved_direction),
      busy:
        !designOpen.includes(status) &&
        !["awaiting_approval", "live", "in_review"].includes(status),
      updateDraft,
      completeStep,
      isReachable: (slug) =>
        completed.includes(slug) ||
        formSteps12.findIndex((step) => step.slug === slug) <= lastReachable,
      reloadSite,
    };
  }, [
    siteId,
    account,
    site,
    draft,
    completed,
    ready,
    missing,
    saveState,
    updateDraft,
    completeStep,
    reloadSite,
  ]);

  return <FormContext value={value}>{children}</FormContext>;
}

export function useForm12(): FormContextValue {
  const context = useContext(FormContext);
  if (!context) throw new Error("useForm12 must be used inside <FormProvider>.");
  return context;
}
