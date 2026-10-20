import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Cloud saves uses its own light palette instead of mismatched dark utilities', () => {
  const component = readFileSync(new URL('../src/components/CloudSaves.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/boop.css', import.meta.url), 'utf8');
  assert.match(component, /className="boop-cloud-dialog /);
  assert.match(component, /const button = 'boop-cloud-button /);
  assert.doesNotMatch(component, /bg-\[#181b20\]|bg-slate-800|text-white|text-slate-100/);
  assert.match(css, /\.boop-app \.boop-cloud-dialog\s*\{[^}]*background:#fff !important;[^}]*color:var\(--boop-ink\) !important;/s);
  assert.match(css, /\.boop-app \.boop-cloud-dialog \.boop-cloud-button\s*\{[^}]*color:#fff !important;/s);
  assert.match(css, /\.boop-app \.boop-cloud-dialog \.boop-cloud-button:disabled\s*\{[^}]*color:#50645a !important;/s);
  assert.match(css, /\.boop-app \.boop-cloud-dialog \.boop-cloud-button-grid\s*\{[^}]*minmax\(0,1fr\)/s);
});

test('Cloud saves keeps each account and recovery action accessible', () => {
  const component = readFileSync(new URL('../src/components/CloudSaves.tsx', import.meta.url), 'utf8');
  for (const button of [
    'Close cloud saves', 'Save sprites', 'Restore sprites', 'Retry sprite sync',
    'Save to cloud', 'Load from cloud', 'Refresh cloud info', 'Sign out',
    'Export device backup',
  ]) assert.ok(component.includes(button), `Missing Cloud saves action ${button}`);
});
