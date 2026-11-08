import { exportFile } from "@/lib/export";
import { fileResponse } from "@/lib/http";
import { ParameterError } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ dataset: string }> }) {
  return fileResponse(async () => {
    const search = new URL(request.url).searchParams;
    for (const name of ["format", "indicator", "country"]) {
      if (search.getAll(name).length > 1) throw new ParameterError(`Provide one ${name}${name === "format" ? "" : " code"}`);
    }
    for (const [name, value] of search) {
      if (!["format", "indicator", "country"].includes(name)) throw new ParameterError(`Unknown parameter ${name}`);
      if (value === "") throw new ParameterError(name === "format" ? "Format must be csv or parquet" : `Provide one ${name} code`);
    }
    const { dataset } = await params;
    return exportFile(dataset, search.get("format") ?? "csv", { indicator: search.get("indicator") ?? undefined, country: search.get("country") ?? undefined });
  });
}
