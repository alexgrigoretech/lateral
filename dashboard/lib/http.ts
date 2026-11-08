import { ParameterError } from "./queries";

export async function jsonResponse(payload: () => Promise<unknown>): Promise<Response> {
  try {
    return Response.json(await payload(), { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
  } catch (error) {
    if (error instanceof ParameterError) return Response.json({ error: error.message }, { status: 400 });
    console.error("Dashboard query failed", error);
    return Response.json({ error: "The reporting data could not be read. Try again later." }, { status: 500 });
  }
}

export function indicatorParam(request: Request): string {
  const values = new URL(request.url).searchParams.getAll("indicator");
  if (values.length !== 1 || !values[0]) throw new ParameterError("Provide one indicator code");
  return values[0];
}
