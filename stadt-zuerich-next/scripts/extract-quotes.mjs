#!/usr/bin/env node
// Kandidaten-Belegstellen (source_quote) für References extrahieren — als
// VORSCHLAG zur menschlichen Prüfung.
//
// Zwei Bezugsmodi für den Seitentext:
//   • --fetch (Default-Empfehlung): HTTP-GET + HTML→Text, ohne Browser. Die
//     aktuellen stadt-zuerich.ch- und zh.ch-Seiten sind serverseitig gerendert
//     (SSR) — der zitierbare Text steht bereits im HTML. Läuft auch hinter dem
//     Agent-Egress-Proxy (der Chromium-Traffic nicht durchlässt).
//   • Browser (Default ohne --fetch): rendert mit Chromium/Playwright und liest
//     `document.body.innerText`. Nötig für echte JS-SPAs (z. B. ch.ch), wo der
//     Text erst clientseitig entsteht. Braucht offenen Egress + Chromium.
//
// WICHTIG — was dieses Skript NICHT tut:
//   • Es schreibt NICHTS in die Prozessdaten. Belegstellen für bindende Werte
//     (Fristen, Gebühren, …) sind die heikelste Stelle der ganzen Maschinerie
//     (Kardinalregel «Link, don't assert»). Das Skript liefert nur Kandidaten;
//     ein Mensch wählt das wörtliche Zitat und setzt status:"verifiziert".
//   • Es rät nichts: gibt eine Quelle keinen passenden Text her, sagt es das.
//
// Voraussetzungen:
//   • Netz-Egress zu den Quell-Domains. admin.ch (fedlex, Schweizer Pass) ist in
//     der Standardumgebung gesperrt — diese Quellen lokal/mit offener Policy.
//   • Nur Browser-Modus: Chromium (`npx playwright install chromium`).
//   • Hinter dem Agent-Proxy: --fetch nutzt Node-`fetch`; das Skript setzt
//     NODE_USE_ENV_PROXY=1, damit der Proxy verwendet wird (No-op ohne Proxy).
//
// Aufruf:
//   node scripts/extract-quotes.mjs [--fetch] [--city zh] [--file <pfad>]
//        [--only-unverified] [--all-refs] [--out <pfad>] [--json]
//        [--timeout 30000] [--concurrency 3]
//
//   --fetch            HTTP statt Browser (SSR-Seiten; proxy-tauglich)
//   --only-unverified  nur References ohne belegtes source_quote (Default: alle)
//   --all-refs         zusätzlich bereits verifizierte gegen die Live-Seite
//                      prüfen (Drift-/Re-Verifikations-Check)
//   --grep <regex>     nur Seiten-Segmente, die diesem Muster (i) entsprechen —
//                      nötig bei riesigen Einzelseiten (ganzes ZGB auf einer
//                      fedlex-Seite), z. B. --grep "Ehefähigkeit"
//   --file <pfad>      auf eine Prozessdatei beschränken
//   --json             Report als JSON statt Text
//   --out <pfad>       Report zusätzlich in Datei schreiben

// Proxy-Egress für Node-fetch (No-op, wenn kein HTTPS_PROXY gesetzt ist).
process.env.NODE_USE_ENV_PROXY ??= '1';

import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { htmlToText, normWs } from './lib/html-text.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

// ── Argumente ───────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};
const CITY = opt('--city', 'zh');
const ONLY_FILE = opt('--file', null);
const ONLY_UNVERIFIED = flag('--only-unverified');
const ALL_REFS = flag('--all-refs');
const AS_JSON = flag('--json');
const OUT = opt('--out', null);
const TIMEOUT = Number(opt('--timeout', '30000'));
const CONCURRENCY = Number(opt('--concurrency', '3'));
const FETCH_MODE = flag('--fetch');
const GREP = opt('--grep', null); // nur Segmente, die diesem Regex (i) entsprechen
const GREP_RE = GREP ? new RegExp(GREP, 'i') : null;

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/126.0 Safari/537.36 maschinerie-zuerich-quotes/1.0';

// ── Bindende-Werte-Muster (gespiegelt aus dem Kardinalregel-Lint) ───────────
// Ein Kandidat ist nur dann stark, wenn er eine bindende Angabe enthält — denn
// genau die soll laut Vertrag ausschliesslich im source_quote leben.
const UNIT = /(\bCHF\b|\bFr\.|\bFranken\b|%|\bProzent\b|\bTag(?:e|en)?\b|\bWoche(?:n)?\b|\bMonat(?:e|en)?\b|\bJahr(?:e|en)?\b)/i;
const NUMBER = /\d/;
const FRIST_CTX = /\b(Frist|innert|innerhalb|spätestens|binnen)\b/i;

const STOP = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des', 'und', 'oder', 'für', 'von', 'mit',
  'bei', 'nach', 'aus', 'auf', 'eine', 'einen', 'einem', 'eines', 'einer', 'ein',
  'im', 'in', 'zu', 'zur', 'zum', 'als', 'wie', 'auch', 'sowie', 'bzw', 'gegen',
  'über', 'unter', 'beim', 'dass', 'sich', 'ist', 'sind', 'werden', 'wird',
]);

function keywords(label) {
  return [...new Set(
    (label || '')
      .toLowerCase()
      .replace(/[^a-zäöüß0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 5 && !STOP.has(w)),
  )];
}

// Seitentext in prüfbare Segmente (Zeilen + Sätze) zerlegen.
// Satzgrenze = Satzzeichen + Whitespace, ABER nicht nach einer Ordinalzahl
// («30. Juni», «§ 3.») — sonst würden bindende Datums-/Fristangaben zerschnitten.
const SENT_SPLIT = /(?<=[.!?…])(?<![0-9].)\s+/;
function segments(text) {
  const out = [];
  for (const line of text.split(/\n+/)) {
    for (const sent of line.split(SENT_SPLIT)) {
      const s = normWs(sent);
      if (s.length >= 15 && s.length <= 400) out.push(s);
    }
  }
  return [...new Set(out)];
}

function bindingScore(seg) {
  let s = 0;
  if (NUMBER.test(seg) && UNIT.test(seg)) s += 3;
  if (NUMBER.test(seg) && FRIST_CTX.test(seg)) s += 2;
  return s;
}

function rankCandidates(pageText, label, topN = GREP_RE ? 8 : 3) {
  const kws = keywords(label);
  // --grep grenzt auf Segmente ein, die das Muster enthalten. Unverzichtbar bei
  // sehr grossen Einzelseiten (z. B. das ganze ZGB auf einer fedlex-Seite), wo
  // das Stichwort-Ranking sonst von gleichgewichtigen Treffern anderer Artikel
  // überlagert wird — dann gezielt z. B. --grep "Ehefähigkeit".
  const segs = GREP_RE ? segments(pageText).filter((s) => GREP_RE.test(s)) : segments(pageText);
  const scored = segs.map((seg) => {
    const low = seg.toLowerCase();
    const overlap = kws.filter((k) => low.includes(k)).length;
    return { seg, score: overlap * 2 + bindingScore(seg), overlap, binding: bindingScore(seg) > 0 };
  });
  // Priorisiere: Stichwort-Treffer UND bindende Angabe; dann der Rest. Bei
  // aktivem --grep hat der Mensch die Relevanz schon vorgegeben → auch
  // Segmente ohne Score zeigen (nach Reihenfolge im Dokument).
  return scored
    .filter((c) => GREP_RE || c.score > 0)
    .sort((a, b) => b.score - a.score || a.seg.length - b.seg.length)
    .slice(0, topN);
}

// ── Datenmodell laden ───────────────────────────────────────────────────────
async function loadProcesses() {
  const dir = path.join(root, 'data/prozesse', CITY);
  let files;
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
  } catch {
    console.error(`Kein Verzeichnis data/prozesse/${CITY}`);
    process.exit(1);
  }
  if (ONLY_FILE) {
    const base = path.basename(ONLY_FILE);
    files = files.filter((f) => f === base);
  }
  const out = [];
  for (const f of files) {
    const rel = `data/prozesse/${CITY}/${f}`;
    const data = JSON.parse(await readFile(path.join(root, rel), 'utf-8'));
    out.push({ rel, data });
  }
  return out;
}

// Sammelt zu prüfende Referenz-Einträge.
function collectRefs(processes) {
  const items = [];
  for (const { rel, data } of processes) {
    for (const r of data.references ?? []) {
      const hasQuote = typeof r.source_quote === 'string' && r.source_quote.trim().length > 0;
      const verified = (r.status ?? 'verifiziert') === 'verifiziert';
      if (ONLY_UNVERIFIED && hasQuote) continue;
      if (!ALL_REFS && hasQuote && verified) continue; // schon belegt → nur mit --all-refs prüfen
      items.push({
        rel,
        reference_id: r.reference_id,
        label: r.label?.de ?? '',
        url: r.source_url,
        existingQuote: hasQuote ? r.source_quote : '',
        status: r.status ?? '(none)',
      });
    }
  }
  return items;
}

// ── HTTP-Fetch (SSR, kein Browser) ──────────────────────────────────────────
// HTML→Text-Konvertierung in scripts/lib/html-text.mjs (geteilt mit dem
// Referenzen-Gate check-refs-gate.mjs).

async function fetchPages(urls) {
  const cache = new Map();
  const list = [...urls];
  let i = 0;
  async function worker() {
    while (i < list.length) {
      const url = list[i++];
      try {
        const res = await fetch(url, {
          headers: { 'user-agent': UA, 'accept-language': 'de-CH,de;q=0.9' },
          redirect: 'follow',
          signal: AbortSignal.timeout(TIMEOUT),
        });
        const html = await res.text();
        const text = htmlToText(html);
        cache.set(url, { ok: res.status < 400 && text.length > 0, status: res.status, text });
      } catch (err) {
        cache.set(url, { ok: false, status: 0, text: '', error: err.message.split('\n')[0] });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length) }, worker));
  return cache;
}

// ── Browser-Rendering ───────────────────────────────────────────────────────
async function renderPages(urls) {
  let chromium;
  try {
    ({ chromium } = await import('@playwright/test'));
  } catch {
    console.error('Playwright nicht gefunden. Installieren: npm i -D @playwright/test && npx playwright install chromium (oder --fetch verwenden)');
    process.exit(1);
  }
  const cache = new Map(); // url -> { ok, text, error }
  let browser;
  try {
    browser = await chromium.launch();
  } catch (err) {
    console.error(
      'Chromium konnte nicht starten. Browser installieren: npx playwright install chromium\n' +
        `Original: ${err.message}`,
    );
    process.exit(1);
  }
  const list = [...urls];
  let i = 0;
  async function worker() {
    // ignoreHTTPSErrors: nur öffentliche Seiten werden gelesen, nichts gesendet.
    // Lässt das Skript zudem hinter TLS-abfangenden Egress-Proxys laufen, deren
    // CA Chromium sonst als ERR_CERT_AUTHORITY_INVALID ablehnt.
    const ctx = await browser.newContext({ locale: 'de-CH', ignoreHTTPSErrors: true });
    while (i < list.length) {
      const url = list[i++];
      const page = await ctx.newPage();
      try {
        const res = await page.goto(url, { waitUntil: 'networkidle', timeout: TIMEOUT });
        const status = res ? res.status() : 0;
        // kurze Nachladezeit für client-gerenderte Inhalte
        await page.waitForTimeout(800).catch(() => {});
        const text = await page.evaluate(() => document.body?.innerText ?? '');
        cache.set(url, { ok: status < 400 && text.length > 0, status, text });
      } catch (err) {
        cache.set(url, { ok: false, status: 0, text: '', error: err.message.split('\n')[0] });
      } finally {
        await page.close().catch(() => {});
      }
    }
    await ctx.close().catch(() => {});
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length) }, worker));
  await browser.close().catch(() => {});
  return cache;
}

// ── Lauf ────────────────────────────────────────────────────────────────────
const processes = await loadProcesses();
const refs = collectRefs(processes);

if (!refs.length) {
  console.log('Keine passenden References gefunden (ggf. ohne --only-unverified erneut versuchen).');
  process.exit(0);
}

const uniqueUrls = [...new Set(refs.map((r) => r.url).filter(Boolean))];
console.error(
  `${FETCH_MODE ? 'Hole (HTTP)' : 'Rendere (Browser)'} ${uniqueUrls.length} Quell-URL(s) für ${refs.length} Reference(s) …`,
);
const pages = FETCH_MODE ? await fetchPages(uniqueUrls) : await renderPages(uniqueUrls);

const report = [];
for (const r of refs) {
  const page = pages.get(r.url);
  const entry = {
    file: r.rel,
    reference_id: r.reference_id,
    status: r.status,
    label: r.label,
    url: r.url,
    fetch: page?.ok ? `ok (${page.status}, ${page.text.length} Zeichen)` : `FEHLGESCHLAGEN (${page?.status ?? '–'}${page?.error ? ', ' + page.error : ''})`,
    existingQuote: r.existingQuote || null,
    existingQuoteFoundVerbatim: null,
    candidates: [],
  };
  if (page?.ok) {
    if (r.existingQuote) {
      entry.existingQuoteFoundVerbatim = normWs(page.text).includes(normWs(r.existingQuote));
    }
    entry.candidates = rankCandidates(page.text, r.label).map((c) => c.seg);
  }
  report.push(entry);
}

// ── Ausgabe ─────────────────────────────────────────────────────────────────
function renderText(rep) {
  const lines = [];
  lines.push(`# Belegstellen-Kandidaten (Vorschlag — vom Menschen zu prüfen)\n`);
  lines.push(`Stadt: ${CITY} · References: ${rep.length} · ${new Date().toISOString?.() ?? ''}`.trim());
  lines.push('');
  lines.push('> Kein Wert wird in die Daten geschrieben. Wähle ein WÖRTLICHES Zitat von');
  lines.push('> der verlinkten Seite, trage es als source_quote ein und setze status:"verifiziert".');
  lines.push('');
  for (const e of rep) {
    lines.push(`## ${e.file} — ref ${e.reference_id} [${e.status}]`);
    lines.push(`label.de: ${e.label}`);
    lines.push(`url:      ${e.url}`);
    lines.push(`fetch:    ${e.fetch}`);
    if (e.existingQuote) {
      lines.push(`vorhandenes source_quote: «${e.existingQuote}»`);
      lines.push(`  → verbatim auf der Live-Seite gefunden: ${e.existingQuoteFoundVerbatim ? 'JA' : 'NEIN (Drift prüfen!)'}`);
    }
    if (e.candidates.length) {
      lines.push('Kandidaten:');
      e.candidates.forEach((c, k) => lines.push(`  ${k + 1}) «${c}»`));
    } else if (e.fetch.startsWith('ok')) {
      lines.push('Kandidaten: keine bindende Passage gefunden — Seite manuell prüfen.');
    }
    lines.push('');
  }
  return lines.join('\n');
}

const rendered = AS_JSON ? JSON.stringify(report, null, 2) : renderText(report);
console.log(rendered);
if (OUT) {
  await writeFile(path.resolve(OUT), rendered);
  console.error(`\nReport geschrieben: ${OUT}`);
}

const failed = report.filter((e) => !e.fetch.startsWith('ok')).length;
console.error(
  `\nFertig: ${report.length - failed}/${report.length} Quellen gerendert` +
    (failed ? ` · ${failed} fehlgeschlagen (Netzpolicy/Block?).` : '.'),
);
