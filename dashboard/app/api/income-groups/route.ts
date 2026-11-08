import { indicatorParam, jsonResponse } from "@/lib/http";
import { getIncomeGroups } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return jsonResponse(() => getIncomeGroups(indicatorParam(request)));
}
