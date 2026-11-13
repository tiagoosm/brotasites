import { ownerTakedown } from "@/lib/server/takedown-routes";

// E42: the owner schedules their site's deletion (the address typed to confirm). The site goes
// offline now and is deleted after limits.deletionWaitDays, unless they cancel.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return ownerTakedown(request, (await params).id, "schedule");
}
