# Good-First-Issues zum Copy-Paste

Anleitung: Pro Abschnitt Title, Labels und Body in github.com/malkreide/maschinerie-zuerich/issues/new eingeben. Labels ggf. vorher anlegen (Settings → Labels).

Empfohlene Labels (einmalig anlegen):
- `good first issue` (Farbe: `#7057ff`)
- `help wanted` (`#008672`)
- `i18n` (`#0e8a16`)
- `data` (`#fbca04`)
- `a11y` (`#d93f0b`)
- `enhancement` (`#a2eeef`)

---

## Issue 1

**Title:** Lebenslagen ins Französische übersetzen

**Labels:** `good first issue`, `help wanted`, `i18n`

**Body:**

Die Lebenslagen-Suche («Hund anmelden» → Steueramt) ist aktuell nur auf Deutsch verfügbar, obwohl die UI schon französisch bedienbar ist. 32 Anliegen sind in [`stadt-zuerich-next/data/manual/lebenslagen.json`](../stadt-zuerich-next/data/manual/lebenslagen.json) definiert.

### Umfang

Pro Eintrag die Felder `frage`, `stichworte`, `antwort` ins Französische übersetzen. Dafür schlage ich ein erweitertes Schema vor:

```json
{
  "id": "hund-anmelden",
  "zustaendig": "FD-st",
  "i18n": {
    "de": { "frage": "…", "stichworte": ["hund"], "antwort": "…" },
    "fr": { "frage": "Inscrire un chien", "stichworte": ["chien", "taxe"], "antwort": "…" }
  }
}
```

Der Loader und `searchLebenslagen()` müssten angepasst werden, damit sie `i18n[locale]` statt der Top-Level-Felder lesen. Fallback auf `de` wenn keine Übersetzung vorhanden.

### Akzeptanzkriterien

- [ ] Schema-Migration auf `i18n`-Feld dokumentiert und in `types/stadt.ts` gespiegelt
- [ ] `lib/search.ts` liest locale-abhängig
- [ ] Alle 32 Anliegen auf Französisch übersetzt (Schweizer Variante, wo sinnvoll)
- [ ] `/fr/anliegen?q=chien` zeigt sinnvolle Treffer

Offizielle Terminologie von stadt-zuerich.ch (FR-Version) als Referenz verwenden.

---

## Issue 2

**Title:** Lebenslagen ins Italienische übersetzen

**Labels:** `good first issue`, `help wanted`, `i18n`

**Body:**

Wie Issue #1, aber für `it`. Bitte erst nach dem Schema-Wechsel in Issue #1 beginnen, damit wir nur eine Migration haben.

### Umfang

- [ ] 32 Anliegen auf Italienisch übersetzen (Schweizer/Tessiner Variante, wo sinnvoll)
- [ ] `/it/anliegen?q=cane` zeigt sinnvolle Treffer

Referenz: italienischsprachige Behördenkommunikation des Kantons Tessin.

---

## Issue 3

**Title:** Leichte-Sprache-Review der UI-Texte

**Labels:** `help wanted`, `a11y`, `i18n`

**Body:**

Die Datei [`messages/ls.json`](../stadt-zuerich-next/messages/ls.json) enthält eine erste Version der UI in Leichter Sprache. Gesucht: Review und Korrektur durch eine Fachperson oder nach den offiziellen Inclusion-Handicap-Regeln.

### Was zu prüfen ist

- Sätze maximal 8–10 Wörter
- Aktive statt passive Formulierung
- Keine Fremdwörter; wenn unvermeidbar, erklären (z. B. «Amt (ein Teil der Stadt)»)
- Ein Gedanke pro Satz
- Wichtige Wörter durch Trennstriche («Stadt-Präsident»), nicht durch Gross-/Kleinschreibung

### Referenz

- [Inclusion Handicap — Leichte Sprache](https://www.inclusion-handicap.ch/de/themen/barrierefreiheit/)
- Netzwerk Leichte Sprache: [leichte-sprache.ch](https://www.leichte-sprache.ch/)

### Ergebnis

PR mit Korrekturen direkt in `messages/ls.json`. Bei grundsätzlichen Änderungen bitte kurz im Issue kommentieren.

---

## Issue 4

**Title:** 3–5 neue Lebenslagen hinzufügen

**Labels:** `good first issue`, `data`

**Body:**

Aktuell sind 32 Lebenslagen gemappt. Fehlend sind unter anderem:

- [ ] «Mieterstreitigkeit» → Schlichtungsstelle
- [ ] «Verloren/Gefunden» → Fundbüro (Stadtpolizei)
- [ ] «Velo stehlen lassen / Anzeige» → Stadtpolizei
- [ ] «Heiratsantrag Ausländerin/Ausländer» → Bevölkerungsamt
- [ ] «Kita-Gutschein» → Schulamt / Kindertagesstätten
- [ ] «Quartierverein finden» → Stadtentwicklung

### Vorgehen

1. In [`stadt-zuerich-next/data/manual/lebenslagen.json`](../stadt-zuerich-next/data/manual/lebenslagen.json) pro Anliegen einen neuen Eintrag anfügen:

   ```json
   {
     "id": "kurz-eindeutig",
     "frage": "Ganze Frage, Bürgerdeutsch",
     "stichworte": ["wort1", "wort2"],
     "zustaendig": "<unit-id aus data.json>",
     "antwort": "Ein-Satz-Antwort"
   }
   ```

2. `zustaendig` muss eine gültige Unit-ID aus `data.json` sein — das CI validiert das automatisch.

3. Nach dem PR: Test mit `npm run dev`, dann `http://localhost:3000/anliegen?q=<dein-stichwort>` öffnen.

### Akzeptanzkriterien

- [ ] 3–5 neue Einträge
- [ ] CI ist grün (unbekannte IDs werden abgelehnt)
- [ ] Stichworte sind klein, Singular, ohne Sonderzeichen

---

## Issue 5

**Title:** Locale-Detection über Accept-Language-Header aktivieren

**Labels:** `good first issue`, `i18n`, `enhancement`

**Body:**

Aktuell landet jede:r auf `/` (Deutsch), unabhängig von der Browser-Sprache. `next-intl` kann das erkennen: ein englischer Browser sollte automatisch auf `/en` weitergeleitet werden (beim allerersten Besuch, ohne gesetztes Cookie).

### Umfang

In [`stadt-zuerich-next/i18n/routing.ts`](../stadt-zuerich-next/i18n/routing.ts):

```diff
 export const routing = defineRouting({
   locales: ['de', 'en', 'fr', 'it', 'ls'] as const,
   defaultLocale: 'de',
   localePrefix: 'as-needed',
+  localeDetection: true,
 });
```

Dann im Middleware-Flow testen: Browser mit `Accept-Language: fr-CH,fr;q=0.9,de;q=0.5` sollte auf `/fr` landen.

### Akzeptanzkriterien

- [ ] `localeDetection: true` gesetzt
- [ ] Getestet mit curl: `curl -H "Accept-Language: en" https://<deployment> -I` zeigt `Location: /en`
- [ ] Dokumentiert im README unter «Internationalisierung»
- [ ] Cookie `NEXT_LOCALE` setzt die Wahl persistent — eine einmalige Locale-Umschaltung überschreibt die Accept-Language-Heuristik

---

## Issue 6

**Title:** Sitemap generieren für alle Sprachen und Routen

**Labels:** `enhancement`, `good first issue`

**Body:**

Für SEO braucht das Projekt eine `sitemap.xml`, die alle Kombinationen aus Locale × Route enthält:

```
/, /steuerfranken, /liste, /anliegen
/en, /en/steuerfranken, /en/liste, /en/anliegen
/fr, /fr/steuerfranken, ...
/it, /it/...
/ls, /ls/...
```

Mit Deep-Links pro Einheit optional (`/?focus=FD-st`, ...), aber dann wird die Sitemap schnell riesig.

### Umgang

Next.js hat native Sitemap-Unterstützung via [`app/sitemap.ts`](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap):

```ts
import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ['', '/steuerfranken', '/liste', '/anliegen'];
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://maschinerie-zuerich.vercel.app';

  return routing.locales.flatMap((locale) =>
    paths.map((p) => ({
      url: `${base}${locale === routing.defaultLocale ? '' : `/${locale}`}${p}`,
      changeFrequency: 'weekly' as const,
      priority: p === '' ? 1 : 0.7,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((l) => [
            l,
            `${base}${l === routing.defaultLocale ? '' : `/${l}`}${p}`,
          ]),
        ),
      },
    })),
  );
}
```

Plus `app/robots.ts` mit Referenz auf die Sitemap.

### Akzeptanzkriterien

- [ ] `app/sitemap.ts` + `app/robots.ts` angelegt
- [ ] `NEXT_PUBLIC_SITE_URL` dokumentiert im `stadt-zuerich-next/README.md`
- [ ] Nach Deployment: `https://<domain>/sitemap.xml` liefert validen Output
- [ ] Alternates-Attribute für jede Sprache gesetzt — Google versteht Canonical pro Sprache

---

## Issue 7

**Title:** Fehlende RPK-Institutionen ins Modell aufnehmen

**Labels:** `help wanted`, `data`

**Body:**

Beim Validieren gegen die Hauptrechnung 2025 (S. 30) wurde entdeckt, dass einige Institutionen in unserem Modell fehlen, was zu Proxy-Abweichungen führt:

| Departement | Proxy-FTE | Publiziert RE 2025 | Abweichung |
|-------------|----------:|-------------------:|-----------:|
| SD (Soziales) | 946 | 1 835 | **−48 %** |
| TED | 1 426 | 1 864 | −23 % |

Vermutete Mapping-Lücken in [`stadt-zuerich-next/data.json`](../stadt-zuerich-next/data.json):

- SEB — Soziale Einrichtungen und Betriebe (RPK-Key 5560)
- AZL — Amt für Zusatzleistungen zur AHV/IV (RPK-Key 5515)
- LBZ — Laufbahnzentrum (RPK-Key 5520)
- KEB — Kindes- und Erwachsenenschutzbehörde (RPK-Key 5530)
- SSD-Schulhäuser — einzelne Schulen (HPS, Viventa, etc.)

### Vorgehen

1. In `data.json` unter `units` neue Einträge anlegen:
   ```json
   {
     "id": "SD-seb",
     "parent": "SD",
     "name": "Soziale Einrichtungen und Betriebe",
     "kind": "unit"
   }
   ```
2. In `scripts/mapping/institution-mapping.json` das Mapping hinterlegen:
   ```json
   { "units": { "SD-seb": "SEB" } }
   ```
3. `cd stadt-zuerich-next && npm run data:fetch:force` laufen lassen
4. Proxy-Abweichung neu vergleichen

### Akzeptanzkriterien

- [ ] Alle genannten Institutionen im Modell
- [ ] SD-Proxy-Abweichung unter 15 %
- [ ] CI ist grün

---

## Issue 8

**Title:** Treemap-Tooltip via next/dynamic lazy-loaden

**Labels:** `enhancement`, `good first issue`

**Body:**

Die Treemap (`components/TreemapView.tsx`) importiert `d3-hierarchy` und `d3-scale` synchron beim Seitenaufruf. Das ist zwar klein (~15 KB gzipped), aber beim Wechsel auf die Startseite nicht nötig.

### Umfang

In [`stadt-zuerich-next/app/[locale]/steuerfranken/page.tsx`](../stadt-zuerich-next/app/[locale]/steuerfranken/page.tsx) TreemapView via `next/dynamic` laden:

```ts
import dynamic from 'next/dynamic';

const TreemapView = dynamic(() => import('@/components/TreemapView'), {
  ssr: false,  // d3 nutzt window-Metriken
  loading: () => <div className="p-4 text-sm text-[var(--color-mute)]">Lädt…</div>,
});
```

### Akzeptanzkriterien

- [ ] Lighthouse-Score der Startseite verbessert (weniger JS unterwegs zur Startseite)
- [ ] Treemap-Seite funktioniert weiterhin identisch
- [ ] Keine Hydration-Warnings in der Konsole
