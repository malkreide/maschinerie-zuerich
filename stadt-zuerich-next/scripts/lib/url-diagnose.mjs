// Einzeldiagnose von URLs für den Workflow `url-diagnose.yml`.
//
// Warum: Der Link-Rot-Bericht meldet nur die Einordnung (ok / tot /
// blockiert / Netzfehler). Ob dahinter ein Prüfer- oder ein Datenfehler
// steckt, zeigte sich am 13.10.2026 erst beim Nachstellen auf einem Runner
// mit offenem Netz: www.amicus.ch lief auf HEAD in eine Weiterleitungs-
// schleife, www.eumzugch.ch hatte keinen DNS-Eintrag. Dieses Modul stellt
// dieselben Schritte fest zusammen, statt sie jedes Mal in einem Probe-Branch
// von Hand zu schreiben.
//
// Die Eingabe sind ausschliesslich URLs. Sie wird hier geprüft, nie an eine
// Shell weitergegeben.

import { probeUrl, domainUnbekannt, fehlerGrund } from './link-probe.mjs';

export const MAX_URLS = 20;
const URL_FORM = /^https?:\/\/[^\s"'`<>\\]+$/;

/**
 * Zerlegt die Workflow-Eingabe (Leerzeichen, Komma oder Zeilenumbruch
 * getrennt) in gültige http(s)-URLs.
 * @returns {{ urls: string[], abgelehnt: string[] }}
 */
export function parseUrls(eingabe) {
  const urls = [];
  const abgelehnt = [];
  for (const teil of String(eingabe ?? '').split(/[\s,]+/).filter(Boolean)) {
    let ok = URL_FORM.test(teil);
    if (ok) {
      try {
        const u = new URL(teil);
        ok = (u.protocol === 'https:' || u.protocol === 'http:') && Boolean(u.hostname);
      } catch {
        ok = false;
      }
    }
    if (ok && !urls.includes(teil)) urls.push(teil);
    else if (!ok) abgelehnt.push(teil);
  }
  if (urls.length > MAX_URLS) abgelehnt.push(...urls.splice(MAX_URLS).map((u) => `${u} (mehr als ${MAX_URLS})`));
  return { urls, abgelehnt };
}

/**
 * Folgt Weiterleitungen Sprung für Sprung (redirect: 'manual'), damit
 * Schleifen und Ziele sichtbar werden.
 * @returns {Promise<{ spruenge: { url: string, status: number }[], ende: 'ok'|'schleife'|'zu-viele'|'fehler', grund?: string, ms: number }>}
 */
export async function verfolgeWeiterleitungen(url, { method = 'GET', fetch: doFetch = fetch, headers = {}, maxSpruenge = 10, timeoutMs = 15000 } = {}) {
  const start = Date.now();
  const spruenge = [];
  const gesehen = new Set();
  let aktuell = url;
  try {
    for (let i = 0; i <= maxSpruenge; i++) {
      if (gesehen.has(aktuell)) return { spruenge, ende: 'schleife', ms: Date.now() - start };
      gesehen.add(aktuell);
      const res = await doFetch(aktuell, { method, headers, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
      await res.body?.cancel();
      spruenge.push({ url: aktuell, status: res.status });
      const ziel = res.headers.get('location');
      if (res.status < 300 || res.status >= 400 || !ziel) return { spruenge, ende: 'ok', ms: Date.now() - start };
      aktuell = new URL(ziel, aktuell).href;
    }
    return { spruenge, ende: 'zu-viele', ms: Date.now() - start };
  } catch (err) {
    return { spruenge, ende: 'fehler', grund: fehlerGrund(err), ms: Date.now() - start };
  }
}

/** Zertifikat des Hosts (nur https). */
export async function zertifikat(host, { timeoutMs = 10000 } = {}) {
  const tls = await import('node:tls');
  return new Promise((resolve) => {
    const sock = tls.connect({ host, port: 443, servername: host, timeout: timeoutMs }, () => {
      const c = sock.getPeerCertificate();
      resolve({
        gueltig: sock.authorized,
        fehler: sock.authorizationError ? String(sock.authorizationError) : undefined,
        subjekt: c?.subject?.O ? `${c.subject.CN} (${c.subject.O})` : c?.subject?.CN,
        aussteller: c?.issuer?.O ?? c?.issuer?.CN,
        bis: c?.valid_to,
      });
      sock.end();
    });
    sock.on('timeout', () => (sock.destroy(), resolve({ gueltig: false, fehler: 'Timeout' })));
    sock.on('error', (e) => resolve({ gueltig: false, fehler: e.code ?? e.message }));
  });
}

/** DNS über den Resolver der Umgebung: A/AAAA/CNAME oder Fehlercode. */
export async function dnsLokal(host) {
  const dns = await import('node:dns/promises');
  const abfrage = (fn) => fn(host).catch((e) => e.code ?? 'Fehler');
  const [a, aaaa, cname] = await Promise.all([abfrage(dns.resolve4), abfrage(dns.resolve6), abfrage(dns.resolveCname)]);
  return { a, aaaa, cname };
}

/** Vollständige Diagnose einer URL. Abhängigkeiten sind für Tests ersetzbar. */
export async function diagnose(url, deps = {}) {
  const { fetch: doFetch = fetch, headers = {} } = deps;
  const host = new URL(url).hostname;
  const [dns, nxdomain, head, get, einordnung, tls] = await Promise.all([
    (deps.dnsLokal ?? dnsLokal)(host),
    (deps.domainUnbekannt ?? domainUnbekannt)(host, { fetch: doFetch }),
    verfolgeWeiterleitungen(url, { method: 'HEAD', fetch: doFetch, headers }),
    verfolgeWeiterleitungen(url, { method: 'GET', fetch: doFetch, headers }),
    probeUrl(url, { fetch: doFetch, headers }),
    url.startsWith('https:') ? (deps.zertifikat ?? zertifikat)(host) : Promise.resolve(null),
  ]);
  if (einordnung.reason === 'ENOTFOUND' && nxdomain === true) {
    Object.assign(einordnung, { kind: 'tot', reason: 'Domain unbekannt (NXDOMAIN)' });
  }
  return { url, host, dns, nxdomain, head, get, einordnung, tls };
}

const fmtListe = (v) => (Array.isArray(v) ? (v.length ? v.join(', ') : '–') : v);
const fmtKette = (k) => {
  const pfad = k.spruenge.map((s) => `${s.status} ${s.url}`).join(' → ') || '–';
  const ende = { ok: '', schleife: ' → **Schleife**', 'zu-viele': ' → **zu viele Weiterleitungen**', fehler: ` → **Fehler: ${k.grund}**` }[k.ende];
  return `${pfad}${ende} (${k.ms} ms)`;
};
const NX = { true: 'NXDOMAIN (Domain existiert nicht)', false: 'existiert', null: 'nicht prüfbar' };

/**
 * Inline-Code für Markdown, auch wenn der Text selbst Backticks enthält
 * (abgelehnte Eingaben wie `whoami`): Der Zaun ist einen Backtick länger als
 * die längste Folge im Text; beginnt oder endet der Text mit einem Backtick,
 * trennt je ein Leerzeichen (CommonMark entfernt es beim Rendern).
 */
export function inlineCode(text) {
  const s = String(text);
  const laengste = Math.max(0, ...(s.match(/`+/g) ?? []).map((f) => f.length));
  const zaun = '`'.repeat(laengste + 1);
  const rand = s.startsWith('`') || s.endsWith('`') ? ' ' : '';
  return `${zaun}${rand}${s}${rand}${zaun}`;
}

/** Bericht als Markdown (Job-Summary und Konsole). */
export function berichtMarkdown(befunde, abgelehnt = []) {
  const zeilen = ['## URL-Diagnose', ''];
  if (abgelehnt.length) zeilen.push(`Abgelehnte Eingaben (keine http(s)-URL): ${abgelehnt.map(inlineCode).join(', ')}`, '');
  for (const b of befunde) {
    const e = b.einordnung;
    zeilen.push(
      `### ${b.url}`,
      '',
      `- **Einordnung (wie Link-Rot):** ${e.kind}${e.status ? ` [${e.status}]` : ''}${e.reason ? ` — ${e.reason}` : ''}`,
      `- **DNS lokal:** A ${fmtListe(b.dns.a)} · AAAA ${fmtListe(b.dns.aaaa)} · CNAME ${fmtListe(b.dns.cname)}`,
      `- **DNS öffentlich (DoH):** ${NX[String(b.nxdomain)]}`,
      `- **HEAD:** ${fmtKette(b.head)}`,
      `- **GET:** ${fmtKette(b.get)}`,
      `- **Zertifikat:** ${
        b.tls === null
          ? '– (http)'
          : b.tls.fehler && !b.tls.subjekt
            ? `Fehler: ${b.tls.fehler}`
            : `${b.tls.gueltig ? 'gültig' : `ungültig (${b.tls.fehler})`} · ${b.tls.subjekt} · Aussteller ${b.tls.aussteller} · bis ${b.tls.bis}`
      }`,
      '',
    );
  }
  return zeilen.join('\n');
}
