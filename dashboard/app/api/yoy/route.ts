import { indicatorParam, jsonResponse } from "@/lib/http";
import { getYoy } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return jsonResponse(() => getYoy(indicatorParam(request)));
}
