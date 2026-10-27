import type { Family } from "@brotasites/schema/v1.2";
import type { DesignFeatures } from "./features.js";
import { normalizeText } from "./input.js";

// The uniqueness registry: designs already given to sites, so two businesses of the same family
// in the same city never look alike. Drafts count too. This step keeps it in memory; the
// platform stores it in a Supabase table (E10) behind the same interface.

export interface DesignSignature {
  siteId: string;
  family: Family;
  city: string;
  fingerprint: string;
  features: DesignFeatures;
}

export interface UniquenessRegistry {
  /** Designs of other sites of the same family in the same city. */
  near(family: Family, city: string, exceptSiteId?: string): Promise<DesignSignature[]>;
  /** Records (or replaces) the design of a site. */
  record(signature: DesignSignature): Promise<void>;
  remove(siteId: string): Promise<void>;
}

export class MemoryRegistry implements UniquenessRegistry {
  private readonly bySite = new Map<string, DesignSignature>();

  async near(family: Family, city: string, exceptSiteId?: string): Promise<DesignSignature[]> {
    const place = normalizeText(city);
    return [...this.bySite.values()].filter(
      (item) =>
        item.family === family &&
        normalizeText(item.city) === place &&
        item.siteId !== exceptSiteId,
    );
  }

  async record(signature: DesignSignature): Promise<void> {
    this.bySite.set(signature.siteId, signature);
  }

  async remove(siteId: string): Promise<void> {
    this.bySite.delete(siteId);
  }
}
