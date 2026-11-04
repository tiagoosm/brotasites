import { adminErrors, requireAdmin, teamRpcError } from "@/lib/server/admin";
import { json, refuse } from "@/lib/server/guard";

// Team panel, accounts (E24): search, filters, order and pages, in the database. The search
// travels in the query string of the team's own request; nothing personal is put in the page's
// address bar (the page sends it with fetch).
const FILTERS = ["", "confirmed", "open", "paid", "limit"];
const SORTS = ["", "recent", "oldest", "cost", "email"];
const PAGE_SIZE = 20;

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if ("error" in admin) return admin.error;
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim().slice(0, 120);
  const filter = params.get("filter") ?? "";
  const sort = params.get("sort") ?? "";
  const page = Math.max(0, Math.min(5000, Number.parseInt(params.get("page") ?? "0", 10) || 0));
  if (!FILTERS.includes(filter) || !SORTS.includes(sort)) {
    return refuse(400, adminErrors.badRequest);
  }
  const { data, error } = await admin.session.rpc("admin_accounts", {
    p_query: query,
    p_filter: filter,
    p_sort: sort,
    p_limit: PAGE_SIZE,
    p_offset: page * PAGE_SIZE,
  });
  if (error) return teamRpcError(error.message);
  return json({ ...(data as object), page, pageSize: PAGE_SIZE });
}
