import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

const overlayJs = fs.readFileSync(
  path.join(rootDir, '03_frontend/public/legacy/dist/chart-render-overlays.js'),
  'utf-8',
);
const overlayTs = fs.readFileSync(
  path.join(rootDir, '01_pairUSDT/templates/chart-render-overlays.ts'),
  'utf-8',
);
const chartV2Css = fs.readFileSync(
  path.join(rootDir, '03_frontend/public/legacy/chart-v2.css'),
  'utf-8',
);
const templateChartCss = fs.readFileSync(
  path.join(rootDir, '01_pairUSDT/templates/chart.css'),
  'utf-8',
);

test('1. chart-render-overlays.ts formatFullBoxLabel formats without spaces before parentheses', () => {
  assert.ok(overlayTs.includes('`${rate.toFixed(1)}%${usdText ? `(${usdText})` : \'\'}`;'));
  assert.ok(overlayTs.includes('changeText ? ` ${changeText}${dayText ? `(${dayText})` : \'\'}` : \'\';'));
});

test('2. chart-render-overlays.ts formatBoxLabel delegates to formatFullBoxLabel', () => {
  assert.match(overlayTs, /function formatBoxLabel\([^)]*\): string\s*\{\s*return formatFullBoxLabel\(/);
});

test('3. chart-render-overlays.js dist has formatFullBoxLabel without extra spaces', () => {
  assert.ok(overlayJs.includes('`${rate.toFixed(1)}%${usdText ? `(${usdText})` : \'\'}`;'));
  assert.ok(overlayJs.includes('changeText ? ` ${changeText}${dayText ? `(${dayText})` : \'\'}` : \'\';'));
});

test('4. chart-render-overlays.js dist formatBoxLabel returns formatFullBoxLabel', () => {
  assert.match(overlayJs, /function formatBoxLabel\(prefix, boxNo, rate, usdValue, changePct, days, suffix = ''\)\s*\{\s*return formatFullBoxLabel\(/);
});

test('5. chart-v2.css .bz-label has 11px font-size and no border card box', () => {
  assert.match(chartV2Css, /\.bz-label\s*\{[^}]*font-size:\s*11px;/);
  assert.doesNotMatch(chartV2Css, /\.bz-label\s*\{[^}]*border:\s*1px solid/);
});

test('6. template chart.css .bz-label has 11px font-size and no border card box', () => {
  assert.match(templateChartCss, /\.bz-label\s*\{[^}]*font-size:\s*11px;/);
  assert.doesNotMatch(templateChartCss, /\.bz-label\s*\{[^}]*border:\s*1px solid/);
});
