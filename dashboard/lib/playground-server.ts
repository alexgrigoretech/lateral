import { DATASETS } from "@/lib/datasets";
import { readManifest } from "@/lib/export";
import { getMeta } from "@/lib/queries";
import type { PlaygroundOptions } from "@/lib/playground";

export async function playgroundOptions(): Promise<PlaygroundOptions> {
  const [meta, manifest] = await Promise.all([getMeta(), readManifest()]);
  return {
    indicators: meta.indicators.map((item) => ({ value: item.indicator_code, label: item.label })),
    countries: meta.countries.map((item) => ({ value: item.country_iso3, label: item.country_iso3 })),
    datasets: DATASETS.map((item) => ({ value: item.name, label: item.name, filters: item.filters })),
    manifest: Object.fromEntries(DATASETS.flatMap(({ name }) => {
      const file = manifest.files.find((item) => item.path === `dashboard/data/${name}.parquet`);
      return file ? [[name, file.sha256]] : [];
    })),
  };
}
