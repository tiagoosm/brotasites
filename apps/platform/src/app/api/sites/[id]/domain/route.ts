import { z } from "zod";
import { hosts } from "@/lib/domains/hosts";
import { domainContext, domainError, flowOff, json } from "@/lib/server/domain-route";
import { currentDomain, requestDomain } from "@/lib/server/domains";
import { readBody } from "@/lib/server/guard";

// The client's own domain of one site (E25). GET: where it stands. POST: connect one (the site
// must be paid; the domain is checked here and proved by the hosting before it serves anything).

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await domainContext(request, id, false);
  if ("error" in context) return context.error;
  try {
    const { domain, paid } = await currentDomain(context.db, id, context.owned.user.id);
    return json({ domain, paid, available: context.provider !== null });
  } catch (error) {
    return domainError(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = await readBody(request, z.object({ host: z.string().max(300) }).strict());
  if ("error" in body) return body.error;
  const { id } = await params;
  const context = await domainContext(request, id);
  if ("error" in context) return context.error;
  if (!context.provider) return flowOff();
  try {
    const domain = await requestDomain(context.db, context.provider, {
      siteId: id,
      userId: context.owned.user.id,
      raw: body.data.host,
      baseDomain: hosts.sitesDomain,
    });
    return json({ domain }, 201);
  } catch (error) {
    return domainError(error);
  }
}
