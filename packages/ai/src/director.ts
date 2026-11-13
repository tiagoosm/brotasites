import { variants as catalogVariants, type Variant } from "@brotasites/catalog";
import {
  activeVariants,
  type CatalogWeights,
  CompositionRejected,
  composeDirections,
  DeterministicEngine,
  type Direction,
  type DirectionsRequest,
  type DirectionsResponse,
  type EngineInput,
  type EngineProvider,
  NO_WEIGHTS,
  type UniquenessRegistry,
} from "@brotasites/engine";
import { type Family, type SiteConfig, siteConfigSchema } from "@brotasites/schema/v1.2";
import type { z } from "zod";
import { outputSchema } from "./anthropic.js";
import { type AiCache, cacheKey, MemoryCache } from "./cache.js";
import { catalogMenu, choicesOf, compositionSchema } from "./composition.js";
import {
  applyCopy,
  type Copy,
  copyFields,
  copyInputFrom,
  copySchema,
  isThin,
  sourceTexts,
  specificsOf,
} from "./copy.js";
import { delimit } from "./data.js";
import { draftCopy } from "./draft.js";
import { checkFacts } from "./facts.js";
import {
  type Caller,
  LimitReached,
  MemoryUsageStore,
  type MeteredTask,
  type ModelCall,
  SpendingGuard,
} from "./limits.js";
import { type AiTask, type ModelClient, ModelError } from "./model.js";
import { playbookFor } from "./playbooks.js";
import { costOf } from "./prices.js";
import {
  ART_DIRECTOR_PROMPT_VERSION,
  artDirectorSystem,
  COPY_EDITOR_PROMPT_VERSION,
  COPY_PROMPT_VERSION,
  copyEditorSystem,
  copySystem,
  retryNote,
} from "./prompts.js";
import { checkStyle } from "./style.js";

// The AI provider (docs/ai-and-reviewer.md). It speaks the engine's interface, so the platform
// calls it the same way, and it never leaves a client without a result:
//   AI answer -> validated -> checked by the engine (or the fact and style checks);
//   failed -> one retry, told why -> failed again -> the engine alone;
//   the engine fails too -> NeedsAttention: the site goes to "needs attention" and the admin
//   is alerted (the caller does both, E10/E11).
// Limits, the daily budget and the cache sit in front of every model call.

/** Neither the AI nor the engine produced a usable result. The message is for the admin. */
export class NeedsAttention extends Error {}

export type AiEvent =
  | { type: "model-call"; task: AiTask; siteId: string; model: string; costUsd: number }
  | { type: "rejected"; task: AiTask; siteId: string; attempt: number; problems: string[] }
  | { type: "fallback"; task: AiTask; siteId: string; reason: string }
  | { type: "cache-hit"; task: AiTask; siteId: string };

export interface AiDirectorOptions {
  model: ModelClient;
  registry: UniquenessRegistry;
  variants?: readonly Variant[];
  cache?: AiCache;
  guard?: SpendingGuard;
  onEvent?: (event: AiEvent) => void;
  /** E41: the editor's second pass on the copy (AI_COPY_EDITOR; on unless "false"). */
  copyEditor?: boolean;
}

export interface AiDirectionsRequest extends DirectionsRequest {
  /** The client's account, for the per-account limit; the site's id when omitted. */
  accountId?: string;
}

export interface AiDirectionsResponse extends DirectionsResponse {
  source: "ai" | "engine";
  costUsd: number;
}

export interface CopyResult {
  config: SiteConfig;
  source: "ai" | "engine";
  costUsd: number;
  warnings: string[];
  /**
   * E41, the editor's second pass: "applied" (its text is the site's), "discarded" (it broke a
   * check, the writer's text stays), "failed" (no usable answer), "off" (simulated, disabled,
   * or no AI text to edit).
   */
  editor: "applied" | "discarded" | "failed" | "off";
  /** E41: the client gave little to write from; the text is lean on purpose. */
  thin: boolean;
  /** E41: when the editor's text was used, how much it changed. */
  editStats?: { changedFields: number; lengthBefore: number; lengthAfter: number };
}

/** The editor may tighten the text, never stretch it: at most this much longer overall. */
const EDITOR_GROWTH = 1.1;

function editStats(before: Copy, after: Copy): NonNullable<CopyResult["editStats"]> {
  const a = copyFields(before);
  const b = copyFields(after);
  const length = (fields: Record<string, string>) =>
    Object.values(fields).reduce((sum, value) => sum + value.length, 0);
  return {
    changedFields: Object.keys(b).filter((field) => a[field] !== b[field]).length,
    lengthBefore: length(a),
    lengthAfter: length(b),
  };
}

/** True when the edited text is not longer than the draft (10% and 20 characters of slack). */
export function editorGrowthOk(
  before: Record<string, string>,
  after: Record<string, string>,
): boolean {
  const length = (fields: Record<string, string>) =>
    Object.values(fields).reduce((sum, value) => sum + value.length, 0);
  return length(after) <= length(before) * EDITOR_GROWTH + 20;
}

const ATTEMPTS = 2;

export class AiDirector implements EngineProvider {
  private readonly engine: DeterministicEngine;
  private readonly variants: readonly Variant[];
  private readonly cache: AiCache;
  private readonly guard: SpendingGuard;
  private readonly emit: (event: AiEvent) => void;

  constructor(private readonly options: AiDirectorOptions) {
    this.variants = options.variants ?? catalogVariants;
    this.engine = new DeterministicEngine(options.registry, this.variants);
    this.cache = options.cache ?? new MemoryCache();
    this.guard = options.guard ?? new SpendingGuard(new MemoryUsageStore());
    this.emit = options.onEvent ?? (() => {});
  }

  get modelId(): string {
    return this.options.model.modelId;
  }

  /**
   * A model call made outside the director (the reviewer agent), for the cost log only: it does
   * not count in the daily budget, as before (E24 keeps the AI's limits as they were).
   */
  async logCall(call: ModelCall): Promise<void> {
    await this.guard.logCall(call);
  }

  /** One model call, its cost recorded; the parsed answer or the problems with it. */
  private async ask<T>(
    task: AiTask,
    meter: { task: MeteredTask; caller: Caller },
    schema: z.ZodType<T>,
    system: string,
    prompt: string,
    payload: unknown,
    maxTokens: number,
  ): Promise<{ value?: T; problems: string[]; costUsd: number }> {
    const jsonSchema = outputSchema(schema);
    let response: Awaited<ReturnType<ModelClient["complete"]>>;
    try {
      response = await this.options.model.complete({
        task,
        system,
        prompt,
        schema: jsonSchema,
        maxTokens,
        payload,
      });
    } catch (error) {
      if (error instanceof ModelError) return { problems: [error.message], costUsd: 0 };
      throw error;
    }
    const costUsd = costOf(response.model, response.usage);
    await this.guard.record(costUsd, {
      task: meter.task,
      model: response.model,
      usage: response.usage,
      costUsd,
      siteId: meter.caller.siteId,
      accountId: meter.caller.accountId,
    });
    this.emit({
      type: "model-call",
      task,
      siteId: meter.caller.siteId,
      model: response.model,
      costUsd,
    });
    let json: unknown;
    try {
      json = JSON.parse(response.text);
    } catch {
      return { problems: ["the answer is not valid JSON"], costUsd };
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return {
        problems: parsed.error.issues
          .slice(0, 20)
          .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`),
        costUsd,
      };
    }
    return { value: parsed.data, problems: [], costUsd };
  }

  private async admitted(task: AiTask, caller: Caller): Promise<string | undefined> {
    try {
      await this.guard.admit(task, caller);
      return undefined;
    } catch (error) {
      if (error instanceof LimitReached) return error.message;
      throw error;
    }
  }

  async generateDirections(request: AiDirectionsRequest): Promise<AiDirectionsResponse> {
    const { siteId, input } = request;
    // The admin's catalog decisions: retired variants are not offered at all.
    const weights = request.weights ?? NO_WEIGHTS;
    const variants = activeVariants(this.variants, weights);
    const weighted =
      Object.keys(weights.compositions).length + Object.keys(weights.variants).length > 0;
    const caller = { siteId, accountId: request.accountId ?? siteId };
    const neighbors = (await this.options.registry.near(input.family, input.city, siteId)).map(
      (item) => item.features,
    );
    let costUsd = 0;
    const key = cacheKey({
      task: "art-director",
      model: this.modelId,
      prompt: ART_DIRECTOR_PROMPT_VERSION,
      input,
      ...(weighted ? { weights } : {}),
    });
    let schema: ReturnType<typeof compositionSchema> | undefined;
    try {
      schema = compositionSchema(input, variants);
    } catch {
      // The catalog has nothing this site can use: only the engine can say why.
      schema = undefined;
    }

    type Answer = z.infer<ReturnType<typeof compositionSchema>>;
    const tryCompose = (value: Answer) =>
      composeDirections(input, this.variants, choicesOf(value), neighbors, weights);

    const cached = schema ? ((await this.cache.get(key)) as Answer | undefined) : undefined;
    if (cached) {
      try {
        const result = tryCompose(cached);
        this.emit({ type: "cache-hit", task: "art-director", siteId });
        return { ...result, source: "ai", costUsd: 0 };
      } catch (error) {
        if (!(error instanceof CompositionRejected)) throw error;
        // A neighbor appeared since: ask again.
      }
    }

    const skipped = schema
      ? await this.admitted("art-director", caller)
      : "O catálogo não tem variantes para este site.";
    if (schema && !skipped) {
      const basePrompt = this.directionsPrompt(input, variants, weights);
      let problems: string[] = [];
      for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
        const answer = await this.ask(
          "art-director",
          { task: "directions", caller },
          schema,
          artDirectorSystem,
          problems.length > 0 ? basePrompt + retryNote(problems) : basePrompt,
          { task: "art-director", input },
          8000,
        );
        costUsd += answer.costUsd;
        problems = answer.problems;
        if (answer.value) {
          try {
            const result = tryCompose(answer.value);
            await this.cache.set(key, answer.value);
            return { ...result, source: "ai", costUsd };
          } catch (error) {
            if (!(error instanceof CompositionRejected)) throw error;
            problems = error.reasons;
          }
        }
        this.emit({ type: "rejected", task: "art-director", siteId, attempt, problems });
      }
      this.emit({
        type: "fallback",
        task: "art-director",
        siteId,
        reason: `rejected twice: ${problems.slice(0, 3).join("; ")}`,
      });
    } else {
      this.emit({ type: "fallback", task: "art-director", siteId, reason: skipped ?? "" });
    }

    try {
      const result = await this.engine.generateDirections({ siteId, input, weights });
      return {
        ...result,
        warnings: [...result.warnings, "Direções feitas só pelo motor (a IA não foi usada)."],
        source: "engine",
        costUsd,
      };
    } catch (error) {
      throw new NeedsAttention(
        `Nem a IA nem o motor conseguiram gerar as direções: ${(error as Error).message}`,
      );
    }
  }

  private directionsPrompt(
    input: EngineInput,
    variants: readonly Variant[],
    weights: CatalogWeights,
  ): string {
    const { name, city, category, family, feelings, brandColors, hasLogo, photos, round } = input;
    const recommended = weights.recommended.filter((choices) => choices.heroVariant);
    const advice =
      recommended.length > 0
        ? `
<recommended>
${JSON.stringify(recommended)}
</recommended>
Compositions that clients approved often. Fiel à marca or Evolução may reuse one when it suits this business; Contraste always explores something else.
`
        : "";
    return `Propose the 3 art directions for this site (round ${round}).

<catalog>
${JSON.stringify(catalogMenu(input, variants))}
</catalog>
${advice}
${delimit({ name, city, category, family, feelings, brandColors, hasLogo, photos })}`;
  }

  recordApproved(
    siteId: string,
    family: Family,
    city: string,
    direction: Direction,
  ): Promise<void> {
    return this.engine.recordApproved(siteId, family, city, direction);
  }

  /**
   * Rewrites the site's text; the client's own text when the AI cannot be used. `notes` are
   * the reviewer's findings to address (our own text, never the client's).
   */
  async writeCopy(
    config: SiteConfig,
    caller: Caller,
    options: { notes?: string[] } = {},
  ): Promise<CopyResult> {
    const notes = (options.notes ?? []).slice(0, 20);
    const input = copyInputFrom(config);
    const playbook = playbookFor(config.business.family);
    const schema = copySchema(config) as unknown as z.ZodType<Copy>;
    const sources = { texts: sourceTexts(input) };
    const specifics = specificsOf(input);
    const heroFields = ["sections.hero.content.title", "sections.hero.content.subtitle"];
    let costUsd = 0;

    const thin = isThin(input);
    const review = (
      copy: Copy,
      promptVersion = COPY_PROMPT_VERSION,
    ): { config?: SiteConfig; problems: string[] } => {
      const fields = copyFields(copy);
      const problems = [
        ...checkFacts(fields, sources).map(
          (issue) => `${issue.field}: "${issue.value}" is not in the data (${issue.kind})`,
        ),
        ...checkStyle(fields, playbook.banned, specifics, heroFields).map((issue) =>
          issue.kind === "generic"
            ? "the hero names no concrete fact of this business"
            : `${issue.field}: ${issue.kind} "${issue.value}"`,
        ),
      ];
      if (problems.length > 0) return { problems };
      const next = applyCopy(config, copy, {
        promptVersion,
        playbookVersion: playbook.version,
        modelId: this.modelId,
      });
      const valid = siteConfigSchema.safeParse(next);
      if (!valid.success) {
        return {
          problems: valid.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
        };
      }
      return { config: valid.data, problems: [] };
    };

    // E41: the editor's pass over an accepted text. Its answer goes through the same checks,
    // plus a length check; on any problem the writer's text stays. Never blocks the site.
    const edited = async (
      writer: Copy,
      writerConfig: SiteConfig,
      spent: number,
    ): Promise<CopyResult> => {
      const kept = (editor: CopyResult["editor"], cost = spent): CopyResult => ({
        config: writerConfig,
        source: "ai",
        costUsd: cost,
        warnings,
        editor,
        thin,
      });
      if (this.options.copyEditor === false || this.modelId === "simulated") return kept("off");
      const version = `${COPY_PROMPT_VERSION}+${COPY_EDITOR_PROMPT_VERSION}`;
      const accept = (copy: Copy): SiteConfig | undefined => {
        const result = review(copy, version);
        if (!result.config) return undefined;
        return editorGrowthOk(copyFields(writer), copyFields(copy)) ? result.config : undefined;
      };
      const editKey = cacheKey({
        task: "copy-editor",
        model: this.modelId,
        prompt: COPY_EDITOR_PROMPT_VERSION,
        playbook: playbook.version,
        input,
        draft: writer,
      });
      const cachedEdit = (await this.cache.get(editKey)) as Copy | undefined;
      if (cachedEdit) {
        const config = accept(cachedEdit);
        if (config) return { ...kept("applied"), config, editStats: editStats(writer, cachedEdit) };
      }
      if (await this.admitted("copy", caller)) return kept("off");
      const answer = await this.ask(
        "copy",
        // Metered with the copy it belongs to (ai_calls has no separate task for it).
        { task: notes.length > 0 ? "rewrite" : "copy", caller },
        schema,
        copyEditorSystem(playbook.text),
        `Edit this draft. Sections in page order: ${input.pageOrder.join(", ")}.${thin ? " The data is thin: keep the text short." : ""}\n\n<draft>\n${JSON.stringify(writer)}\n</draft>\n\n${delimit(input)}`,
        { task: "copy-editor", copy: writer },
        16000,
      );
      const cost = spent + answer.costUsd;
      if (!answer.value) {
        this.emit({
          type: "rejected",
          task: "copy",
          siteId: caller.siteId,
          attempt: 0,
          problems: ["editor", ...answer.problems],
        });
        return kept("failed", cost);
      }
      const config = accept(answer.value);
      if (!config) {
        const problems = review(answer.value, version).problems;
        this.emit({
          type: "rejected",
          task: "copy",
          siteId: caller.siteId,
          attempt: 0,
          problems: ["editor", ...(problems.length > 0 ? problems : ["longer than the draft"])],
        });
        return kept("discarded", cost);
      }
      await this.cache.set(editKey, answer.value);
      return { ...kept("applied", cost), config, editStats: editStats(writer, answer.value) };
    };

    const key = cacheKey({
      task: "copy",
      notes,
      model: this.modelId,
      prompt: COPY_PROMPT_VERSION,
      playbook: playbook.version,
      input,
    });
    const warnings: string[] = [];
    const cached = (await this.cache.get(key)) as Copy | undefined;
    if (cached) {
      const result = review(cached);
      if (result.config) {
        this.emit({ type: "cache-hit", task: "copy", siteId: caller.siteId });
        return edited(cached, result.config, 0);
      }
    }

    const skipped = await this.admitted("copy", caller);
    if (!skipped) {
      const system = copySystem(playbook.text);
      const reviewerNotes =
        notes.length > 0
          ? `\n\nA reviewer read the current version. Address these points:\n${notes.map((note) => `- ${note}`).join("\n")}`
          : "";
      const thinNote = thin
        ? "\n\nThe data is thin: the client wrote little. Write less, in short sentences; never fill the space with generic claims."
        : "";
      const basePrompt = `Rewrite the text of this site. Sections in page order: ${input.pageOrder.join(", ")}.${reviewerNotes}${thinNote}\n\n${delimit(input)}`;
      let problems: string[] = [];
      for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
        const answer = await this.ask(
          "copy",
          // Copy redone with the reviewer's or the team's notes is a rewrite in the cost log.
          { task: notes.length > 0 ? "rewrite" : "copy", caller },
          schema,
          system,
          problems.length > 0 ? basePrompt + retryNote(problems) : basePrompt,
          { task: "copy", input },
          16000,
        );
        costUsd += answer.costUsd;
        problems = answer.problems;
        if (answer.value) {
          const result = review(answer.value);
          if (result.config) {
            await this.cache.set(key, answer.value);
            return edited(answer.value, result.config, costUsd);
          }
          problems = result.problems;
        }
        this.emit({ type: "rejected", task: "copy", siteId: caller.siteId, attempt, problems });
      }
      this.emit({
        type: "fallback",
        task: "copy",
        siteId: caller.siteId,
        reason: `rejected twice: ${problems.slice(0, 3).join("; ")}`,
      });
    } else {
      this.emit({ type: "fallback", task: "copy", siteId: caller.siteId, reason: skipped });
    }

    // The engine alone: the client's own text, checked like any answer.
    const draft = draftCopy(input);
    const next = applyCopy(config, draft, {
      promptVersion: COPY_PROMPT_VERSION,
      playbookVersion: playbook.version,
      modelId: "engine",
    });
    const valid = siteConfigSchema.safeParse(next);
    if (!valid.success) {
      throw new NeedsAttention(
        `Nem a IA nem o motor conseguiram montar os textos: ${valid.error.issues[0]?.path.join(".")} ${valid.error.issues[0]?.message ?? ""}`,
      );
    }
    warnings.push("Textos do próprio cliente (a IA não foi usada).");
    return { config: valid.data, source: "engine", costUsd, warnings, editor: "off", thin };
  }
}
