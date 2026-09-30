// Colorways are presentation only. These tests hold that line: every theme must
// define the full token set, and no colour may live outside themes.css.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const themes = readFileSync(join(root, 'styles/themes.css'), 'utf8');
const app = readFileSync(join(root, 'styles/app.css'), 'utf8');
const settings = readFileSync(join(root, 'src/ui/settings.js'), 'utf8');

const REQUIRED = [
  'bg', 'surface', 'surface-alt', 'surface-open', 'line', 'line-strong',
  'text', 'muted', 'faint',
  'accent', 'accent-ink', 'accent-line', 'accent-soft', 'accent-wash',
  'good', 'good-ink', 'good-line', 'warn', 'danger', 'danger-line',
  'bar-bg', 'pill-bg', 'pill-shadow', 'card-shadow', 'scrim', 'toast-bg', 'toast-ink',
  'font-ui', 'h1-font', 'h1-track', 'h1-case', 'card-title-font', 'card-title-track', 'label-font',
];

function themeBlocks() {
  const out = new Map();
  const re = /\[data-theme="([a-z]+)"\]\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(themes))) {
    if (out.has(m[1])) continue;        // only the token block, not the later overrides
    if (!m[2].includes('--bg')) continue;
    out.set(m[1], m[2]);
  }
  return out;
}

test('every colorway defines the complete token set', () => {
  const blocks = themeBlocks();
  assert.equal(blocks.size, 4, 'four colorways');
  for (const [name, body] of blocks) {
    for (const token of REQUIRED) {
      assert.ok(new RegExp(`--${token}\\s*:`).test(body), `${name} is missing --${token}`);
    }
    assert.ok(/color-scheme:\s*(light|dark)/.test(body), `${name} must declare a color-scheme`);
  }
});

test('no colour is hardcoded outside the colorway file', () => {
  const stripped = app.replace(/var\(--[^)]*\)/g, '');
  const colours = stripped.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g) || [];
  assert.deepEqual(colours, [], `app.css must use tokens only, found ${colours.join(', ')}`);
});

test('a completed set is legible in every colorway', () => {
  // The tick fills with --good and prints its check in --good-ink; if a theme
  // reused --accent-ink here, chalk-on-chalk would vanish.
  assert.ok(app.includes('background: var(--good); border-color: var(--good); color: var(--good-ink)'));
  for (const [name, body] of themeBlocks()) {
    const good = /--good:\s*([^;]+);/.exec(body)[1].trim();
    const ink = /--good-ink:\s*([^;]+);/.exec(body)[1].trim();
    assert.notEqual(good.toLowerCase(), ink.toLowerCase(), `${name} would print the tick on itself`);
  }
});

test('the Settings list offers exactly the colorways that exist', () => {
  const listed = [...settings.matchAll(/\{ id: '([a-z]+)', name: '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(listed.sort(), [...themeBlocks().keys()].sort());
});

test('no colorway alters layout, spacing or navigation', () => {
  const overrides = themes.match(/\[data-theme="[a-z]+"\]\s+[^{]+\{[^}]*\}/g) || [];
  const banned = /(display|position|width|height|margin|padding|gap|flex|grid|top|left|right|bottom|z-index|order)\s*:/;
  for (const rule of overrides) {
    assert.ok(!banned.test(rule), `a colorway is changing layout: ${rule.slice(0, 90)}`);
  }
});
