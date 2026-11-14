import { ownerWithdraw } from "@/lib/server/takedown-routes";

// E43: the owner withdraws within 7 days of paying (direito de arrependimento).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return ownerWithdraw(request, (await params).id);
}
