import { jsonResponse } from "@/lib/http";
import { getHealth } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return jsonResponse(getHealth);
}
