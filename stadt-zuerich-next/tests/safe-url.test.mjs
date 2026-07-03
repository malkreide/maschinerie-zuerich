// Unit-Tests für lib/safe-url.ts — den Laufzeitschutz aller datengetriebenen
// hrefs (Prozess-References, legal_basis, sources, RIS-Links).
//
// Lauf: node --experimental-strip-types --test tests/safe-url.test.mjs
// (npm run test:unit). lib/safe-url.ts hat keine Imports, daher genügt
// Node-Type-Stripping ohne Pfad-Alias-Auflösung.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeUrl } from '../lib/safe-url.ts';

test('erlaubt https- und http-URLs unverändert', () => {
  assert.equal(
    safeUrl('https://www.stadt-zuerich.ch/de/planen-und-bauen.html'),
    'https://www.stadt-zuerich.ch/de/planen-und-bauen.html',
  );
  assert.equal(safeUrl('http://example.org/x?y=1#z'), 'http://example.org/x?y=1#z');
});

test('erlaubt same-origin-relative Pfade', () => {
  assert.equal(safeUrl('/de/?focus=FD-st'), '/de/?focus=FD-st');
});

test('blockiert javascript:-, data:- und andere Schemas', () => {
  assert.equal(safeUrl('javascript:alert(1)'), undefined);
  assert.equal(safeUrl('JavaScript:alert(1)'), undefined);
  assert.equal(safeUrl(' javascript:alert(1)'), undefined);
  assert.equal(safeUrl('data:text/html,<script>alert(1)</script>'), undefined);
  assert.equal(safeUrl('vbscript:msgbox'), undefined);
  assert.equal(safeUrl('file:///etc/passwd'), undefined);
  assert.equal(safeUrl('ftp://example.org'), undefined);
});

test('blockiert protokoll-relative URLs (fremde Origin)', () => {
  assert.equal(safeUrl('//evil.example/pfad'), undefined);
});

test('blockiert Nicht-URLs, Leeres und fehlende Werte', () => {
  assert.equal(safeUrl(''), undefined);
  assert.equal(safeUrl('   '), undefined);
  assert.equal(safeUrl(undefined), undefined);
  assert.equal(safeUrl(null), undefined);
  assert.equal(safeUrl('kein-schema-kein-pfad'), undefined);
});

test('trimmt Whitespace um gültige URLs', () => {
  assert.equal(safeUrl('  https://example.org  '), 'https://example.org');
});
