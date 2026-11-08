import assert from "node:assert/strict";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const indicator = "SP.POP.TOTL";
const routes = [
  ["/api/meta", ["latest_run", "counts", "indicators", "countries"]],
  ["/api/completeness", ["matrices", "completeness", "missing"]],
  [`/api/yoy?indicator=${indicator}`, ["rows"]],
  [`/api/latest?indicator=${indicator}`, ["comparison", "latest_available"]],
  [`/api/income-groups?indicator=${indicator}`, ["rows", "members"]],
  ["/api/country/USA", ["country", "facts", "yoy", "lineage"]],
  ["/api/health", ["ok", "duckdb", "files"]],
];

for (const [route, keys] of routes) {
  const response = await fetch(new URL(route, base));
  assert.equal(response.status, 200, `${route}: expected 200`);
  assert.equal(response.headers.get("cache-control"), "public, s-maxage=3600, stale-while-revalidate=86400");
  const body = await response.json();
  for (const key of keys) assert.ok(Object.hasOwn(body, key), `${route}: missing ${key}`);
  if (route === "/api/health") {
    assert.equal(body.ok, true);
    assert.equal(body.files, 10);
    assert.equal(typeof body.duckdb, "string");
  }
  if (route === "/api/meta") {
    for (const [key, value] of Object.entries(body.counts)) {
      if (key === "year_min" || key === "year_max") assert.ok(value === null || typeof value === "number");
      else assert.equal(typeof value, "number");
    }
    assert.ok(Object.hasOwn(body.counts, "year_min"));
    assert.ok(Object.hasOwn(body.counts, "year_max"));
    if (body.latest_run) {
      assert.match(body.latest_run.started_at, /^\d{4}-\d{2}-\d{2}T.*Z$/);
      if (body.latest_run.finished_at !== null) assert.match(body.latest_run.finished_at, /^\d{4}-\d{2}-\d{2}T.*Z$/);
    }
  }
  if (route.startsWith("/api/yoy")) {
    for (const row of body.rows) {
      if (row.yoy_status !== "ok") assert.equal(row.pct_change, null);
    }
  }
  console.log(`PASS 200 ${route} keys=${keys.join(",")}`);
  if (route === "/api/health") console.log(`DuckDB ${body.duckdb}, ${body.files} Parquet views`);
}

for (const route of ["/api/yoy?indicator=invalid", "/api/yoy", "/api/yoy?indicator=SP.POP.TOTL&indicator=NY.GDP.MKTP.CD", "/api/latest?indicator=invalid", "/api/income-groups?indicator=invalid", "/api/country/ZZZ"]) {
  const response = await fetch(new URL(route, base));
  assert.equal(response.status, 400, `${route}: expected 400`);
  assert.equal(typeof (await response.json()).error, "string");
  console.log(`PASS 400 ${route}`);
}

console.log("Smoke checks passed");
