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
const chartLazyLoadJs = fs.readFileSync(
  path.join(rootDir, '03_frontend/public/legacy/dist/chart-lazy-load.js'),
  'utf-8'
);
const legacyAnalyzerTsx = fs.readFileSync(
  path.join(rootDir, '03_frontend/src/LegacyAnalyzerApp.tsx'),
  'utf-8'
);
const chartShellHtml = fs.readFileSync(
  path.join(rootDir, '03_frontend/public/legacy/chart-shell-v2.html'),
  'utf-8'
);
const chartLogicTs = fs.readFileSync(
  path.join(rootDir, '01_pairUSDT/templates/chart-logic.ts'),
  'utf-8'
);
const chartLogicJs = fs.readFileSync(
  path.join(rootDir, '03_frontend/public/legacy/dist/chart-logic.js'),
  'utf-8'
);
const chartUiTs = fs.readFileSync(
  path.join(rootDir, '01_pairUSDT/templates/chart-ui.ts'),
  'utf-8'
);
const chartUiJs = fs.readFileSync(
  path.join(rootDir, '03_frontend/public/legacy/dist/chart-ui.js'),
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

test('3. dataFetcher.ts should use fetchAllRows for analysis results and predictions', () => {
  assert.match(
    dataFetcherTs,
    /fetchAllRows\(\s*supabase\.from\(['"]coin_analysis_results['"]\)/,
    'coin_analysis_results must be wrapped in fetchAllRows'
  );
  assert.match(
    dataFetcherTs,
    /fetchAllRows\(\s*supabase\.from\(['"]coin_prediction_paths['"]\)/,
    'coin_prediction_paths must be wrapped in fetchAllRows'
  );
  assert.match(
    dataFetcherTs,
    /fetchAllRows\(\s*supabase\.from\(['"]coin_prediction_peaks['"]\)/,
    'coin_prediction_peaks must be wrapped in fetchAllRows'
  );
});

test('4. chart-lazy-load.ts should have fallback to __fetchCycleData_frontend', () => {
  assert.ok(
    chartLazyLoadTs.includes('__fetchCycleData_frontend'),
    'chart-lazy-load.ts must fallback to __fetchCycleData_frontend when API fetch fails'
  );
});

test('5. chart-lazy-load.ts & .js must guard cross-origin frame access to window.parent', () => {
  assert.match(
    chartLazyLoadTs,
    /try\s*\{\s*fetchFn\s*=\s*\(window\.parent as any\)\?\.__fetchCycleData_frontend;\s*\}\s*catch/,
    'chart-lazy-load.ts must wrap window.parent access in try/catch'
  );
  assert.match(
    chartLazyLoadJs,
    /try\s*\{\s*fetchFn\s*=\s*window\.parent\?\.__fetchCycleData_frontend;\s*\}\s*catch/,
    'chart-lazy-load.js must wrap window.parent access in try/catch'
  );
});

test('6. LegacyAnalyzerApp.tsx must expose __fetchCycleData_frontend to window', () => {
  assert.match(
    legacyAnalyzerTsx,
    /__fetchCycleData_frontend\s*=\s*fetchCycleData/,
    'LegacyAnalyzerApp.tsx must expose __fetchCycleData_frontend'
  );
});

test('7. fetchAllRows simulation handles multi-page pagination correctly', async () => {
  // Simulate fetchAllRows logic
  const mockDataset = Array.from({ length: 1426 }, (_, i) => ({ id: i, val: `point-${i}` }));
  
  const mockQuery = {
    range: async (from, to) => {
      const slice = mockDataset.slice(from, to + 1);
      return { data: slice, error: null };
    }
  };

  async function simulateFetchAllRows(query) {
    let allData = [];
    let from = 0;
    const limit = 1000;
    while (true) {
      const { data, error } = await query.range(from, from + limit - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allData = allData.concat(data);
      if (data.length < limit) break;
      from += limit;
    }
    return allData;
  }

  const result = await simulateFetchAllRows(mockQuery);
  assert.equal(result.length, 1426, 'Should retrieve all 1426 rows across pages');
  assert.equal(result[0].id, 0);
  assert.equal(result[1425].id, 1425);
});

test('8. chart-shell-v2.html retains the OPTIONS dropdown button and checkboxes', () => {
  assert.match(
    chartShellHtml,
    /id="showDropdownBtn"[^>]*onclick="toggleShowDropdown\(\)"/,
    'OPTIONS ▾ dropdown button must be present with toggleShowDropdown onclick'
  );
  assert.match(chartShellHtml, /id="chkRange"/, 'HIGH/LOW checkbox must exist');
  assert.match(chartShellHtml, /id="chkBox"/, 'BOX ZONE checkbox must exist');
  assert.match(chartShellHtml, /id="chkBearBull"/, 'PREDICT checkbox must exist');
  assert.match(chartShellHtml, /id="chkExtendedForecast"/, 'EXTENDED checkbox must exist');
  assert.match(chartShellHtml, /id="chkSubBox"/, 'SUB-BOX checkbox must exist');
  assert.match(chartShellHtml, /id="chkBB"/, 'BB checkbox must exist');
});

test('9. chart-logic sets default options to false (all unchecked by default)', () => {
  // Check TS template
  assert.match(chartLogicTs, /showHighLow:\s*false/, 'showHighLow must be false');
  assert.match(chartLogicTs, /showBoxZone:\s*false/, 'showBoxZone must be false by default');
  assert.match(chartLogicTs, /showBearBull:\s*false/, 'showBearBull must be false');
  assert.match(chartLogicTs, /showPrediction:\s*false/, 'showPrediction must be false by default');
  assert.match(chartLogicTs, /showExtendedForecast:\s*false/, 'showExtendedForecast must be false');
  assert.match(chartLogicTs, /showSubBox:\s*false/, 'showSubBox must be false by default');
  assert.match(chartLogicTs, /showBB:\s*false/, 'showBB must be false');

  // Check JS bundle
  assert.match(chartLogicJs, /showBoxZone:\s*false/, 'chartLogicJs showBoxZone must be false');
  assert.match(chartLogicJs, /showPrediction:\s*false/, 'chartLogicJs showPrediction must be false');
  assert.match(chartLogicJs, /showSubBox:\s*false/, 'chartLogicJs showSubBox must be false');
});

test('10. chart-ui implements toggleShowDropdown and exposes to window', () => {
  assert.match(chartUiTs, /export function toggleShowDropdown\(\)/, 'toggleShowDropdown must be defined');
  assert.match(chartUiTs, /\(window as any\)\.toggleShowDropdown\s*=\s*toggleShowDropdown/, 'toggleShowDropdown must be on window');
  assert.match(chartUiJs, /window\.toggleShowDropdown\s*=\s*toggleShowDropdown/, 'chartUiJs exposes toggleShowDropdown on window');
});

test('11. chart-ui implements syncCheckboxStates and syncs checkboxes with state', () => {
  assert.match(chartUiTs, /function syncCheckboxStates\(\)/, 'syncCheckboxStates must be defined');
  assert.match(chartUiTs, /chkBox\.checked\s*=\s*Boolean\(chartState\.showBoxZone\)/, 'chkBox must sync with showBoxZone');
  assert.match(chartUiTs, /chkBearBull\.checked\s*=\s*Boolean\(chartState\.showPrediction\)/, 'chkBearBull must sync with showPrediction');
  assert.match(chartUiTs, /chkSubBox\.checked\s*=\s*Boolean\(chartState\.showSubBox\)/, 'chkSubBox must sync with showSubBox');
});
