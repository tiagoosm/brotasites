import { z } from "zod";
import { siteConfigSchema } from "./site-config.js";

/**
 * JSON Schema of the 1.2 config (what the client sends), generated from Zod. Rules that tie
 * fields together (contact channel, address, contrast, locks) only exist in Zod.
 */
export function siteConfigJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(siteConfigSchema, { io: "input", target: "draft-2020-12" }),
    title: "BrotaSites site configuration 1.2",
  };
}
