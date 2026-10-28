import { variants as catalogVariants, type Variant } from "@brotasites/catalog";
import {
  CompositionRejected,
  composeDirections,
  DeterministicEngine,
  type Direction,
  type DirectionsRequest,
  type DirectionsResponse,
  type EngineInput,
  type EngineProvider,
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
  sourceTexts,
  specificsOf,
} from "./copy.js";
import { delimit } from "./data.js";
import { draftCopy } from "./draft.js";
import { checkFacts } from "./facts.js";
import { type Caller, LimitReached, MemoryUsageStore, SpendingGuard } from "./limits.js";
import { type AiTask, type ModelClient, ModelError } from "./model.js";
import { playbookFor } from "./playbooks.js";
import { costOf } from "./prices.js";
import {
  ART_DIRECTOR_PROMPT_VERSION,
  artDirectorSystem,
  COPY_PROMPT_VERSION,
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

  /** One model call, its cost recorded; the parsed answer or the problems with it. */
  private async ask<T>(
    task: AiTask,
    siteId: string,
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
    await this.guard.record(costUsd);
    this.emit({ type: "model-call", task, siteId, model: response.model, costUsd });
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
    });
    let schema: ReturnType<typeof compositionSchema> | undefined;
    try {
      schema = compositionSchema(input, this.variants);
    } catch {
      // The catalog has nothing this site can use: only the engine can say why.
      schema = undefined;
    }

    type Answer = z.infer<ReturnType<typeof compositionSchema>>;
    const tryCompose = (value: Answer) =>
      composeDirections(input, this.variants, choicesOf(value), neighbors);

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
      const basePrompt = this.directionsPrompt(input);
      let problems: string[] = [];
      for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
        const answer = await this.ask(
          "art-director",
          siteId,
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
      const result = await this.engine.generateDirections({ siteId, input });
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

  private directionsPrompt(input: EngineInput): string {
    const { name, city, category, family, feelings, brandColors, hasLogo, photos, round } = input;
    return `Propose the 3 art directions for this site (round ${round}).

<catalog>
${JSON.stringify(catalogMenu(input, this.variants))}
</catalog>

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

    const review = (copy: Copy): { config?: SiteConfig; problems: string[] } => {
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
        promptVersion: COPY_PROMPT_VERSION,
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

    const key = cacheKey({
      task: "copy",
      notes,
      model: this.modelId,
      prompt: COPY_PROMPT_VERSION,
      playbook: playbook.version,
      input,
    });
    const cached = (await this.cache.get(key)) as Copy | undefined;
    if (cached) {
      const result = review(cached);
      if (result.config) {
        this.emit({ type: "cache-hit", task: "copy", siteId: caller.siteId });
        return { config: result.config, source: "ai", costUsd: 0, warnings: [] };
      }
    }

    const warnings: string[] = [];
    const skipped = await this.admitted("copy", caller);
    if (!skipped) {
      const system = copySystem(playbook.text);
      const reviewerNotes =
        notes.length > 0
          ? `\n\nA reviewer read the current version. Address these points:\n${notes.map((note) => `- ${note}`).join("\n")}`
          : "";
      const basePrompt = `Rewrite the text of this site. Sections in page order: ${input.pageOrder.join(", ")}.${reviewerNotes}\n\n${delimit(input)}`;
      let problems: string[] = [];
      for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
        const answer = await this.ask(
          "copy",
          caller.siteId,
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
            return { config: result.config, source: "ai", costUsd, warnings };
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
    return { config: valid.data, source: "engine", costUsd, warnings };
  }
}
