# Plan: Ansicht «Belege & Herkunft»

**Status:** Entscheide getroffen (2026-10-25, Maintainer): E1 öffentlich,
E2–E7 gemäss Empfehlung, siehe [Abschnitt 9](#9-entscheide-maintainer).
Umgesetzt: P1 (Belege-Aggregat mit Drift-Gate), P2 (Route `/belege` mit
Kennzahlen, Belegmatrix, Prüfkette und Methodik) und P3 (Wochenbefund per
Bot-PR, Anzeige auf `/belege`) und P4 (Herkunft als `meta.herkunft`,
Vertrag 0.2.0, Spalte «Herkunft» auf `/belege`). P5 folgt.

> **Kardinalregel bleibt:** Die Ansicht zeigt, *dass* und *wie* bindende
> Angaben belegt sind, nie den bindenden Wert selbst. Zitate (`source_quote`)
> bleiben auf der Prozess-Detailseite. Hier erscheinen nur Status, Datum,
> Quelle und Deep-Link.

---

## 1. Ziel und Abgrenzung

**Ziel:** Sichtbar machen, wie vertrauenswürdig die Prozessdaten sind: welche
bindenden Angaben wie belegt sind, welche Prüfungen sie durchlaufen, woher sie
stammen (Handdaten oder tessera) und was sich zuletzt geändert hat.

Das Argument dahinter: Nicht «KI erstellt Prozesse», sondern «jede maschinell
erzeugte Aussage ist belegt und von einem Menschen freigegeben, und hier ist
der Nachweis».

**Zielgruppen**

1. Fachpublikum: KI-Fachgruppe der Stadtverwaltung, Fachstellen, Review.
2. Interessierte Öffentlichkeit, Medien, andere Städte (Übertragbarkeit).
3. Nicht primär: Bürger:innen mitten in einem Anliegen. Für sie bleibt die
   Prozess-Detailseite der Ort; sie erhält nur einen Link hierher.

**Abgrenzung zu bestehenden Ansichten**

| Ansicht | Frage | bleibt dort |
|---|---|---|
| `/portfolio` | Wie digital und nutzendenorientiert sind die Verfahren? | Indikatoren-Heatmap |
| `/wirkung` | Wie reif und komplex sind die Verfahren? | Reifegrad, Komplexität, **Sprachabdeckung** |
| `/roadmap` | Was wird aus Rückmeldungen? | Feedback-Status |
| **`/belege` (neu)** | **Wie belastbar sind die Daten selbst?** | Belegkette, Prüfungen, Herkunft, Änderungen |

Keine Doppelung: Sprachabdeckung und Reifegrad werden hier nicht noch einmal
gezeigt.

**Inspiration und was bewusst nicht übernommen wird:** Die Idee stammt aus
einem öffentlichen Forschungs-Dashboard (DiscoveryRSI von PhAI Labs). Dort
macht eine Prüfkette sichtbar, dass nur menschlich freigegebene Datensätze die
öffentliche Grenze passieren, und Aussagen werden mit ihrem Beleg verknüpft.
Übernommen werden **nur diese Konzepte**, keine Gestaltung, kein Code, keine
Grafiken. Bewusst **nicht** übernommen werden: animierte oder simulierte
Verläufe, Ranglisten, Live-Inszenierung, Tracking-Skripte, ein auf feste
Breite skaliertes Layout und Farbe als alleiniger Code.

---

## 2. Ausgangslage (Bestandsaufnahme 2026-10-25)

| Bereich | Befund |
|---|---|
| Prozesse | 17 Prozesse (`data/prozesse/zh/`), 211 Schritte, 3 Hochrisiko-Verfahren (`baugesuch`, `sozialhilfe`, `veranstaltung`) |
| References | 75 bindende References, **alle** `verifiziert` mit nicht-leerem `source_quote` |
| Bewertungs-Belege | 12 Indikatoren mit Beleg, alle `verifiziert` |
| Weitere Quellen | 35 Einträge in `sources[]` |
| Belege nach Herkunfts-Host | stadt-zuerich.ch 60 · zh.ch 5 · ch.ch 4 · fedlex 2 · zvv.ch 2 · notes.zh.ch 1 · ewz.ch 1 |
| PR-Gates (CI) | `validate:prozesse`, `check:regression`, `check:refs` (live, nur geänderte References), `check:links` (strukturell), `check:portfolio` |
| Wochenlauf | `.github/workflows/link-rot.yml`: Live-Links, Zitat-Drift, Abgleich der Gesetzesfassung. Advisory; der Befund landet **nur als Text im Job-Summary**, ist weder maschinenlesbar noch versioniert |
| Herkunft Hand/tessera | **Nirgends erfasst.** tessera-v1-PRs wurden unter dem Konto des Maintainers gemergt, Commits sind nicht unterscheidbar. Der Clone in CI/Vercel ist flach (50 Commits): Herkunft lässt sich aus Git nicht verlässlich ableiten |
| `meta.aktualisiert` | In **12 von 17** Prozessen älter als der jüngste Abruf einer Reference. Taugt nicht als «zuletzt geprüft» |
| Datenvertrag | Abschnitt «Herkunft & Pflege» sagt noch «von Hand geschrieben (kein Scraping, …)». Seit tessera v1 stimmt das nicht mehr vollständig |

**Lücken, die dieser Plan schliesst**

- **L1:** Die Belegkette ist nicht als Ganzes sichtbar, nur Prozess für Prozess.
- **L2:** Die Wochenbefunde sind nicht maschinenlesbar und nicht versioniert.
- **L3:** Die Herkunft (Hand oder tessera) ist nicht erfasst.
- **L4:** Änderungen an Prozessdaten sind nur im Git-Log nachvollziehbar.

---

## 3. Grundsätze (nicht verhandelbar)

1. **Link, don't assert.** Kein bindender Wert, auch nicht im Aggregat. Die
   Ansicht verlinkt auf die Referenzen der Detailseite
   (`/prozesse/<city>/<id>#referenzen-heading`).
2. **Belegt heisst nicht richtig.** Die Wortwahl lautet «wörtlich belegt» und
   «erreichbar», nie «korrekt» oder «geprüft richtig». Ein Abschnitt
   «Methodik & Grenzen» ist Pflicht, inklusive der bekannten Grenzen: Soft-404,
   JS-Seiten und Bot-Sperren (siehe Kopfkommentar von
   `scripts/check-links.mjs`).
3. **«Blockiert» ist nicht «tot».** Bot-Schutz, Rate-Limits und
   Netzwerkfehler hängen von der Umgebung ab und werden nie als toter Link
   dargestellt. Die Taxonomie aus `check-links.mjs` wird übernommen.
4. **Unbekannt bleibt unbekannt.** «Nicht erhoben» oder «nicht prüfbar» ist
   eine eigene, schraffierte Kategorie, nie 0 und nie «nicht erfüllt»
   (gleiches Prinzip wie `PortfolioHeatmap`).
5. **Determinismus.** Das Aggregat der Ebene 1 ist bit-identisch und ohne
   Zeitstempel, abgesichert durch ein CI-Drift-Gate (Muster
   `check:portfolio`).
6. **Barrierefrei und leicht.** Server-gerendert und ohne Client-JS nutzbar,
   Bundle-Budget unverändert. WCAG 2.1 AA, Farbe nie alleinige Information,
   fünf Sprachen inklusive Leichter Sprache.
7. **Datensparsam.** Kein Tracking. Keine Autor:innen- oder Reviewer-Namen,
   nur Rollen und Daten (gleiches Prinzip wie `lib/roadmap.ts`).
8. **Keine Inszenierung.** Kein «live», keine Animation, keine simulierten
   Verläufe, keine Ranglisten von Verfahren oder Verwaltungseinheiten.
   Prozesse erscheinen alphabetisch. Es heisst «Stand: <Datum>», nicht «live».

---

## 4. Architektur: vier Datenebenen

Die Ebenen sind getrennt, weil sie unterschiedlich verlässlich und
reproduzierbar sind. Live-Ergebnisse aus dem Netz dürfen nicht in das
deterministische Aggregat: Die CI läuft netzfrei, und das Drift-Gate würde
sonst bei jeder Netzschwankung rot.

| Ebene | Inhalt | Quelle | Erzeugung | Speicherort | Gate |
|---|---|---|---|---|---|
| **1 Belegkette** | Status der References, Quellen-Host und -Ebene, Abrufdaten, Hochrisiko | Prozess-JSONs | `npm run build:belege` | `data/belege/<city>.json` | `check:belege` (CI, Drift) |
| **2 Wochenbefund** | Erreichbarkeit, Zitat-Drift, Gesetzesfassung je Reference | Live-HTTP | `link-rot.yml` → `build:befunde` | `data/befunde/<city>.json` | Schema-Validierung; Aktualisierung per Bot-PR, Merge durch einen Menschen |
| **3 Herkunft** | Hand, tessera oder gemischt; tessera-PRs; Datum der letzten inhaltlichen Prüfung | `meta.herkunft` (neu) | von Hand bzw. durch tessera im PR | Prozessdatei | `validate:prozesse` |
| **4 Änderungen** | gemergte Änderungen an Prozessdaten | GitHub-API (Commits mit Pfadfilter) | zur Laufzeit, ISR 300 s | nicht persistiert | Unit-Test des Mappers |

Die View kombiniert die Ebenen und rechnet selbst nichts ab. Titel und Labels
werden wie beim Portfolio über den Prozess-Index dazugejoint; die einzige
Quelle dafür bleibt die Prozessdatei.

---

## 5. Datenmodell

### 5.1 Ebene 1: Belegkette (`lib/belege.ts`)

Eigenständig gehalten, nur type-only Imports, exakt wie `lib/portfolio.ts`.
So bleibt die Funktion mit `node --test` und Type-Stripping testbar.

```ts
/** Schema-Version des Aggregats (rein abgeleitet, unabhängig vom
 *  Prozess-Datenvertrag). MAJOR-Bump bei Strukturänderung. */
export const BELEGE_SCHEMA_VERSION = '1.1.0'; // 1.1.0: url je Reference (P3)

/** Staatsebene der Quelle, abgeleitet aus dem Host über eine Konfiguration
 *  (config/quellen-ebenen.json), nie geraten: unbekannte Hosts → 'andere'. */
export type QuellenEbene = 'stadt' | 'kanton' | 'bund' | 'andere';

export type ReferenzStatus = 'verifiziert' | 'unverifiziert';

/** Eine bindende Reference, ohne Label und ohne Zitat (Single Source und
 *  Kardinalregel: der Text bleibt in der Prozessdatei). */
export interface BelegReferenz {
  reference_id: number;
  status: ReferenzStatus;
  /** nicht-leeres source_quote vorhanden */
  mitZitat: boolean;
  /** source_url (seit 1.1.0, für den Join mit dem Wochenbefund) */
  url: string;
  /** Host der source_url, z. B. "www.stadt-zuerich.ch" */
  host: string;
  ebene: QuellenEbene;
  /** verlinkt das PDF einer Gesetzesfassung (fedlex/ZHlex); offline
   *  erkannt über erkenneFassung() aus scripts/lib/gesetzesfassung.mjs */
  gesetzesfassung: boolean;
  /** ISO-Datum des Abrufs */
  retrieved_at: string;
}

/** Eine Zeile = ein Prozess. */
export interface BelegZeile {
  slug: string; // city/id
  city: string;
  id: string;
  /** disclaimer_key === 'Prozesse.disclaimerHochrisiko' */
  hochrisiko: boolean;
  referenzen: BelegReferenz[];
  summe: {
    referenzen: number;
    verifiziert: number;
    mitZitat: number;
    unverifiziert: number;
  };
  /** bewertung.indikatoren[] mit Beleg (gleiches Grounding-Gate) */
  bewertungsBelege: { gesamt: number; verifiziert: number };
  quellen: number;          // sources[].length
  rechtsgrundlagen: number; // legal_basis[].length
  /** ältester/jüngster retrieved_at über alle References; null ohne References.
   *  Bewusst KEIN Alter in Tagen: das hinge vom Erzeugungstag ab und bräche
   *  die Bit-Identität. Das Alter rechnet die View beim Rendern. */
  abruf: { aeltester: string | null; juengster: string | null };
}

export interface Belege {
  schema_version: string;
  city: string;
  /** Herkunfts-Hinweis: rein abgeleitet, nicht von Hand pflegen. */
  generator: string;
  prozesse: BelegZeile[]; // stabil sortiert nach slug
  summary: {
    prozesse: number;
    referenzen: number;
    verifiziert: number;
    mitZitat: number;
    hochrisiko: number;
    nachEbene: Record<QuellenEbene, number>;
  };
}

export interface BelegeOptionen {
  /** Host-Listen je Ebene, für die Stadt aufgelöst */
  regeln: { stadt: string[]; kanton: string[]; bund: string[] };
  /** Erkennung von Gesetzes-PDFs; im Generator erkenneFassung() aus
   *  scripts/lib/gesetzesfassung.mjs (hereingereicht statt dupliziert) */
  istGesetzesfassung: (url: string) => boolean;
}

/** Rein und deterministisch; serializeBelege() analog serializePortfolio(). */
export function buildBelege(city: string, prozesse: Prozess[], opts: BelegeOptionen): Belege;
```

**Host-Liste (`config/quellen-ebenen.json`):** `bund` gilt für alle Städte,
`stadt` und `kanton` je Stadt. Ein Eintrag deckt die Domain und alle
Subdomains ab, verglichen an der Label-Grenze (`notzh.ch` ist keine Subdomain
von `zh.ch`). Bei mehreren Treffern gewinnt die längste Domain. Der Generator
listet Hosts, die in `andere` landen, damit neue Quellen bewusst eingeordnet
werden.

> **Umgesetzt anders als im ersten Entwurf:** Ein Zähler
> `hochrisikoMitHinweis` entfällt. `validate:prozesse` erzwingt, dass genau
> die gelisteten Hochrisiko-Fälle den Hinweis tragen; der Zähler wäre also
> immer gleich `hochrisiko`. Die View kann diese Regel als Text nennen.

### 5.2 Ebene 2: Wochenbefund (`data/befunde/<city>.json`)

Ein Snapshot. Ein Zeitstempel ist hier erlaubt und nötig, weil der Befund
nicht abgeleitet, sondern gemessen ist. Neues JSON Schema
`schemas/befunde-schema.json`.

```ts
export const BEFUNDE_SCHEMA_VERSION = '1.0.0';

export type Erreichbarkeit = 'ok' | 'tot' | 'blockiert' | 'netzfehler';
export type ZitatBefund = 'woertlich' | 'drift' | 'nicht-pruefbar';
export type FassungBefund = 'aktuell' | 'ueberholt' | 'nicht-pruefbar' | 'nicht-anwendbar';

export interface ReferenzBefund {
  slug: string; // city/id
  reference_id: number;
  url: string;          // geprüfte source_url
  retrieved_at: string; // retrieved_at der Reference zum Prüfzeitpunkt
  erreichbar: Erreichbarkeit;
  http_status: number | null;
  zitat: ZitatBefund;
  fassung: FassungBefund;
}

export interface Wochenbefund {
  schema_version: string;
  city: string;
  /** ISO-Zeitpunkt des Laufs, der den aktuellen Stand festgestellt hat */
  erhoben_am: string;
  /** Link auf den GitHub-Actions-Lauf (Nachvollziehbarkeit) */
  lauf_url: string | null;
  /** Prüfumgebung; GitHub-IPs werden von einzelnen Behörden gesperrt,
   *  darum ist 'blockiert' ein Umgebungs-, kein Datenbefund. */
  umgebung: 'github-actions' | 'lokal';
  referenzen: ReferenzBefund[]; // stabil sortiert nach slug, reference_id
}
```

**Bewusst nicht im Snapshot:** der «ähnlichste Satz» aus dem Drift-Bericht.
Er ist ein Auszug der Quellseite, im Rohbericht des Workflows nützlich, in
einer öffentlichen Ansicht aber Rauschen. Er bleibt im Job-Summary.

**Join mit Ebene 1:** über `slug` + `reference_id`, aber nur, wenn `url` und
`retrieved_at` noch mit der aktuellen Reference übereinstimmen
(`befundLeser`). Ein Befund beschreibt genau eine Fassung einer Reference;
wurde sie seither korrigiert oder neu belegt, zeigt die View «offen» statt
eines veralteten Urteils. Dafür trägt das Belege-Aggregat seit 1.1.0 die
`url` je Reference. Eine Reference ohne Befund (neu seit dem letzten Lauf)
gilt ebenfalls als «offen», nie als «ok».

> **Umgesetzt in P3, anders als oben skizziert:** Die Summe `links` über alle
> URLs der offenen Daten entfällt; die Seite zählt nur, was die Belege
> betrifft. Neu sind `url` und `retrieved_at` je Befund (siehe Join). Der
> Snapshot wird nur geschrieben, wenn sich der Inhalt ändert (Zeitpunkt und
> Lauf zählen nicht). Hat mehr als die Hälfte der URLs nicht geantwortet,
> gilt der Lauf als gestört und schreibt nichts.

### 5.3 Ebene 3: Herkunft (`meta.herkunft`, Vertragserweiterung)

`meta` ist im Schema `additionalProperties: false`. Das neue Feld braucht
deshalb eine Schema-Änderung (CODEOWNERS) und einen Eintrag in
`docs/process-data-contract.md`. **Das ist ein Entscheid des Maintainers**
(siehe E2).

Beispiel (PR-Nummern und Daten sind Platzhalter, keine echten Angaben):

```json
"meta": {
  "erstellt": "2026-04-24",
  "aktualisiert": "2026-06-10",
  "maintainer": "malkreide",
  "lizenz": "CC-BY-4.0",
  "herkunft": {
    "art": "gemischt",
    "tessera_prs": [271, 275],
    "geprueft_am": "2026-10-11"
  }
}
```

| Feld | Typ | Pflicht | Regel (Validator) |
|---|---|---|---|
| `art` | enum `redaktion` \| `tessera` \| `gemischt` | ✓ (wenn `herkunft` gesetzt) | `redaktion` = redaktionell erfasst, Entwürfe mit KI-Assistenz, von einem Menschen geprüft (umgesetzt statt des ursprünglichen `hand`, siehe E2a); `tessera` = Struktur aus tessera, von einem Menschen geprüft; `gemischt` = redaktionell erfasst, durch tessera feldweise ergänzt |
| `tessera_prs` | integer[] | ✓ wenn `art` ≠ `redaktion` | PR-Nummern in diesem Repo; leer bei `redaktion` |
| `geprueft_am` | ISO-Datum | – | letzte **inhaltliche** Prüfung durch einen Menschen; ≥ `meta.erstellt`, nicht in der Zukunft |

- **Keine Namen.** Wer geprüft hat, steht im PR-Review, nicht in den Daten.
- **Versionierung:** Der Vertrag nennt einmal «MAJOR-Bump bei Breaking
  Changes», einmal «Schema-Änderungen: MAJOR-Bump + Migrationsskript». Ein
  additives, optionales Feld ist nicht breaking. Vor der Umsetzung ist zu
  klären, ob das MINOR (`0.2.0`) oder MAJOR ist (siehe E2). Nicht raten.
- **Folgeänderung:** Abschnitt «Herkunft & Pflege» im Datenvertrag an die
  Realität seit tessera v1 anpassen.
- **Ohne `herkunft`** zeigt die View «nicht erfasst», nicht «redaktion».
- **Umgesetzt in P4:** Das Belege-Aggregat (1.2.0) übernimmt `herkunft` je Zeile; `/belege` zeigt eine Spalte «Herkunft» mit Links auf die tessera-PRs, eine Zählzeile und zwei Methodik-Punkte (Herkunft, Übersetzungen). Herkunft ist keine Güte und trägt deshalb keine Statusfarbe.

### 5.4 Ebene 4: Änderungseintrag (`lib/aenderungen.ts`)

Abruf: `GET /repos/{owner}/{repo}/commits?path=stadt-zuerich-next/data/prozesse&sha=main`,
ISR 300 s. Optionaler Token aus einer ENV-Variable, gleicher Mechanismus wie
die Roadmap (`ROADMAP_GITHUB_TOKEN`). Die Abbildung ist eine reine, testbare
Funktion, getrennt vom Fetch.

```ts
export interface AenderungsEintrag {
  sha: string;            // 7-stellig
  datum: string;          // ISO-Datum des Commits
  typ: string;            // Conventional-Commit-Typ (feat, fix, docs, …) oder 'sonstiges'
  bereich: string | null; // Scope, z. B. "kita-platz"
  prozess: string | null; // slug, wenn der Scope eine bekannte Prozess-ID ist
  titel: string;          // Betreff ohne Typ, Scope und PR-Nummer
  pr: number | null;      // aus "(#123)"
  url: string;            // PR-Link, sonst Commit-Link
}

export function mapCommitToEintrag(raw: RawCommit, prozessIds: Set<string>): AenderungsEintrag;
```

**Datensparsam:** nur der Betreff, kein Commit-Body, keine Autor:innen.

---

## 6. Ansicht `/belege` (Arbeitstitel «Belege & Herkunft»)

Server-gerendert, ohne Client-JS, Aufbau wie `/portfolio`. Reihenfolge der
Abschnitte:

1. **Einleitung**, eine «Stand»-Zeile (Aggregat und Datum des Wochenbefunds)
   und das bestehende `DataQualityBadge`.
2. **Kennzahlen:** vier Textkacheln, Zahl als sichtbarer Text. In v1 keine
   Sparklines, weil noch keine Zeitreihe existiert.
   - bindende Angaben, wörtlich belegt (heute 75 von 75)
   - Belege nach Staatsebene (Stadt, Kanton, Bund, andere)
   - letzte Wochenprüfung: Datum, Drift, tote Links, «blockiert» separat
   - Hochrisiko-Verfahren (heute 3), alle mit sichtbarem Hinweis, weil
     `validate:prozesse` das erzwingt
3. **Prüfkette** als geordnete Liste (`<ol>`). Je Stufe steht, was geprüft
   wird, wann, was *nicht* geprüft wird, und ein Link auf Skript oder Workflow:
   1. Erfassung: Handdaten oder tessera-PR (struktur-only)
   2. Schema und Vertrag (`validate:prozesse`)
   3. Regression-Guard (`check:regression`)
   4. Referenzen-Gate, live, nur für geänderte References (`check:refs`)
   5. Menschliches Review: CODEOWNERS, kein Auto-Merge
   6. Wochenprüfung: Links, Zitat-Drift, Gesetzesfassung (`link-rot.yml`)
4. **Belegmatrix** als Tabelle. Zeilen sind die Prozesse, alphabetisch und
   nicht nach «Güte» sortiert. Spalten:

   | Spalte | Ebene | Darstellung |
   |---|---|---|
   | References | 1 | Anzahl |
   | wörtlich belegt | 1 | `n/m` + ✓/✕ |
   | Zitat noch wörtlich | 2 | ✓ / ✕ / ? (schraffiert: nicht erhoben/prüfbar) |
   | Links erreichbar | 2 | ✓ / ✕ (tot) / ⊘ (blockiert) / ? |
   | Gesetzesfassung aktuell | 2 | ✓ / ✕ / – (nicht anwendbar) |
   | ältester Abruf | 1 | Datum; ab Schwelle (E7) zusätzlich Text «älter als …» |
   | Herkunft | 3 | Hand / tessera / gemischt / nicht erfasst |

   Jede Zelle trägt Symbol, `sr-only`-Text und `title`. Die Zeile verlinkt
   auf `/prozesse/<city>/<id>#referenzen-heading`. Hochrisiko-Prozesse tragen
   dasselbe Badge wie im Prozess-Index.
5. **Änderungsprotokoll:** die letzten 20 Einträge (Ebene 4), mit Datum,
   Prozess, Art und Link zum PR.
6. **Methodik & Grenzen:** Was die Prüfungen leisten und was nicht.
   Erreichbarkeit heisst nicht Richtigkeit. Dazu Soft-404, JS-Seiten und
   Bot-Sperren. Ein Mensch bleibt für die Bedeutung des Zitats zuständig.

> **Umgesetzt in P2, anders als oben skizziert:** Die Spalten der Ebenen 2
> und 3 (Wochenbefund, Herkunft) erscheinen erst mit P3 bzw. P4. Statt
> Spalten, die in jeder Zeile nur «nicht erhoben» zeigen würden, nennt ein
> Hinweis über der Tabelle, welche Angaben noch folgen. Das Änderungsprotokoll
> (5.) folgt mit P5. Zusätzlich zeigt die Matrix die Quellen je Ebene und die
> Zahl der Belege aus Gesetzestexten.

**Wiederverwendung:** `STATUS_SYMBOL`, die Zellfarben und die Schraffur aus
`components/PortfolioHeatmap.tsx` liegen jetzt in `lib/status-stil.ts` und
werden von beiden Ansichten genutzt.

**Navigation:** Im Header stehen bereits neun Einträge. Vorschlag: vorerst
**kein** Header-Eintrag. Verlinkt wird von `/wirkung`, `/portfolio` und von
jeder Prozess-Detailseite unter den Referenzen («Wie diese Angaben belegt
sind →»). Siehe E6.

**Später (optional):** ein Open-Data-Endpunkt `/api/v1/belege` analog
`/api/v1/prozesse`, mit Eintrag in `public/data-catalog.json`.

---

## 7. Phasen (je ein kleiner PR)

| Phase | Inhalt | Dateien (Auszug) | Aufwand | hängt ab von |
|---|---|---|---|---|
| **P0** | Dieser Plan | `docs/plan-belege-herkunft.md` | – | – |
| **P1** | Ebene 1: Aggregat, ohne UI | `lib/belege.ts`, `scripts/build-belege.mjs` (+ `--check`), `data/belege/zh.json`, `config/quellen-ebenen.json`, `tests/belege.test.mjs`, npm-Skripte `build:belege`/`check:belege`, CI-Schritt in `ci.yml` | S | E1 |
| **P2** | Route `/belege` mit Ebene 1; Wochenbefund-Spalten zeigen ehrlich «noch nicht erhoben» | `app/[locale]/(main)/belege/page.tsx`, `components/BelegMatrix.tsx`, `components/StatusZelle.tsx` (Refactor), `messages/{de,en,fr,it,ls}.json`, `tests/a11y.spec.ts`, Links in `wirkung`/`portfolio`/Detailseite | M | P1, E4, E6 |
| **P3** | Ebene 2: maschinenlesbarer Wochenbefund | `--json` für `check-links.mjs --online` und den Drift-Bericht in `extract-quotes.mjs`, `scripts/build-befunde.mjs`, `schemas/befunde-schema.json`, `link-rot.yml` (Snapshot schreiben, Bot-PR nur bei Änderung) | M | P2, E3, E5 |
| **P4** | Ebene 3: Herkunft | `schemas/opengov-process-schema.json`, `types/prozess.ts`, `scripts/validate-prozesse.mjs`, `docs/process-data-contract.md`, Backfill der 17 Prozesse, Label `quelle:tessera` in `.github/labels.yml`, Issue im Repo `tessera` | M | E2, Angaben des Maintainers zur Herkunft je Prozess |
| **P5** | Ebene 4: Änderungsprotokoll | `lib/aenderungen.ts`, `scripts/probe-aenderungen.mjs`, Abschnitt in der Route | S | P2 |

**Definition of Done je Phase:** `typecheck`, `lint`, `test:unit`,
`validate:prozesse`, `check:regression`, `check:portfolio` und das neue
`check:belege` sind grün. Das Bundle-Budget bleibt unverändert (die Route lädt
kein Client-JS), der a11y-Smoke inklusive der neuen Route ist grün, die Seite
funktioniert ohne JavaScript, und alle neuen i18n-Keys sind in fünf Sprachen
vorhanden (`messages-parity`).

**CODEOWNERS-pflichtig:** P1 (`ci.yml`), P3 (`check-links.mjs`,
`link-rot.yml`, `schemas/`), P4 (`schemas/`, Datenvertrag, Prozessdaten).

---

## 8. Risiken und Gegenmassnahmen

| Risiko | Wirkung | Gegenmassnahme |
|---|---|---|
| **Scheingenauigkeit:** «75/75 verifiziert» wird als «alles richtig» gelesen | Vertrauensverlust, wenn sich eine Angabe als falsch erweist | Wortwahl «wörtlich belegt»; Abschnitt «Methodik & Grenzen» sichtbar über der Matrix verlinkt; menschliche Zuständigkeit benennen |
| **Öffentlich sichtbare Schwachstellen** (Drift, tote Links auf städtischen Seiten) | kommunikativ heikel, kann als Kritik an der eigenen Verwaltung gelesen werden | Formulierung «Link wird korrigiert» (der Fehler liegt im eigenen Deep-Link, nicht bei der Fachstelle); Entscheid E1/E5 vor P3 |
| **«Blockiert» als «tot» missverstanden** | falsche Aussage über fremde Websites | eigene Kategorie mit eigenem Symbol; Umgebung im Snapshot ausgewiesen |
| **`meta.herkunft` veraltet**, wenn niemand pflegt | irreführende Herkunftsangabe | tessera setzt das Feld im eigenen PR; der Validator prüft die Konsistenz; «nicht erfasst» statt Default |
| **Zusätzlicher Schritt bei Daten-PRs:** jede Änderung an Prozessdaten muss `data/belege/<city>.json` neu erzeugen (auch tessera-PRs) | rotes `check:belege`, bis das Aggregat nachgezogen ist | gleiches Muster wie `check:portfolio`; die CI-Meldung nennt den Befehl `npm run build:belege` |
| **Bot-PR ohne CI:** PRs, die ein Workflow mit dem Standard-Token öffnet, starten bei GitHub keine CI; die Pflicht-Checks fehlen, der Merge ist blockiert | Befund-PR bleibt hängen | Secret `WOCHENBEFUND_TOKEN` (fine-grained Token oder GitHub-App, nur dieses Repo, Contents + Pull requests: write), dann läuft alles automatisch. Ohne Secret: PR einmal schliessen und wieder öffnen; der PR-Text sagt das |
| **Wöchentliche Bot-PRs als Rauschen** | Review-Müdigkeit | PR nur bei geändertem Befund; ein Sammel-PR pro Woche; kein Auto-Merge |
| **GitHub-API-Limit** (Änderungsprotokoll) | Abschnitt leer | ISR 300 s, optionaler Token; failed-soft mit Hinweis «Protokoll derzeit nicht abrufbar» |
| **Scope Creep** Richtung Monitoring-Plattform | Aufwand, Bundle, Wartung | Phasen strikt getrennt; Zeitreihen erst ab ≥ 8 versionierten Wochenbefunden (siehe Abschnitt 10) |

---

## 9. Entscheide (Maintainer)

Entschieden am 2026-10-25: E1 öffentlich, E2–E7 gemäss Empfehlung.

| # | Frage | Entscheid | Begründung |
|---|---|---|---|
| **E1** | Ansicht öffentlich oder nur intern? | **öffentlich** | Transparenz ist der Zweck; intern genügt das Job-Summary. Formulierung toter Links gemäss E5 |
| **E2** | Herkunft als Vertragserweiterung `meta.herkunft`? Falls ja: MINOR oder MAJOR? | **ja, MINOR (`0.2.0`)**, optionales Feld | Git ist als Quelle unzuverlässig (flacher Clone, Merges unter einem Konto); eine Datei neben den Prozessen würde `validate:prozesse` brechen. Additiv ist nicht breaking; in P4 die mehrdeutige Versionsregel im Vertrag klarstellen |
| **E2a** | (P4, 2026-10-28) Wie mit der KI-Assistenz bei den bisherigen «Handdaten» umgehen? | **offen benennen:** Wert `redaktion` statt `hand` | Die Git-Historie zeigt, dass auch die von Hand modellierten Prozesse mit KI-Assistenz entworfen und von einem Menschen geprüft wurden. «hand» hätte das verschwiegen. `/belege` sagt es in der Methodik, der Datenvertrag in «Herkunft & Pflege». `geprueft_am` bleibt leer, bis ein Mensch ein Datum setzt |
| **E3** | Wie kommt der Wochenbefund nach `main`? | **Bot-PR bei Änderung**, ein Mensch merged | Entspricht Human-in-the-Loop, macht den Befund versioniert. Die Alternative, Artefakte zur Laufzeit abzurufen, braucht ein Token in Vercel und umgeht das Review |
| **E4** | Route und Titel | **`/belege`**, «Belege & Herkunft» | konkret, in Leichte Sprache übertragbar («Woher wir das wissen») |
| **E5** | Tote Deep-Links öffentlich mit URL nennen? | **ja, neutral formuliert** | Der Link ist unser Datenfehler; ihn zu benennen ist ehrlich und führt zur Korrektur |
| **E6** | Header-Eintrag? | **vorerst nein**, Links aus Wirkung, Portfolio und Detailseite | Der Header ist voll; die Zielgruppe ist primär Fachpublikum |
| **E7** | Ab welchem Alter gilt ein Abruf als «älter als …»? | **365 Tage** (nur Hinweistext, kein Fehler) | Fristen und Gebühren ändern sich selten unterjährig; der Wochenlauf fängt Drift ohnehin ab |

---

## 10. Nicht im Umfang

- Zeitreihen oder Sparklines (sinnvoll erst ab ≥ 8 versionierten
  Wochenbefunden)
- Abstammung auf Feldebene (welches Feld aus welchem tessera-PR)
- Bewertung oder Vergleich von Verwaltungseinheiten
- Live-Status, Push-Benachrichtigungen, Tracking
- Interne Metriken der tessera-Pipeline (Crawl, Extraktion): Sie gehören ins
  Repo `tessera`

---

## Verweise

- Kanonischer Datenvertrag: [`docs/process-data-contract.md`](process-data-contract.md)
- Gate-Abnahme v0 → tessera v1: [`docs/v0-gate.md`](v0-gate.md)
- Branch-Protection und Gates: [`docs/branch-protection.md`](branch-protection.md)
- Muster für deterministische Aggregate: `stadt-zuerich-next/lib/portfolio.ts`,
  `stadt-zuerich-next/scripts/build-portfolio.mjs`
- Wochenlauf: `.github/workflows/link-rot.yml`
