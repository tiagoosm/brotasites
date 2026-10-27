import { personalities } from "@brotasites/schema/v1.2";

// The 5 personalities of docs/art-direction.md, owned by schema 1.2.
export { personalities };
export type Personality = (typeof personalities)[number];
