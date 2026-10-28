// The promotion cycle's numbers (docs/catalog-promotion.md, Metrics): per composition and per
// variant, how often it was suggested, chosen among the 3, approved on the finished site, asked
// to change, what the reviewer found, what the admins decided and how long the review took.
// Pure, so it is tested without a database; the admin route feeds it the rows.

export interface DirectionRow {
  id: string;
  site_id: string;
  composition_key: string | null;
  identity: { heroVariant?: string; sectionVariants?: Record<string, string> };
}
export interface SiteRow {
  id: string;
  approved_direction: string | null;
  approved_at: string | null;
}
export interface ReportRow {
  site_id: string;
  report: { findings?: { severity?: string }[] };
}
export interface DecisionRow {
  site_id: string;
  action: string;
  created_at: string;
}
export interface EventRow {
  site_id: string;
  kind: string;
  created_at: string;
}

export interface Metrics {
  suggested: number;
  chosen: number;
  approved: number;
  changeRequests: number;
  findings: { low: number; medium: number; high: number };
  decisions: number;
  /** Average hours from the finished site to the admin's approval, or null. */
  reviewHours: number | null;
}

export interface CatalogMetrics {
  compositions: (Metrics & { key: string })[];
  variants: (Metrics & { id: string })[];
}

const empty = (): Metrics => ({
  suggested: 0,
  chosen: 0,
  approved: 0,
  changeRequests: 0,
  findings: { low: 0, medium: 0, high: 0 },
  decisions: 0,
  reviewHours: null,
});

function variantsOf(direction: DirectionRow): string[] {
  const { heroVariant, sectionVariants = {} } = direction.identity ?? {};
  return [heroVariant, ...Object.values(sectionVariants)].filter((id): id is string => !!id);
}

export function catalogMetrics(rows: {
  directions: DirectionRow[];
  sites: SiteRow[];
  reports: ReportRow[];
  decisions: DecisionRow[];
  events: EventRow[];
}): CatalogMetrics {
  const byKey = new Map<string, Metrics>();
  const byVariant = new Map<string, Metrics>();
  const reviewTimes = new Map<Metrics, number[]>();
  const at = <K>(map: Map<K, Metrics>, key: K) => {
    const found = map.get(key);
    if (found) return found;
    const metrics = empty();
    map.set(key, metrics);
    return metrics;
  };
  // Everything a site went through counts for the composition and variants it approved.
  const targets = (direction: DirectionRow): Metrics[] => [
    ...(direction.composition_key ? [at(byKey, direction.composition_key)] : []),
    ...variantsOf(direction).map((id) => at(byVariant, id)),
  ];

  for (const direction of rows.directions) {
    for (const metrics of targets(direction)) metrics.suggested++;
  }
  const directionById = new Map(rows.directions.map((direction) => [direction.id, direction]));
  for (const site of rows.sites) {
    const direction = site.approved_direction
      ? directionById.get(site.approved_direction)
      : undefined;
    if (!direction) continue;
    const metrics = targets(direction);
    const reports = rows.reports.filter((report) => report.site_id === site.id);
    const decisions = rows.decisions.filter((decision) => decision.site_id === site.id);
    const events = rows.events.filter((event) => event.site_id === site.id);
    const changes =
      decisions.filter((decision) => decision.action === "request_changes").length +
      events.filter((event) => event.kind === "rebuild_requested").length;
    const findings = reports.flatMap((report) => report.report?.findings ?? []);
    // Review time: each finished build to the next approval by an admin.
    const hours: number[] = [];
    for (const built of events.filter((event) => event.kind === "site_built")) {
      const approval = decisions
        .filter(
          (decision) => decision.action === "approve" && decision.created_at >= built.created_at,
        )
        .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
      if (approval) {
        hours.push((Date.parse(approval.created_at) - Date.parse(built.created_at)) / 3_600_000);
      }
    }
    for (const item of metrics) {
      item.chosen++;
      if (site.approved_at) item.approved++;
      item.changeRequests += changes;
      item.decisions += decisions.length;
      for (const finding of findings) {
        if (
          finding.severity === "low" ||
          finding.severity === "medium" ||
          finding.severity === "high"
        ) {
          item.findings[finding.severity]++;
        }
      }
      reviewTimes.set(item, [...(reviewTimes.get(item) ?? []), ...hours]);
    }
  }
  for (const [metrics, hours] of reviewTimes) {
    if (hours.length > 0) {
      metrics.reviewHours = Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 10) / 10;
    }
  }
  const order = (a: Metrics, b: Metrics) => b.chosen - a.chosen || b.suggested - a.suggested;
  return {
    compositions: [...byKey].map(([key, metrics]) => ({ key, ...metrics })).sort(order),
    variants: [...byVariant].map(([id, metrics]) => ({ id, ...metrics })).sort(order),
  };
}
