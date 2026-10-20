// Opening hours: parses the free-form pt-BR rows from the form ("Seg a Sex" / "06:00 - 19:00")
// into a weekly schedule, and tells whether the business is open at a given moment.
// Parsing is deliberately strict: anything it cannot fully understand returns null, so the
// site never shows a wrong "open now" status.

/** Minutes since midnight, [start, end). */
export type Range = [number, number];

/** Index 0 = Sunday. `null` means the day is not listed in the opening hours. */
export type WeekSchedule = Array<Range[] | null>;

export interface OpeningHoursRow {
  days: string;
  hours: string;
}

export interface ParsedRow {
  days: number[];
  ranges: Range[];
}

const MINUTES_PER_DAY = 24 * 60;

const dayIndex: Record<string, number> = {
  dom: 0,
  domingo: 0,
  seg: 1,
  segunda: 1,
  ter: 2,
  terca: 2,
  qua: 3,
  quarta: 3,
  qui: 4,
  quinta: 4,
  sex: 5,
  sexta: 5,
  sab: 6,
  sabado: 6,
};

const dayGroups: Record<string, number[]> = {
  "todos os dias": [0, 1, 2, 3, 4, 5, 6],
  "todo dia": [0, 1, 2, 3, 4, 5, 6],
  diariamente: [0, 1, 2, 3, 4, 5, 6],
  "dias uteis": [1, 2, 3, 4, 5],
  "dias de semana": [1, 2, 3, 4, 5],
  "fim de semana": [6, 0],
  "fins de semana": [6, 0],
};

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/-feira/g, "")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDay(token: string): number | undefined {
  return dayIndex[token.trim()];
}

/** "Seg a Sex", "Sábado", "Seg, Qua e Sex", "Todos os dias". Returns null if not understood. */
export function parseDays(text: string): number[] | null {
  const value = normalize(text);
  const group = dayGroups[value];
  if (group) return group;

  const days = new Set<number>();
  for (const part of value.split(/\s*(?:,|\be\b)\s*/).filter(Boolean)) {
    // "a"/"até" need spaces around them, or "sabado" would read as "s a bado".
    const range =
      part.match(/^(\S+?)\s*[-–]\s*(\S+)$/) ?? part.match(/^(\S+)\s+(?:a|ate)\s+(\S+)$/);
    if (range) {
      const from = parseDay(range[1] ?? "");
      const to = parseDay(range[2] ?? "");
      if (from === undefined || to === undefined) return null;
      // Ranges may wrap around the week ("Sex a Seg").
      for (let day = from; ; day = (day + 1) % 7) {
        days.add(day);
        if (day === to) break;
      }
      continue;
    }
    const day = parseDay(part);
    if (day === undefined) return null;
    days.add(day);
  }
  return days.size ? [...days] : null;
}

const timeToken = /(\d{1,2})\s*(?::|h)\s*(\d{2})|(\d{1,2})\s*h\b|(\d{1,2}):?(\d{2})?/g;

/** "06:00 - 19:00", "6h às 12h e 14h às 18h", "Fechado", "24 horas". Returns null if not understood. */
export function parseHours(text: string): Range[] | null {
  const value = normalize(text);
  if (value === "fechado") return [];
  if (value === "24 horas" || value === "24h" || value === "aberto 24 horas") {
    return [[0, MINUTES_PER_DAY]];
  }

  const minutes: number[] = [];
  for (const match of value.matchAll(timeToken)) {
    const hour = Number(match[1] ?? match[3] ?? match[4]);
    const minute = Number(match[2] ?? match[5] ?? 0);
    if (hour > 24 || minute > 59 || (hour === 24 && minute > 0)) return null;
    minutes.push(hour * 60 + minute);
  }

  // Everything that is not a time must be a known separator word.
  const leftover = value
    .replace(timeToken, " ")
    .replace(/\b(das|de|as|a|ate|e)\b|[-–—,/]/g, " ")
    .trim();
  if (leftover || minutes.length === 0 || minutes.length % 2 !== 0) return null;

  const ranges: Range[] = [];
  for (let i = 0; i < minutes.length; i += 2) {
    const start = minutes[i] as number;
    const end = minutes[i + 1] as number;
    if (start === end) return null;
    ranges.push([start, end]);
  }
  return ranges;
}

/** Parses every row, or returns null when any row cannot be understood. */
export function parseOpeningHours(rows: OpeningHoursRow[] | undefined): ParsedRow[] | null {
  if (!rows?.length) return null;
  const parsed: ParsedRow[] = [];
  for (const row of rows) {
    // Holidays do not map to weekdays; they are shown in the table but ignored here.
    if (normalize(row.days).includes("feriado")) continue;
    const days = parseDays(row.days);
    const ranges = parseHours(row.hours);
    if (!days || !ranges) return null;
    parsed.push({ days, ranges });
  }
  return parsed.length ? parsed : null;
}

/** Builds the weekly schedule. Ranges that cross midnight continue on the next day. */
export function buildWeek(rows: ParsedRow[]): WeekSchedule {
  const week: WeekSchedule = Array.from({ length: 7 }, () => null);
  const add = (day: number, range: Range) => {
    const ranges = week[day] ?? [];
    ranges.push(range);
    week[day] = ranges;
  };
  for (const { days, ranges } of rows) {
    for (const day of days) {
      week[day] ??= [];
      for (const [start, end] of ranges) {
        if (end > start) {
          add(day, [start, end]);
        } else {
          add(day, [start, MINUTES_PER_DAY]);
          if (end > 0) add((day + 1) % 7, [0, end]);
        }
      }
    }
  }
  for (const ranges of week) ranges?.sort((a, b) => a[0] - b[0]);
  return week;
}

const weekdayNames = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export function formatTime(minutes: number): string {
  const value = minutes % MINUTES_PER_DAY;
  const h = String(Math.floor(value / 60)).padStart(2, "0");
  const m = String(value % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export interface OpenStatus {
  open: boolean;
  /** "Aberto agora" / "Fechado agora" */
  label: string;
  /** "Fecha às 19:00" / "Abre amanhã às 06:00" */
  detail: string;
}

/** Status at a given weekday (0 = Sunday) and minute of the day, or null when unknown. */
export function statusAt(week: WeekSchedule, weekday: number, minute: number): OpenStatus | null {
  const today = week[weekday];
  if (!today) return null;

  const current = today.find(([start, end]) => start <= minute && minute < end);
  if (current) {
    // Follow ranges that continue past midnight.
    let closesAt = current[1];
    let day = weekday;
    let offset = 0;
    while (closesAt === MINUTES_PER_DAY && offset < 7) {
      day = (day + 1) % 7;
      offset += 1;
      const next = week[day]?.find(([start]) => start === 0);
      if (!next) break;
      closesAt = next[1];
    }
    if (offset >= 7) return { open: true, label: "Aberto agora", detail: "Aberto 24 horas" };
    return { open: true, label: "Aberto agora", detail: `Fecha às ${formatTime(closesAt)}` };
  }

  for (let offset = 0; offset < 7; offset++) {
    const day = (weekday + offset) % 7;
    const ranges = week[day];
    if (!ranges) return null;
    const next = ranges.find(([start]) => offset > 0 || start > minute);
    if (next) {
      const when = offset === 0 ? "hoje" : offset === 1 ? "amanhã" : weekdayNames[day];
      return {
        open: false,
        label: "Fechado agora",
        detail: `Abre ${when} às ${formatTime(next[0])}`,
      };
    }
  }
  return null;
}

// Brazilian states outside Brasília time.
const stateTimeZones: Record<string, string> = {
  AC: "America/Rio_Branco",
  AM: "America/Manaus",
  RR: "America/Boa_Vista",
  RO: "America/Porto_Velho",
  MT: "America/Cuiaba",
  MS: "America/Campo_Grande",
};

export function timeZoneForState(state: string | undefined): string {
  return (state && stateTimeZones[state.toUpperCase()]) ?? "America/Sao_Paulo";
}

/** Weekday (0 = Sunday) and minute of the day for an instant in a time zone. */
export function localTime(date: Date, timeZone: string): { weekday: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { weekday, minute: Number(get("hour")) * 60 + Number(get("minute")) };
}
