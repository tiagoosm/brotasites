// Writes docs/site-config.schema.json from the built Zod schema. Run `pnpm json-schema`.
import { writeFileSync } from "node:fs";
import { siteConfigJsonSchema } from "../dist/v1.2/index.js";

const target = new URL("../../../docs/site-config.schema.json", import.meta.url);
writeFileSync(target, `${JSON.stringify(siteConfigJsonSchema(), null, 2)}\n`);
console.log("Wrote docs/site-config.schema.json");
