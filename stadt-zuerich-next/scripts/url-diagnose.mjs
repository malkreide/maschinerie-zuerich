#!/usr/bin/env node
// Diagnose einzelner URLs: DNS (lokal und öffentlich per DoH), HEAD- und
// GET-Weiterleitungskette, Zertifikat und die Einordnung, die der
// Link-Rot-Bericht vergeben würde.
//
// Gedacht für den manuellen Workflow `.github/workflows/url-diagnose.yml`:
// Meldet der Link-Rot-Bericht einen Netzfehler, zeigt dieser Lauf auf einem
// Runner mit offenem Netz, ob ein Prüfer- oder ein Datenfehler dahinter
// steckt (siehe docs/agent-lessons.md, B.10).
//
// Aufruf:
//   DIAGNOSE_URLS="https://a.ch/ https://b.ch/" node scripts/url-diagnose.mjs
//   node scripts/url-diagnose.mjs https://a.ch/ https://b.ch/
//
// Liest URLs nur aus der Umgebungsvariablen bzw. den Argumenten und prüft sie
// (http/https, höchstens 20). Schreibt den Bericht auf die Konsole und, in
// GitHub Actions, ins Job-Summary. Ändert nichts an den Daten.

import { appendFile } from 'node:fs/promises';
import { LINKCHECK_HEADERS } from './lib/link-probe.mjs';
import { berichtMarkdown, diagnose, parseUrls } from './lib/url-diagnose.mjs';

const eingabe = process.argv.length > 2 ? process.argv.slice(2).join(' ') : process.env.DIAGNOSE_URLS;
const { urls, abgelehnt } = parseUrls(eingabe);

if (!urls.length) {
  console.error('Keine gültige http(s)-URL angegeben.' + (abgelehnt.length ? ` Abgelehnt: ${abgelehnt.join(', ')}` : ''));
  process.exit(1);
}

const befunde = [];
for (const url of urls) befunde.push(await diagnose(url, { headers: LINKCHECK_HEADERS }));

const bericht = berichtMarkdown(befunde, abgelehnt);
console.log(bericht);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, bericht + '\n');
