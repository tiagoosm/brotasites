import { variants as catalogVariants, type Variant } from "@brotasites/catalog";
import type { Family } from "@brotasites/schema/v1.2";
import { type Direction, drawDirections } from "./directions.js";
import type { EngineInput } from "./input.js";
import type { UniquenessRegistry } from "./registry.js";
import type { CatalogWeights } from "./weights.js";

// The engine behind an interface, so the platform can call it the same way it will call the AI
// art director (`AiProvider`, E8), and fall back to it when the AI fails.

export interface DirectionsRequest {
  siteId: string;
  input: EngineInput;
  /** The admin's catalog decisions (recommended and retired), applied to the draw. */
  weights?: CatalogWeights;
}

export interface DirectionsResponse {
  seed: string;
  directions: Direction[];
  warnings: string[];
}

export interface EngineProvider {
  generateDirections(request: DirectionsRequest): Promise<DirectionsResponse>;
  /** Records the approved direction in the uniqueness registry. */
  recordApproved(siteId: string, family: Family, city: string, direction: Direction): Promise<void>;
}

export class DeterministicEngine implements EngineProvider {
  constructor(
    private readonly registry: UniquenessRegistry,
    private readonly variants: readonly Variant[] = catalogVariants,
  ) {}

  async generateDirections({
    siteId,
    input,
    weights,
  }: DirectionsRequest): Promise<DirectionsResponse> {
    const neighbors = await this.registry.near(input.family, input.city, siteId);
    return drawDirections(
      input,
      this.variants,
      neighbors.map((item) => item.features),
      weights,
    );
  }

  async recordApproved(
    siteId: string,
    family: Family,
    city: string,
    direction: Direction,
  ): Promise<void> {
    await this.registry.record({
      siteId,
      family,
      city,
      fingerprint: direction.identity.fingerprint,
      features: direction.features,
    });
  }
}
