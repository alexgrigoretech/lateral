import path from "node:path";
import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";

export const PARQUET_VIEWS = [
  "dim_country",
  "dim_indicator",
  "fct_indicator_year",
  "rpt_missing_data",
  "rpt_completeness_by_country_indicator",
  "rpt_yoy_change",
  "rpt_latest_year_comparison",
  "rpt_latest_available_per_country",
  "rpt_income_group_by_year",
  "run_summary",
] as const;

type Database = {
  instance: DuckDBInstance;
  connection: DuckDBConnection;
  queue: Promise<unknown>;
};

const globalDatabase = globalThis as typeof globalThis & {
  worldBankDatabase?: Promise<Database>;
  worldBankQueryResults?: Map<string, Promise<unknown[]>>;
};

async function database(): Promise<Database> {
  if (!globalDatabase.worldBankDatabase) {
    globalDatabase.worldBankDatabase = (async () => {
      const instance = await DuckDBInstance.create(":memory:");
      const connection = await instance.connect();
      try {
        await connection.run("SET TimeZone = 'UTC'");
        for (const name of PARQUET_VIEWS) {
          const file = path.join(process.cwd(), "data", `${name}.parquet`).replaceAll("\\", "/").replaceAll("'", "''");
          await connection.run(`CREATE VIEW ${name} AS SELECT * FROM read_parquet('${file}')`);
        }
        return { instance, connection, queue: Promise.resolve() };
      } catch (error) {
        connection.closeSync();
        throw error;
      }
    })().catch((error: unknown) => {
      globalDatabase.worldBankDatabase = undefined;
      throw error;
    });
  }
  return globalDatabase.worldBankDatabase;
}

function serialize(value: unknown): unknown {
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]));
  }
  return value;
}

export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  for (const value of params) {
    if (value !== null && typeof value !== "string" && typeof value !== "boolean" && !(typeof value === "number" && Number.isFinite(value))) {
      throw new TypeError("Unsupported query parameter");
    }
  }
  const cache = globalDatabase.worldBankQueryResults ??= new Map<string, Promise<unknown[]>>();
  const key = JSON.stringify([sql, params]);
  const cached = cache.get(key);
  if (cached) return cached as Promise<T[]>;
  const result = runQuery<T>(sql, params).catch((error: unknown) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, result);
  return result;
}

function enqueue<T>(db: Database, work: () => Promise<T>): Promise<T> {
  const result = db.queue.then(work);
  db.queue = result.catch(() => undefined);
  return result;
}

async function runQuery<T>(sql: string, params: unknown[]): Promise<T[]> {
  const db = await database();
  return enqueue(db, async () => {
    const statement = await db.connection.prepare(sql);
    try {
      for (const [index, value] of params.entries()) {
        if (value === null) statement.bindNull(index + 1);
        else if (typeof value === "string") statement.bindVarchar(index + 1, value);
        else if (typeof value === "number" && Number.isFinite(value)) statement.bindDouble(index + 1, value);
        else if (typeof value === "boolean") statement.bindBoolean(index + 1, value);
        else throw new TypeError("Unsupported query parameter");
      }
      const reader = await statement.runAndReadAll();
      try {
        return serialize(reader.getRowObjectsJS()) as T[];
      } finally {
        reader.closeSync();
      }
    } finally {
      statement.destroySync();
    }
  });
}

export async function execute(sql: string): Promise<void> {
  const db = await database();
  return enqueue(db, async () => {
    await db.connection.run(sql);
  });
}
