import type { AnswerKey, Origin } from "./assemble.js";

// The blind test's results (docs/blind-test.md). Target: people do not tell the generated site
// apart above chance (a one-sided binomial test at 5%), and the generated site is preferred in at
// least half of the pairs (a pair counts when most of its participants preferred it).

export type Profile = "negocio" | "designer" | "outro";

export interface Answer {
  participant: string;
  profile: Profile;
  pair: number;
  /** The site the participant thinks AI made. */
  ai: "A" | "B";
  prefers: "A" | "B";
}

export interface Tally {
  judgments: number;
  /** Times the participant pointed at the generated site as the AI one. */
  spotted: number;
  accuracy: number;
  /** One-sided binomial p-value of spotting it this often by chance. */
  pValue: number;
  /** Times the generated site was preferred. */
  preferred: number;
  preferenceShare: number;
}

export interface PairResult extends Tally {
  pair: number;
  name: string;
  /** Most participants preferred the generated site in this pair. */
  won: boolean;
}

export interface Score {
  participants: number;
  overall: Tally;
  byProfile: Partial<Record<Profile, Tally>>;
  pairs: PairResult[];
  pairsWon: number;
  /** Nobody told them apart above chance. */
  atChance: boolean;
  /** The generated site preferred in at least half of the pairs. */
  preferredEnough: boolean;
  passed: boolean;
}

const profiles: Record<string, Profile> = {
  negocio: "negocio",
  negócio: "negocio",
  dono: "negocio",
  designer: "designer",
  outro: "outro",
};

/** Reads the facilitator's spreadsheet: participante;perfil;par;ia;prefere (or commas). */
export function parseAnswers(csv: string): { answers: Answer[]; errors: string[] } {
  const lines = csv.replace(/^﻿/, "").split(/\r?\n/);
  const header = lines[0] ?? "";
  const delimiter = header.includes(";") ? ";" : ",";
  const answers: Answer[] = [];
  const errors: string[] = [];
  lines.slice(1).forEach((line, index) => {
    if (!line.trim()) return;
    const row = index + 2;
    const [participant, profile, pair, ai, prefers] = line
      .split(delimiter)
      .map((cell) => cell.trim());
    const side = (value: string | undefined) => {
      const upper = value?.toUpperCase();
      return upper === "A" || upper === "B" ? upper : null;
    };
    const parsed = {
      participant,
      profile: profiles[(profile ?? "").toLowerCase()],
      pair: Number(pair),
      ai: side(ai),
      prefers: side(prefers),
    };
    if (!parsed.participant) errors.push(`Linha ${row}: falta o participante.`);
    else if (!parsed.profile)
      errors.push(`Linha ${row}: perfil deve ser negocio, designer ou outro.`);
    else if (!Number.isInteger(parsed.pair) || parsed.pair < 1)
      errors.push(`Linha ${row}: par inválido.`);
    else if (!parsed.ai || !parsed.prefers)
      errors.push(`Linha ${row}: ia e prefere devem ser A ou B.`);
    else answers.push(parsed as Answer);
  });
  return { answers, errors };
}

/** P(X >= k) for X ~ Binomial(n, 1/2). */
export function binomialTail(k: number, n: number): number {
  if (k <= 0) return 1;
  if (k > n) return 0;
  // log of n choose i, built up term by term.
  let logChoose = 0;
  let total = 0;
  for (let i = 0; i <= n; i++) {
    if (i > 0) logChoose += Math.log(n - i + 1) - Math.log(i);
    if (i >= k) total += Math.exp(logChoose - n * Math.LN2);
  }
  return Math.min(1, total);
}

function tally(list: { spotted: boolean; preferred: boolean }[]): Tally {
  const judgments = list.length;
  const spotted = list.filter((item) => item.spotted).length;
  const preferred = list.filter((item) => item.preferred).length;
  return {
    judgments,
    spotted,
    accuracy: judgments ? spotted / judgments : 0,
    pValue: binomialTail(spotted, judgments),
    preferred,
    preferenceShare: judgments ? preferred / judgments : 0,
  };
}

export function scoreAnswers(key: AnswerKey, answers: Answer[]): Score {
  const generatedSide = new Map<number, "A" | "B">(
    key.pairs.map((pair) => [
      pair.pair,
      (pair.a.origin === ("brotasites" as Origin) ? "A" : "B") as "A" | "B",
    ]),
  );
  const judged = answers.flatMap((answer) => {
    const side = generatedSide.get(answer.pair);
    if (!side) return [];
    return [{ ...answer, spotted: answer.ai === side, preferred: answer.prefers === side }];
  });
  const byProfile: Score["byProfile"] = {};
  for (const profile of ["negocio", "designer", "outro"] as const) {
    const list = judged.filter((item) => item.profile === profile);
    if (list.length) byProfile[profile] = tally(list);
  }
  const pairs = key.pairs.map((pair) => {
    const result = tally(judged.filter((item) => item.pair === pair.pair));
    return {
      ...result,
      pair: pair.pair,
      name: pair.name,
      won: result.preferred * 2 > result.judgments,
    };
  });
  const overall = tally(judged);
  const pairsWon = pairs.filter((pair) => pair.won).length;
  const atChance = overall.judgments > 0 && overall.pValue >= 0.05;
  const preferredEnough = pairsWon * 2 >= key.pairs.length;
  return {
    participants: new Set(judged.map((item) => item.participant)).size,
    overall,
    byProfile,
    pairs,
    pairsWon,
    atChance,
    preferredEnough,
    passed: atChance && preferredEnough,
  };
}

const percent = (value: number) => `${(value * 100).toFixed(0)}%`;

/** The report the CLI prints (pt-BR, for the owner). */
export function formatScore(score: Score): string {
  const lines = [
    `Participantes: ${score.participants}; respostas: ${score.overall.judgments}.`,
    `Acertaram qual era o site gerado em ${percent(score.overall.accuracy)} (p = ${score.overall.pValue.toFixed(3)}; o acaso dá 50%).`,
    `Preferiram o site gerado em ${percent(score.overall.preferenceShare)} das respostas e em ${score.pairsWon} de ${score.pairs.length} pares.`,
    "",
    "Por perfil:",
  ];
  for (const [profile, value] of Object.entries(score.byProfile)) {
    lines.push(
      `  ${profile}: acerto ${percent(value.accuracy)} (p = ${value.pValue.toFixed(3)}), preferência ${percent(value.preferenceShare)}, ${value.judgments} respostas`,
    );
  }
  lines.push("", "Por par:");
  for (const pair of score.pairs) {
    lines.push(
      `  ${pair.pair}. ${pair.name}: acerto ${percent(pair.accuracy)}, preferência ${percent(pair.preferenceShare)} (${pair.judgments} respostas)${pair.won ? "" : " (perdeu)"}`,
    );
  }
  lines.push(
    "",
    `Não distinguem acima do acaso: ${score.atChance ? "sim" : "não"}.`,
    `Preferem o gerado em pelo menos metade dos pares: ${score.preferredEnough ? "sim" : "não"}.`,
    score.passed
      ? "Meta atingida."
      : "Meta não atingida: veja o que fazer em docs/blind-test.md (catálogo, playbooks e revisor) e repita.",
  );
  return lines.join("\n");
}
