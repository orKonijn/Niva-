import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const html = readFileSync('dist/index.html', 'utf8');
assert.ok(
  /<link[^>]+rel="stylesheet"[^>]+href="styles-[^"]+\.css"/.test(html),
  'Production must load its main stylesheet directly.',
);
assert.ok(
  !/data-beasties-media|media="print"/.test(html),
  'Styles must not depend on inline activation scripts blocked by CSP.',
);
assert.ok(
  !/<script(?![^>]*\bsrc=)[^>]*>\s*[^<\s]/.test(html),
  'Production must not require inline scripts under script-src self.',
);
console.log('Production HTML loads CSS directly and needs no inline scripts.');
