// Gemeinsames Fallback-Verhalten für fehlende Übersetzungen — geteilt von
// allen drei i18n-Pfaden (Server-getT, Client-Provider, Request-Config).
//
// Ohne Fallback rendert next-intl bei einem fehlenden Key den rohen
// Key-String («GraphTable.caption») — das traf bis zu diesem Fix ausgerechnet
// den Screenreader-Fallback des Graphen in en/fr/it/ls. Neu fällt jeder
// fehlende Key sichtbar konsistent auf Deutsch zurück (de ist die
// Pflicht-Locale des Datenvertrags) und wird in der Konsole gemeldet.
//
// Der Fallback ist die zweite Verteidigungslinie: die erste ist der
// Paritäts-Test tests/messages-parity.test.mjs, der fehlende Keys schon
// in der CI meldet.

import { IntlErrorCode, type IntlError } from 'next-intl';
import de from '../messages/de.json';

function resolveFromDe(path: string): string | undefined {
  let node: unknown = de;
  for (const part of path.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

export function messageFallback({
  namespace,
  key,
}: {
  namespace?: string;
  key: string;
  error: IntlError;
}): string {
  const path = [namespace, key].filter(Boolean).join('.');
  return resolveFromDe(path) ?? path;
}

export function onI18nError(error: IntlError): void {
  if (error.code === IntlErrorCode.MISSING_MESSAGE) {
    // Fehlender Key: auf de zurückgefallen — loggen statt werfen, damit
    // die Seite nutzbar bleibt. Der Paritäts-Test fängt das in der CI.
    console.warn(`[i18n] ${error.message}`);
    return;
  }
  console.error(error);
}
