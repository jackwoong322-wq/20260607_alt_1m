import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

const vercelJson = JSON.parse(
  fs.readFileSync(path.join(rootDir, 'vercel.json'), 'utf-8')
);
const dataFetcherTs = fs.readFileSync(
  path.join(rootDir, '03_frontend/src/lib/dataFetcher.ts'),
  'utf-8'
);
const chartLazyLoadTs = fs.readFileSync(
  path.join(rootDir, '01_pairUSDT/templates/chart-lazy-load.ts'),
  'utf-8'
);

test('1. vercel.json should proxy /api requests to Render backend', () => {
  assert.ok(Array.isArray(vercelJson.rewrites), 'vercel.json must have rewrites array');
  const apiRewrite = vercelJson.rewrites.find((r) => r.source === '/api/:path*');
  assert.ok(apiRewrite, 'must have rewrite for /api/:path*');
  assert.equal(apiRewrite.destination, 'https://two0260317-alt.onrender.com/api/:path*');
});

test('2. dataFetcher.ts should use fetchAllRows for alt_cycle_data to prevent 1000-row limit cutoff', () => {
  assert.match(
    dataFetcherTs,
    /fetchAllRows\(\s*supabase\.from\(['"]alt_cycle_data['"]\)/,
    'alt_cycle_data query must be wrapped in fetchAllRows'
  );
});

test('3. chart-lazy-load.ts should have fallback to __fetchCycleData_frontend', () => {
  assert.ok(
    chartLazyLoadTs.includes('__fetchCycleData_frontend'),
    'chart-lazy-load.ts must fallback to __fetchCycleData_frontend when API fetch fails'
  );
});
