# World Bank country indicators

The dashboard is live at https://lateral.analyticslab.ro. Run from this directory with Node.js 22 or newer. The local and Vercel runtime is Node.js 24. Dependencies must already be installed.

```powershell
npm run dev
npm run lint
npm run build
npm run start
npm run smoke
```

The smoke script fetches a running server and starts nothing. BASE_URL optionally overrides http://localhost:3000 for verification.

Pages: /, /missing, /yoy, /latest, /income-groups, /country/[iso3], /about. The six main sections appear in the navigation; country pages are linked from tables and matrices. Indicator selections use the indicator query parameter, country focus uses focus, and income group statistics use stat (sum_value, population_weighted_avg, avg_value or median_value, as applicable).

JSON GET routes: /api/meta, /api/completeness, /api/yoy?indicator=SP.POP.TOTL, /api/latest?indicator=SP.POP.TOTL, /api/income-groups?indicator=SP.POP.TOTL, /api/country/USA and /api/health. Indicator routes require one valid indicator code. Invalid selections return a JSON error with HTTP 400. Successful responses allow shared caching for one hour and stale revalidation for one day.

The `/export` page lists every dataset with row counts and provenance. Download `/api/export/<dataset>?format=csv|parquet` with optional `indicator` and `country` query parameters where supported; attachment filenames follow `<dataset>[.<indicator>][.<country>].<format>`. Unknown or empty parameters are rejected with HTTP 400. The `/api/export/manifest` route returns the run manifest with file sizes and SHA-256 digests. Unfiltered Parquet downloads are the committed files, byte for byte.

The Python and dbt pipeline exports ten reporting Parquet files into data/. They are committed snapshots refreshed by pipeline runs. The dashboard reads those files with one lazy, process-wide DuckDB instance and connection. It does not call the World Bank API. Deploy a new build after refreshing the files so each function uses a consistent snapshot. Nulls retain their missing-data status, numeric values are serialized as JavaScript numbers, and timestamps are serialized as ISO strings and displayed in UTC.

For Vercel, set the root directory to dashboard and the framework to Next.js. No environment variables are needed. Keep the Node.js runtime at 24. The Next.js configuration externalizes the DuckDB packages and traces data/**/*.parquet into functions. The native binding must match Vercel's Linux platform; validate /api/health after deployment. A local Windows build does not establish Linux native binding compatibility.

Styling lives in app/globals.css as a single stylesheet with design tokens on :root and a dark theme under prefers-color-scheme. Components carry BEM style class names and no inline styles.
