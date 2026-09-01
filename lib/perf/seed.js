// The bundled snapshot: the full campaign-dashboard dataset (PII stripped),
// captured 2026-09-01 and shipped gzipped in the repo. It is the floor the app
// never falls below: if there is no snapshot in Supabase yet, pages render from
// this and say so, and an admin can promote it into perf_snapshots with one
// click so every viewer sees the same thing.
import { readFileSync } from 'fs';
import { gunzipSync } from 'zlib';
import path from 'path';

let SEED = null;
export function bundledSeed() {
  if (!SEED) {
    const gz = readFileSync(path.join(process.cwd(), 'lib/perf/seed.json.gz'));
    SEED = JSON.parse(gunzipSync(gz).toString('utf8'));
  }
  return SEED;
}
