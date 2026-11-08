# World Bank country indicators pipeline
![CI](https://github.com/alexgrigoretech/lateral/actions/workflows/ci.yml/badge.svg)

A local, configuration-driven pipeline that pulls yearly country indicators from the public World Bank API, keeps every raw response, builds an analytics-ready model in DuckDB with dbt, tests it offline, and ships a reporting layer plus a dashboard.

Countries: BRA, CAN, DEU, GBR, IND, JPN, MEX, USA, ZAF. Indicators: population (SP.POP.TOTL), GDP in current US dollars (NY.GDP.MKTP.CD), GDP per capita (NY.GDP.PCAP.CD), life expectancy at birth (SP.DYN.LE00.IN). Years 2018 to 2024. All of this lives in `config/pipeline.yaml` and can be changed without touching code.

The dashboard under `dashboard/` reads the exported Parquet files through DuckDB inside Next.js route handlers. It is live at https://lateral.analyticslab.ro and its deployment is described in `dashboard/README.md`. The site also carries a brief walkthrough (https://lateral.analyticslab.ro/brief) that maps every requirement of the assessment to the code that meets it, with code samples, diagrams and the decision log. The repository is public at https://github.com/alexgrigoretech/lateral.

## Run it

Requirements: Python 3.11 and `make` (Git Bash on Windows works). Docker is an alternative.

```
make setup      # creates .venv and installs pinned requirements
make run        # ingest from the live API, build and test the dbt models, export outputs
make test       # offline test suite, no network, under a temporary warehouse
```

Without make:

```
python -m venv .venv
.venv/bin/python -m pip install -r requirements.txt        # Windows: .venv/Scripts/python.exe
.venv/bin/python -m wb_pipeline run
.venv/bin/python -m pytest -q
```

Docker:

```
docker build -t wb-pipeline .
docker run --rm -v "$PWD/data:/app/data" -v "$PWD/outputs:/app/outputs" -v "$PWD/dashboard/data:/app/dashboard/data" wb-pipeline
```

`make samples` regenerates `outputs/samples-synthetic/` from the synthetic fixtures. `make run` prints a JSON summary with the run id and the row count of every relation. Outputs land in three places: the DuckDB warehouse at `data/warehouse.duckdb` (schemas raw, staging, marts, reporting), CSV samples of the reporting queries in `outputs/`, and Parquet copies of marts and reports in `dashboard/data/`. The export also writes `manifest.json` next to the CSV files and next to the Parquet files, listing every exported file with its path relative to the common parent of the Parquet and CSV folders, row count, size and sha256 so a reviewer can prove the committed samples came from the stated run, and `python -m wb_pipeline manifest --check` recomputes the hashes and exits nonzero on any mismatch. The verbatim API responses sit under `data/raw/<run_id>/`.

Running the pipeline twice against unchanged source data adds a run record and page sightings and nothing else. The second live run on 2026-11-08 left `raw.api_pages` at 9 rows, `raw.observation_rows` at 252 and `marts.fct_indicator_year` at 252, while `raw.page_sightings` went from 9 to 18.

To run the pipeline without the network, point it at recorded responses:

```
.venv/bin/python -m wb_pipeline run --offline-fixtures tests/fixtures/live_2026-11-08 --duckdb-path /tmp/wb.duckdb --export-dir /tmp/wb-out
```

## Layout

```
config/pipeline.yaml      countries, indicators, years, API settings, paths, tolerance
wb_pipeline/              Python: config, HTTP client, raw persistence, dbt runner, export, CLI
dbt/                      dbt project on DuckDB: staging, marts, reporting, singular tests
docs/data-model.md        grain, keys, relationships, status semantics, ER diagram
tests/                    pytest suite, synthetic fixtures and recorded live fixtures
outputs/                  CSV samples of the reporting layer from the last live run
outputs/samples-synthetic CSV samples from the synthetic fixtures, where the missing-data report has rows
dashboard/                Next.js dashboard reading dashboard/data/*.parquet through DuckDB
```

## How it works

### Ingestion

`WorldBankClient` makes one paged request per entity: the country metadata for all configured countries, the observations for each indicator across all countries and the configured year range, and the metadata of each indicator. It follows the `pages` field in the response header, retries 429 and 5xx responses, connection errors and timeouts with exponential backoff and jitter, and treats a 200 whose body is not the two-element `[meta, rows]` shape as an error (the API answers bad parameters that way).

Every page is kept twice: as a verbatim JSON file under `data/raw/<run_id>/` and as a row in `raw.api_pages` with the request URL, pagination header, source release date, fetch time and the body as a JSON column. The page id is the SHA-256 of the request URL and the body hash, so an unchanged page fetched again is recognised and only a sighting row is appended to `raw.page_sightings`. Rows are exploded into `raw.observation_rows`, `raw.country_rows` and `raw.indicator_meta_rows` keyed by page id and row index, with the same insert-if-absent rule. All pages of one request are validated first and inserted in one transaction, so a failure mid-request never leaves half a request visible.

Every value in the final model therefore traces back to the exact response it came from: `fct_indicator_year.source_page_id` and `source_row_index` identify the stored page and the row inside it.

### Model

The raw tables are never modified after insert. Staging (`stg_countries`, `stg_indicators`, `stg_observations`) types the fields, trims strings and deduplicates on business key, keeping the most recently sighted record. Marts are rebuilt in full on every run from the configuration spine (every configured country x indicator x year), so the fact table always has exactly the expected number of rows and a rebuild is idempotent by construction.

| Model | Grain | Business key |
|---|---|---|
| dim_country | one row per configured country | country_iso3 |
| dim_indicator | one row per configured indicator | indicator_code |
| fct_indicator_year | one row per configured country, indicator and year | country_iso3, indicator_code, year |

Missing data is a first-class outcome. Each fact row carries a status: `present` (the API returned a number), `null_value` (the API returned a record whose value is null) or `not_returned` (the API returned no record for that key). The value column is NULL for both missing cases and is never filled with zero. Full detail, including the ER diagram and the reasoning behind every reporting view, is in `docs/data-model.md`.

### Reporting layer

Views in the `reporting` schema, exported to CSV in `outputs/` and to Parquet for the dashboard:

| Question | View |
|---|---|
| Which country-indicator-year combinations are missing or incomplete? | `rpt_missing_data`, `rpt_completeness_by_country_indicator` |
| Year-over-year change, handling missing or zero prior values | `rpt_yoy_change` (statuses ok, first_year, prior_missing, prior_zero, current_missing) |
| Countries compared for the latest available year of each indicator | `rpt_latest_year_comparison` (common latest year with rank and share of total), `rpt_latest_available_per_country` |
| Indicators across income groups, by year | `rpt_income_group_by_year` (sum for additive indicators, population-weighted average for per-capita and life expectancy, plus mean, median, min, max, counts) |

The year-over-year view uses LAG over the full configured spine, so a gap year produces `prior_missing` in the year after it instead of silently comparing across the gap. The latest-year comparison picks, per indicator, the latest year with at least one present value and lists every country for that year, so a country that lags shows up as missing rather than being compared at a different year.

### Data quality and tests

`dbt build` runs 65 tests on every run: uniqueness and not-null on each business key, relationships from the fact to both dimensions, accepted values for every status column, year bounds from the configuration, positive population and GDP, life expectancy between 20 and 100, exact spine cardinality, observation deduplication, and a cross-indicator consistency check: where population, GDP and GDP per capita are all present, GDP per capita must equal GDP divided by population within the configured relative tolerance (1 percent). Population moving more than 10 percent year over year warns without failing.

`pytest` runs without the network. A guard (`WB_OFFLINE_GUARD=1`) makes the HTTP client raise on any real connection attempt, and the suite uses `responses` for client behaviour (paging, retries, exhaustion, malformed bodies, page id stability) and recorded fixtures for end-to-end runs under a temporary warehouse: a synthetic set with one explicit null and one absent record, a three-page pagination set, a 503-then-200 sequence, and the nine real pages recorded from the live API on 2026-11-08. Tests also prove that two runs over the same fixtures add no analytical rows and that adding a tenth country in the configuration yields 10 x 4 x 7 fact rows with no code change. GitHub Actions runs the same offline suite, an offline pipeline run on the recorded fixtures, the manifest check, the dashboard lint, build and smoke test, and gitleaks on every push to main and pull request (workflow in `.github/workflows/ci.yml`).

### Adding a country or an indicator

Add the ISO3 code to `countries` or an entry with `code`, `label` and `category` to `indicators` in `config/pipeline.yaml`, then run the pipeline. The spine, the dimensions, the fact table and every report follow. The income-group aggregates read the income level from the API metadata, so a new country lands in the right group automatically.

## Assumptions and trade-offs

- The current World Bank release (source `lastupdated` 2026-10-08) has a value for every configured combination, so the live run reports zero missing rows and `outputs/rpt_missing_data.csv` is a header only. `outputs/samples-synthetic/` holds the same six reports produced from `tests/fixtures/synthetic`, where `rpt_missing_data.csv` carries one `not_returned` and one `null_value` row. The dashboard shows the empty state with the explanation. Adding 2025 to the year range would surface `not_returned` rows immediately.
- Nothing was created for this assessment on a cloud provider, and no paid or API account was opened. The pipeline needs none of that: public API, a local DuckDB file, dbt in process. The dashboard is the optional extra from section 3 of the brief and runs locally with `npm run dev`. A copy is also hosted on the author's existing Vercel hobby account under the author's existing domain (lateral.analyticslab.ro), both of which predate the assessment; it is a convenience for reviewers, not part of the pipeline.
- Income groups are taken from the current country metadata and applied to every year. The API does not expose historical income classification, and this is stated in the model documentation.
- Population-weighted life expectancy is a descriptive aggregate of country estimates, not a pooled life table. Analysts are told which statistic to use for which indicator in `docs/data-model.md`.
- Marts are rebuilt in full rather than merged incrementally. At this volume a rebuild costs seconds and removes a whole class of merge bugs; the raw layer is the append-only history that an incremental strategy would need later.
- DuckDB and dbt locally instead of a hosted warehouse, because the brief forbids creating cloud resources. The production note below maps each piece onto Snowflake with Glue or EMR.
- Raw pages are also written to disk per run even when DuckDB already has them, as forensic evidence; this duplicates storage and is a deliberate choice.
- Docker was verified on 2026-11-08 by building the image and running it on the recorded fixtures with `WB_OFFLINE_GUARD=1`; the mounted `data`, `outputs` and `dashboard/data` folders received the same files as a local run.
- The DuckDB file is a single-writer store. Concurrent ingestion and transformation against the same file are not supported and are not needed locally.

## Production design note

Scheduling and incremental refreshes
- Run daily after the World Bank publishing window with an orchestrator (Airflow, Dagster or Step Functions). One task per entity and indicator so a failed indicator reruns alone.
- Compare the `lastupdated` header of each indicator response with the last stored value before paging; skip unchanged indicators, fetch changed ones in full. The page id mechanism already makes the full fetch cheap to reconcile.
- Keep marts as full rebuilds while the spine is small; move `fct_indicator_year` to a merge on the business key when the country or year range grows, with the raw layer as the replayable history.

Late, corrected or changed source data
- The raw layer is append-only: a changed page gets a new page id, the old page stays, and staging picks the latest sighting. A correction is therefore a new version, not an overwrite, and the previous value is still queryable by page id.
- Add a `valid_from` and `valid_to` pair on observations (SCD2) when analysts need point-in-time reads; the sighting history already carries the information.
- Emit a diff report per run (rows whose value changed between the previous and the current sighting) and attach it to the run record for review.

Monitoring, alerting and data-quality failures
- Fail the run on hard test failures (keys, spine, consistency), warn on soft ones (population plausibility), and page on the former only.
- Track per run: pages fetched, pages new, rows present, rows missing by status, test pass counts and runtime. Alert on a drop in present rows or a rise in `not_returned`, both signs of an upstream change rather than a code change.
- Store `run_summary` in the warehouse and surface it in the dashboard, as done here, so the data team and the research team see the same run state.

Backfills and replayability
- Every run is reproducible from its stored raw pages: `run --offline-fixtures` replays a run without touching the API, which is also how a backfill for a new indicator or an extended year range is dry-run first.
- Backfill by extending the configuration (years or countries) and running once; the spine grows and the marts rebuild. The configuration hash is stored on the run and on the spine, so a backfill is auditable.
- Keep the raw directory under object storage with versioning and a lifecycle policy; the DuckDB file is disposable and rebuildable from it.

Mapping to Snowflake with AWS Glue or EMR (or Azure equivalents)
- Raw pages to S3 (versioned, partitioned by run_id and entity), with the page id as the object key suffix; a Glue crawler or an external table exposes them.
- Ingestion as a Glue Python shell job or a small Lambda per indicator; EMR is overkill at this volume but fits if the indicator list grows into the thousands.
- `raw.api_pages` and the exploded rows as Snowflake tables loaded with Snowpipe from S3 or with COPY in a Glue job; the JSON body in a VARIANT column keeps the same lineage queries.
- dbt-snowflake replaces dbt-duckdb with the same models; the schema macro, tests and reporting views are portable. The marts become Snowflake tables, the reports secure views.
- Orchestration with MWAA or Step Functions, secrets in Secrets Manager (none needed for this API), alerts through CloudWatch to Slack or PagerDuty.
- Azure: ADLS Gen2 for raw, Azure Functions or Data Factory for ingestion, Synapse or Snowflake on Azure for the warehouse with the same dbt project, Azure Monitor for alerts.

## Walkthrough of key decisions

1. Idempotency by content, not by run. The page id is a hash of request and body, so "unchanged source data" is detected at the byte level and the re-run adds nothing but a sighting. This was the first thing built and the first thing tested.
2. A full configuration spine as the fact grain. The fact table has one row per expected combination regardless of what the API returned, which turns missing data into a status the analyst can query rather than an absence they have to infer.
3. Marts rebuilt in full. Simpler, provably idempotent, and the raw history makes an incremental strategy a later optimisation rather than a prerequisite.
4. Reports as dbt views over the fact table rather than Python. They are documented and tested in the same place as the model, and the exact SQL is in the repository.
5. Live fixtures recorded once and committed. The suite runs offline, and the recorded pages double as an offline demo of the pipeline.

## AI usage

Claude Code (Claude Fable 5.1) orchestrated the work, wrote this README and the dashboard styling. OpenAI Codex (gpt-6.1-sol) implemented the pipeline, the dbt project, the tests and the dashboard application from written briefs. The author designed the approach, reviewed every diff, ran the live and offline verification outside the agents' sandbox and decided every trade-off listed above. The agents' sandbox had no network access, so all live runs, fixture recordings and dependency installs were executed and checked by hand.

## Repository history

The working copy was deleted by accident on the afternoon of 2026-11-08, after the first full build and the first production deployment. The tree was reconstructed the same day from the agents' session logs and the author's edit history, re-verified end to end (live run, idempotent re-run, 57 offline tests, dashboard build and smoke test), and committed again in the original logical steps. The commit timestamps therefore postdate the work they describe.

## Unfinished work and next steps

- A diff report between runs (which values changed since the previous sighting) is described in the production note and not implemented.
- A historical income-group dimension would need a second source; the API does not provide it.
- Incremental refresh keyed on the `lastupdated` header is designed above and not implemented; the full fetch is nine requests.
