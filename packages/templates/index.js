import { fileURLToPath } from "node:url";

/** Absolute path of the Astro project that renders the templates. */
export const templatesRoot = fileURLToPath(new URL(".", import.meta.url));

/** Templates that are implemented and can be generated. */
export const availableTemplates = ["classico"];
