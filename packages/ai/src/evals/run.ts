// pnpm --filter @brotasites/ai eval            simulated model, no API call
// AI_MODE=live AI_MODEL_ID=... ANTHROPIC_API_KEY=... pnpm --filter @brotasites/ai eval
// Prints the metrics of the 30 businesses; --json prints the whole report.
import { modelFromEnv } from "../index.js";
import { evaluate } from "./evaluate.js";

const report = await evaluate(modelFromEnv(process.env));
if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const { summary } = report;
  console.log(`Evaluation of ${report.cases.length} businesses, model: ${report.model}`);
  console.table(summary);
}
