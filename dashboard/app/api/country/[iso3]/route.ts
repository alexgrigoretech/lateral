import { jsonResponse } from "@/lib/http";
import { getCountry } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ iso3: string }> }) {
  const { iso3 } = await params;
  return jsonResponse(() => getCountry(iso3));
}
