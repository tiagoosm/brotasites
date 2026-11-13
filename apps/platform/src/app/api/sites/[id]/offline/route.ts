import { ownerTakedown } from "@/lib/server/takedown-routes";

// E42: the owner takes their published site offline (reversible).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return ownerTakedown(request, (await params).id, "offline");
}
