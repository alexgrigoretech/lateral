import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: false,
  serverExternalPackages: ["@duckdb/node-api", "@duckdb/node-bindings"],
  // The DuckDB binding dlopens libduckdb.so next to duckdb.node, which file tracing cannot see.
  outputFileTracingIncludes: { "/*": ["./data/**/*.parquet", "./data/manifest.json", "./node_modules/@duckdb/node-bindings-linux-x64/**/*"] },
};

export default nextConfig;
