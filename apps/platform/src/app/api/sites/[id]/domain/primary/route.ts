import { z } from "zod";
import { domainContext, domainError, json } from "@/lib/server/domain-route";
import { currentDomain, hostingKv, setPrimary } from "@/lib/server/domains";
import { readBody } from "@/lib/server/guard";

// The main address (E25): the own domain, or the BrotaSites address. The other one redirects.

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = await readBody(request, z.object({ primary: z.boolean() }).strict());
  if ("error" in body) return body.error;
  const { id } = await params;
  const context = await domainContext(request, id);
  if ("error" in context) return context.error;
  try {
    const { subdomain } = await currentDomain(context.db, id, context.owned.user.id);
    const domain = await setPrimary(context.db, hostingKv, {
      siteId: id,
      userId: context.owned.user.id,
      primary: body.data.primary,
      subdomain,
    });
    return json({ domain });
  } catch (error) {
    return domainError(error);
  }
}
