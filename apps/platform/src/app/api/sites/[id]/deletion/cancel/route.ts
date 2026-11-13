import { ownerTakedown } from "@/lib/server/takedown-routes";

// E42: the owner cancels the deletion they scheduled; the site stays offline until they put it
// back. A POST (not DELETE): every state-changing route goes through readBody's checks.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return ownerTakedown(request, (await params).id, "cancel");
}
