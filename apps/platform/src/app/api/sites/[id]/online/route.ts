import { ownerTakedown } from "@/lib/server/takedown-routes";

// E42: the owner puts the site they took offline back on the air.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return ownerTakedown(request, (await params).id, "online");
}
