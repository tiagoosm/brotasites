import { z } from "zod";
import { domainContext, domainError, flowOff, json } from "@/lib/server/domain-route";
import { checkDomainNow, currentDomain, hostingKv, providerIdOf } from "@/lib/server/domains";
import { readBody, refuse } from "@/lib/server/guard";

// "Verificar agora" (E25): asks the hosting where the domain stands, within the limits.

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = await readBody(request, z.object({}).strict());
  if ("error" in body) return body.error;
  const { id } = await params;
  const context = await domainContext(request, id);
  if ("error" in context) return context.error;
  if (!context.provider) return flowOff();
  try {
    const { domain, subdomain } = await currentDomain(context.db, id, context.owned.user.id);
    if (!domain) return refuse(404, "Este site não tem domínio próprio conectado.");
    const providerId = await providerIdOf(context.db, domain.id);
    if (!providerId)
      return refuse(409, "O domínio ainda está sendo registrado. Tente de novo em instantes.");
    const saved = await checkDomainNow(
      context.db,
      context.provider,
      hostingKv,
      domain,
      subdomain,
      providerId,
    );
    return json({ domain: saved });
  } catch (error) {
    return domainError(error);
  }
}
