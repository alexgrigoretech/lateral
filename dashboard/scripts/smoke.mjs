import assert from "node:assert/strict";
import { createHash } from "node:crypto";

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

for (const [route, expected] of [
  ["/brief", ["requirements in the brief", "Notes a reviewer will notice"]],
  ["/brief/1-1", ["Retrieve metadata and observations", "wb_pipeline/client.py lines 152 to 160", 'aria-current="page">1.1 Retrieve metadata and observations']],
  ["/brief/3-4", ["Income groups by year", "rpt_income_group_by_year.sql"]],
  ["/brief/6-4", ["Git repository with commit history", 'class="brief-note"']],
  ["/brief/decisions", ["D18", "Applies to:"]],
  ["/brief/architecture", ["Year over year across a gap"]],
  ["/missing", ["brief/3-1", "empty-state--clear"]],
  ["/yoy", ["Year over year", 'scope="rowgroup"']],
  ["/country/USA", ["United States"]],
  ["/about", ["Grain and business key of each model"]],
  ["/playground", ["Try the API", "All routes", "/api/health"]],
]) {
  const response = await fetch(new URL(route, base));
  assert.equal(response.status, 200, `${route}: expected 200`);
  const body = (await response.text()).replace(/<!--[\s\S]*?-->/g, "");
  for (const text of expected) assert.ok(body.includes(text), `${route}: missing ${text}`);
  if (route === "/brief/architecture") assert.ok((body.match(/aria-label=/g) ?? []).length >= 6, `${route}: expected at least six aria-label attributes`);
  if (route === "/brief/architecture") assert.ok(body.includes('aria-describedby="er-diagram-desc"'), `${route}: expected ER diagram description`);
  if (route === "/yoy") assert.ok(!body.includes('<table class="visually-hidden"'), `${route}: hidden tables need a wrapper`);
  if (route === "/country/USA") assert.match(body, /<title>[^<]*United States[^<]*<\/title>/, `${route}: expected country title`);
  if (route === "/country/USA") assert.ok(body.includes("data-table--static-head"), `${route}: expected static table heads`);
  console.log(`PASS 200 ${route} page-specific content`);
}

const unknownBrief = await fetch(new URL("/brief/9-9", base));
assert.equal(unknownBrief.status, 404, "/brief/9-9: expected 404");
console.log("PASS 404 /brief/9-9");

const manifestResponse = await fetch(new URL("/api/export/manifest", base));
assert.equal(manifestResponse.status, 200);
assert.equal(manifestResponse.headers.get("cache-control"), "public, s-maxage=3600, stale-while-revalidate=86400");
assert.equal(manifestResponse.headers.get("x-content-type-options"), "nosniff");
const manifest = await manifestResponse.json();
assert.equal(typeof manifest.run_id, "string");
assert.ok(Array.isArray(manifest.files));
assert.equal(manifest.files.length, 17);
for (const file of manifest.files) {
  for (const key of ["path", "format", "rows", "bytes", "sha256"]) assert.ok(Object.hasOwn(file, key), `manifest: missing ${key}`);
  assert.equal(typeof file.path, "string");
  assert.equal(typeof file.format, "string");
  assert.ok(file.rows === null || typeof file.rows === "number");
  assert.equal(typeof file.bytes, "number");
  assert.match(file.sha256, /^[a-f0-9]{64}$/i);
}
console.log("PASS 200 /api/export/manifest schema and cache policy");

const yoyFile = manifest.files.find((file) => file.path === "dashboard/data/rpt_yoy_change.parquet");
const indicatorFile = manifest.files.find((file) => file.path === "dashboard/data/dim_indicator.parquet");
const countryFile = manifest.files.find((file) => file.path === "dashboard/data/dim_country.parquet");
assert.ok(yoyFile && indicatorFile && countryFile);

const filteredCsvRoute = `/api/export/rpt_yoy_change?format=csv&indicator=${indicator}`;
const filteredCsv = await fetch(new URL(filteredCsvRoute, base));
assert.equal(filteredCsv.status, 200);
assert.ok(filteredCsv.headers.get("content-type").startsWith("text/csv"));
assert.equal(filteredCsv.headers.get("content-disposition"), 'attachment; filename="rpt_yoy_change.SP.POP.TOTL.csv"');
assert.equal(filteredCsv.headers.get("cache-control"), "public, s-maxage=3600, stale-while-revalidate=86400");
assert.equal(filteredCsv.headers.get("x-content-type-options"), "nosniff");
const [filteredHeader, ...filteredLines] = (await filteredCsv.text()).split(/\r?\n/);
assert.ok(filteredHeader.includes("country_iso3") && filteredHeader.includes("indicator_code"));
const dataLines = filteredLines.filter((line) => line.length > 0);
assert.ok(dataLines.length > 0);
for (const line of dataLines) assert.ok(line.includes(indicator));
assert.equal(yoyFile.rows % dataLines.length, 0);
assert.equal(dataLines.length, yoyFile.rows / indicatorFile.rows);
console.log(`PASS 200 ${filteredCsvRoute} CSV headers, selection and ${dataLines.length} rows`);

const countryParquet = await fetch(new URL("/api/export/dim_country?format=parquet", base));
assert.equal(countryParquet.status, 200);
assert.equal(countryParquet.headers.get("content-type"), "application/vnd.apache.parquet");
assert.equal(countryParquet.headers.get("content-disposition"), 'attachment; filename="dim_country.parquet"');
assert.equal(countryParquet.headers.get("cache-control"), "public, s-maxage=3600, stale-while-revalidate=86400");
assert.equal(countryParquet.headers.get("x-content-type-options"), "nosniff");
const countryBytes = Buffer.from(await countryParquet.arrayBuffer());
assert.equal(countryBytes.subarray(0, 4).toString(), "PAR1");
assert.equal(countryBytes.subarray(-4).toString(), "PAR1");
assert.equal(countryBytes.length, countryFile.bytes);
assert.equal(createHash("sha256").update(countryBytes).digest("hex"), countryFile.sha256);
console.log("PASS 200 /api/export/dim_country?format=parquet committed bytes and SHA-256");

const filteredParquet = await fetch(new URL("/api/export/fct_indicator_year?format=parquet&country=USA", base));
assert.equal(filteredParquet.status, 200);
assert.equal(filteredParquet.headers.get("content-disposition"), 'attachment; filename="fct_indicator_year.USA.parquet"');
const filteredBytes = Buffer.from(await filteredParquet.arrayBuffer());
assert.equal(filteredBytes.subarray(0, 4).toString(), "PAR1");
assert.equal(filteredBytes.subarray(-4).toString(), "PAR1");
console.log("PASS 200 /api/export/fct_indicator_year?format=parquet&country=USA filtered Parquet");

const allYoyCsv = await fetch(new URL("/api/export/rpt_yoy_change?format=csv", base));
assert.equal(allYoyCsv.status, 200);
const allYoyLines = (await allYoyCsv.text()).split(/\r?\n/).slice(1).filter((line) => line.length > 0);
assert.equal(allYoyLines.length, yoyFile.rows);
console.log(`PASS 200 /api/export/rpt_yoy_change?format=csv ${allYoyLines.length} rows`);

for (const route of ["/api/export/nope?format=csv", "/api/export/dim_country?format=xlsx", `/api/export/run_summary?format=csv&indicator=${indicator}`, "/api/export/rpt_yoy_change?format=csv&indicator=INVALID", `/api/export/rpt_yoy_change?format=csv&indicator=${indicator}&indicator=NY.GDP.MKTP.CD`]) {
  const response = await fetch(new URL(route, base));
  assert.equal(response.status, 400, `${route}: expected 400`);
  assert.equal(typeof (await response.json()).error, "string");
  console.log(`PASS 400 ${route}`);
}

for (const [route, expected] of [
  ["/export", ["Export the data", manifest.run_id, 'class="manifest-table', "python -m wb_pipeline manifest --check"]],
  ["/yoy", ['class="export-links"', "rpt_yoy_change.SP.POP.TOTL.csv"]],
  ["/country/USA", ["fct_indicator_year.USA.parquet"]],
]) {
  const response = await fetch(new URL(route, base));
  assert.equal(response.status, 200, `${route}: expected 200`);
  const body = (await response.text()).replace(/<!--[\s\S]*?-->/g, "");
  for (const text of expected) assert.ok(body.includes(text), `${route}: missing ${text}`);
  console.log(`PASS 200 ${route} export content`);
}

for (const route of ["/api/export/dim_country?format=csv&contrey=USA", "/api/export/rpt_yoy_change?format=csv&indicator=", "/api/export/dim_country?format=csv&country=", "/api/export/dim_country?format="]) {
  const response = await fetch(new URL(route, base));
  assert.equal(response.status, 400, `${route}: expected 400`);
  assert.equal(typeof (await response.json()).error, "string");
  console.log(`PASS 400 ${route}`);
}

for (const [route, expected] of [
  ["/export", ['class="data-table data-table--static-head export-datasets"', 'class="manifest-table data-table data-table--static-head"', "0 (header only)", "Indicator codes:", "Country codes:", "Copy digest", "<wbr"]],
  ["/yoy", ["Year over year change (Population, total)"]],
]) {
  const response = await fetch(new URL(route, base));
  assert.equal(response.status, 200, `${route}: expected 200`);
  const body = (await response.text()).replace(/<!--[\s\S]*?-->/g, "");
  for (const text of expected) assert.ok(body.includes(text), `${route}: missing ${text}`);
  console.log(`PASS 200 ${route} export design content`);
}

console.log("Smoke checks passed");
