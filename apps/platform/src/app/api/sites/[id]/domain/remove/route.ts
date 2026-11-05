import { z } from "zod";
import { domainContext, domainError, json } from "@/lib/server/domain-route";
import { currentDomain, hostingKv, removeDomain } from "@/lib/server/domains";
import { readBody } from "@/lib/server/guard";

// Removing the own domain (E25), after a confirmation: the record first, then KV and the
// hosting, so the domain never keeps pointing at the site.

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = await readBody(request, z.object({ confirm: z.literal(true) }).strict());
  if ("error" in body) return body.error;
  const { id } = await params;
  const context = await domainContext(request, id);
  if ("error" in context) return context.error;
  try {
    const { subdomain } = await currentDomain(context.db, id, context.owned.user.id);
    await removeDomain(context.db, context.provider, hostingKv, {
      siteId: id,
      userId: context.owned.user.id,
      subdomain,
    });
    return json({ removed: true });
  } catch (error) {
    return domainError(error);
  }
}
