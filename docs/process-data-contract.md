# Prozess-Datenvertrag (kanonische Fassung)

**Status:** Kanonisch. Dieses Dokument ist die Single Source of Truth für das
Prozess-Schema. Der Entwurf im Repo `tessera` (`docs/data-contract.md`,
`docs/process.schema.json`) ist ausdrücklich nicht-kanonisch und wird an diese
Fassung angeglichen.

**Vertragsversion:** `schema_version: "0.1.0"` (SemVer; MAJOR-Bump bei Breaking
Changes mit Migrationsskript).
**Maschinenlesbare Definition:** [`stadt-zuerich-next/schemas/opengov-process-schema.json`](../stadt-zuerich-next/schemas/opengov-process-schema.json)
**TypeScript-Typen:** [`stadt-zuerich-next/types/prozess.ts`](../stadt-zuerich-next/types/prozess.ts)
**Validator (CI):** `npm run validate:prozesse` ([`scripts/validate-prozesse.mjs`](../stadt-zuerich-next/scripts/validate-prozesse.mjs))

---

## Kardinalregel

> **Bindende Werte (Fristen, Gebühren, Steuern, Prozentsätze, Rekursfristen)
> erscheinen NUR als Reference — Label + Deep-Link + wörtliche Belegstelle —
> nie als gerenderter Wert in einem Schritt-Label, einer Beschreibung oder
> einer Kennzahl.**

Es gibt bewusst kein Klartextfeld für eine Frist oder Gebühr als Zahl.
Der Validator lintet dagegen (siehe [Kardinalregel-Lint](#kardinalregel-lint)).
Die Zahl selbst darf ausschliesslich im Feld `source_quote` einer Reference
stehen — als wörtliches Zitat der verlinkten amtlichen Quelle, nicht als
eigene Behauptung.

---

## Datenmodell

Ein Prozess ist ein gerichteter azyklischer Graph (DAG) aus Schritten mit
`depends_on`-Vorgängerbeziehungen. Eine Datei pro Prozess unter
`stadt-zuerich-next/data/prozesse/<city>/<id>.json`.

Feldnamen folgen dem Vertrag (englisch); **Inhalte und Enum-Werte sind
deutsch** (eCH-Konvention). Kern-Felder sind verbindlich; als *Erweiterung*
markierte Felder sind additiv und dürfen von reinen Vertrags-Konsumenten
(z. B. `tessera`) ignoriert werden.

### Process

| Feld | Typ | Pflicht | Bedeutung |
|---|---|---|---|
| `schema_version` | string, SemVer | ✓ | Vertragsversion, z. B. `"0.1.0"` |
| `id` | string, kebab-case | ✓ | **= `lebenslage_ref`** der bestehenden Lebenslage (CI-geprüft) |
| `lebenslage_ref` | string, kebab-case | ✓ | ID der Lebenslage in `data/<city>/lebenslagen.json`; muss zurückverlinken (`prozesse[]` enthält `<city>/<id>`) |
| `title` | i18n | ✓ | Titel (`de` Pflicht) |
| `target_audience` | enum | ✓ | `bevoelkerung` \| `wirtschaft` \| `behoerden` (eCH-0073) |
| `preconditions` | i18n[] | – | Voraussetzungen vor Prozessstart |
| `steps` | Step[] | ✓ | Schritte (DAG über `depends_on`) |
| `references` | Reference[] | – | Bindende Werte als Link, siehe unten |
| `source_url` | string (http/https) | ✓ | Primäre amtliche Quelle des Prozesses |
| `retrieved_at` | string (ISO 8601) | ✓ | Abrufdatum der primären Quelle |
| `disclaimer_key` | string | ✓ | i18n-Key des Inoffiziell-Hinweises (`Prozesse.disclaimer`). Hochrisiko-Rechtsfälle (`baugesuch`, `sozialhilfe`, `veranstaltung`) verwenden `Prozesse.disclaimerHochrisiko` — die Detailseite rendert diesen Hinweis sichtbar hervorgehoben (rot). |
| `city` | string | ✓ *(Erweiterung)* | Stadt-Kennung (`zh`, …) — Dateiablage + URL-Slug `<city>/<id>` |
| `description` | i18n | – *(Erweiterung)* | Kurzbeschreibung |
| `actors` | Actor[] | – *(Erweiterung)* | Akteurs-Tabelle (Swimlanes, Org-Chart-Brücke); `steps[].actor` referenziert `actors[].id` |
| `legal_basis` | { label, url? }[] | – *(Erweiterung)* | Rechtsgrundlagen |
| `sources` | Source[] | – *(Erweiterung)* | Weitere Belegquellen neben `source_url` |
| `reife` | object | – *(Erweiterung, experimentell)* | Digitale Reife/Medienbrüche — unverändert aus Schema-Gen. 1/2 übernommen, Normalisierung später |
| `bewertung` | object | – *(Erweiterung)* | Belegte Bewertungs-Indikatoren (Digitalisierung); siehe [Bewertung](#bewertung-erweiterung) |
| `meta` | { erstellt?, aktualisiert?, maintainer?, lizenz? } | – *(Erweiterung)* | Metadaten |

### Step

| Feld | Typ | Pflicht | Bedeutung |
|---|---|---|---|
| `step_id` | integer | ✓ | Eindeutig je Prozess |
| `actor` | string | ✓ | Handelnde Rolle; referenziert `actors[].id`, falls `actors` vorhanden |
| `label` | i18n | ✓ | **Keine bindenden Zahlen** (Kardinalregel-Lint) |
| `depends_on` | (integer \| DependsOn)[] | ✓ | Vorgänger-`step_id`s; leer = Start-Schritt |
| `reference_ids` | integer[] | – | Verweise auf `references` |
| `type` | enum | – *(Erweiterung)* | Render-Hint: `start` \| `input` \| `prozess` \| `entscheidung` \| `loop` \| `warten` \| `ende` |
| `description` | i18n | – *(Erweiterung)* | dito Kardinalregel |
| `documents` | { label, url?, required? }[] | – *(Erweiterung)* | Benötigte Unterlagen |
| `source_id` | string | – *(Erweiterung)* | Verweis auf `sources[].id` |
| `loops_back_to` | integer[] | – *(Erweiterung)* | Rücksprung-Hinweis (Nachbesserung/Rekurs) fürs Rendering. **Nicht Teil des DAG** — nur Schritte mit `type: "loop"` dürfen das Feld tragen |

**DependsOn (Objekt-Variante, additive Erweiterung):**
`{ "step_id": integer, "condition": i18n? }` — drückt Bedingungs-Kanten aus
(z. B. Entscheidung „Hund bereits in AMICUS?" → `condition: { de: "nein" }`).
Reine DAG-Konsumenten dürfen die Variante auf den `step_id`-Wert reduzieren.

### Reference

Hier — und nur hier — leben Fristen, Gebühren, Steuern, Rekursfristen.

| Feld | Typ | Pflicht | Bedeutung |
|---|---|---|---|
| `reference_id` | integer | ✓ | Eindeutig je Prozess |
| `label` | i18n | ✓ | z. B. „Rekursfrist" — **ohne die Zahl als behaupteten Fakt** |
| `source_url` | string (http/https) | ✓ | Deep-Link auf die exakte Stelle der amtlichen Quelle |
| `source_quote` | string | ✓* | **Wörtliche** Belegstelle von der verlinkten Seite (Grounding-Gate) |
| `retrieved_at` | string (ISO 8601) | ✓ | Abrufdatum |
| `status` | enum | – *(Erweiterung)* | `verifiziert` (Default) \| `unverifiziert` |

\* Grounding-Gate: bei `status: "verifiziert"` (oder fehlendem `status`) ist
ein nicht-leeres `source_quote` Pflicht (CI-Fehler). `status: "unverifiziert"`
mit leerem `source_quote` ist erlaubt, erzeugt aber eine CI-Warnung und wird
in der UI nicht als Faktum gerendert — nur Label + Link. Unverifizierte
References sind Altbestand bzw. Arbeitsstand; neue References werden
verifiziert angelegt.

### Actor *(Erweiterung)*

`{ id, label (i18n), type, einheit_ref? }` mit
`type ∈ antragsteller | behoerde | fachstelle | gericht | dritte`.
`einheit_ref` verknüpft den Akteur mit einer Einheit des Org-Charts
(`data/<city>/org-chart.json`, CI-geprüft) — Grundlage der
Lebenslage↔Prozess↔Einheit-Brücke.

### Bewertung *(Erweiterung)*

Bewertet einen Prozess hinsichtlich **Digitalisierung** und
**Nutzendenorientierung** — als *abgeleitete Metadaten*, nie als autoritative
Aussage. Zwei Quellen, sonst nichts:

- **Berechnet** — deterministisch aus dem Prozess-Graphen (Locale-Abdeckung,
  Schrittzahl, Akteurswechsel, Pflichtdokumente, Voraussetzungen, verlinkte
  Referenzen). Diese Indikatoren werden **von der App** berechnet
  (`stadt-zuerich-next/lib/bewertung.ts`) und **nicht** im JSON gepflegt —
  doppelte Pflege entfällt.
- **Belegt** — Eigenschaften, die *nicht* aus dem Graphen ableitbar sind
  (gibt es einen Online-Antrag? Online-Zahlung? Statusverfolgung?). Diese
  leben hier, **exakt wie eine Reference**: `source_url` + wörtliches
  `source_quote` (Grounding-Gate). Fehlt der Beleg, gilt der Indikator als
  **«unbekannt»** — er wird sichtbar als unbekannt gezeigt, **nicht** geraten
  und **nicht** als «nicht erfüllt» gewertet.

Der aggregierte Score ist eine transparente, deterministische Funktion:
Anteil erfüllter Indikatoren **unter den bekannten** (gezählten). «unbekannt»
zählt nicht in den Nenner. Jeder Indikator ist im UI mit aufklappbarer
Evidenz hinterlegt.

`bewertung = { indikatoren?: BewertungIndikator[] }`

**BewertungIndikator** `{ key, wert, source_url, source_quote?, status?, retrieved_at }`:

| Feld | Typ | Pflicht | Bedeutung |
|---|---|---|---|
| `key` | enum | ✓ | Digitalisierung: `online-antrag` \| `online-bezahlung` \| `statusverfolgung` \| `medienbruchfrei` \| `digital-abschliessbar` \| `once-only`. Nutzendenorientierung: `barrierefreiheit` (WCAG 2.1 AA) \| `nicht-digitaler-alternativweg`. Rein informativ (zählt nicht): `eid-moeglich`. Strategiebezug je Indikator: `docs/bewertung-strategiebezug.md` |
| `wert` | boolean | ✓ | Belegte Ausprägung der strukturellen Eigenschaft (`true` = trifft zu). **Kein bindender Wert** (Kardinalregel). |
| `source_url` | string (http/https) | ✓ | Deep-Link auf die belegende amtliche Stelle |
| `source_quote` | string | ✓* | **Wörtliche** Belegstelle (Grounding-Gate wie bei References) |
| `status` | enum | – | `verifiziert` (Default) \| `unverifiziert` |
| `retrieved_at` | string (ISO 8601) | ✓ | Abrufdatum |

\* Grounding-Gate identisch zu References: bei `status: "verifiziert"` (oder
fehlendem `status`) ist ein nicht-leeres `source_quote` Pflicht (CI-Fehler).

### Source *(Erweiterung)*

`{ id, title, url, retrieved_at }` — weitere Belegquellen. `source_url` +
`retrieved_at` auf Prozess-Ebene bezeichnen die primäre Quelle und speisen
den sichtbaren Quell-Link + Abrufdatum des Disclaimers.

### i18n

- Objektform `{ de, en?, fr?, it?, ls? }`; `de` ist Pflicht und **nicht-leer**
  (Schema: `minLength: 1`). Andere Schlüssel als die fünf Locales lehnt das
  Schema ab.
- **`ls` = Leichte Sprache** (kanonischer Locale-Key dieses Repos; entspricht
  `leichte_sprache` im tessera-Entwurf — Mapping dokumentiert, Entwurf wird
  angeglichen).
- Fehlende Locales werden **nicht maschinell geraten**. Das Frontend fällt auf
  `de` zurück und kennzeichnet die Seite als „Übersetzung ausstehend".

---

## Validierungsregeln (kanonisch, CI-bindend)

1. `id` kebab-case und **`id == lebenslage_ref`**; `schema_version` SemVer;
   `retrieved_at` ISO 8601; `source_url` (Prozess + References) http(s).
   Das Schema lehnt **unbekannte Felder ab** (`additionalProperties: false`
   auf allen Objekten) — Tippfehler-Felder scheitern in der CI statt still
   ignoriert zu werden. `city` muss dem Ablage-Verzeichnis
   `data/prozesse/<city>/` entsprechen.
2. `lebenslage_ref` existiert in `data/<city>/lebenslagen.json` **und** die
   Lebenslage verlinkt zurück (`prozesse[]` enthält `<city>/<id>`).
   Für Städte ohne Lebenslagen-Datei wird der Check mit Warnung übersprungen.
3. `title.de` und jedes `label.de` sind Pflicht; en/fr/it/ls dürfen fehlen
   („Übersetzung ausstehend") — nicht maschinell raten.
4. `step_id` eindeutig; `depends_on` verweist nur auf existierende
   `step_id`s; kein Selbstbezug; mindestens ein Start-Schritt
   (leeres `depends_on`); der Graph über `depends_on` ist **azyklisch (DAG)**.
5. `loops_back_to` nur an Schritten mit `type: "loop"`, nur auf existierende
   `step_id`s; fliesst nicht in den DAG-Check ein.
6. `reference_id` eindeutig; `reference_ids` der Schritte verweisen auf
   existierende References; Grounding-Gate gemäss Tabelle oben. Dasselbe
   Grounding-Gate gilt für `bewertung.indikatoren[]` (verifiziert ⇒
   nicht-leeres `source_quote`).
7. **Kardinalregel-Lint** (CI-Fehler), siehe unten.
8. `actors[].einheit_ref` existiert im Org-Chart der Stadt (Cross-Check);
   `steps[].actor` referenziert `actors[].id`, falls `actors` vorhanden.
9. **Regression-Guard** (CI-Fehler, nur auf Pull Requests): an einer bereits
   bestehenden Prozessdatei darf kein belegter lokalisierter Text (`i18n`-Locale
   oder `description`) von „befüllt" auf „leer/fehlend" zurückfallen, siehe unten.

### Kardinalregel-Lint

Eine Zahl in Verbindung mit einer bindenden Einheit — `CHF`, `Fr.`, `Franken`,
`%`/`Prozent`, `Tag(e/en)`, `Woche(n)`, `Monat(e/en)`, `Jahr(e/en)` — ist ein
**Fehler** in den unten gelisteten Feldern (alle Locales). Erkannt werden
neben Ziffern auch **ausgeschriebene Zahlwörter** («innert zehn Tagen»,
«fünf Jahre») und die Schweizer Preisnotation **«500.–»**; die Muster leben
unit-getestet in
[`scripts/lib/binding-values.mjs`](../stadt-zuerich-next/scripts/lib/binding-values.mjs).
Geprüfte Felder:

- `title`, `description`
- `steps[].label`, `steps[].description`, `steps[].documents[].label`
- `depends_on[].condition`
- `preconditions[]`
- `references[].label`
- `reife`-Freitexte (`onceOnlyPotenzial`, `nutzergruppen[]`, `painPoints[]`,
  `improvementIdeas[]`, `wirkungKpi[].label` und `.wert`)

Erlaubt sind solche Angaben ausschliesslich im Feld `source_quote` einer
Reference.

### Regression-Guard (Handdaten)

**Check:** `npm run check:regression`
([`scripts/check-prozess-regression.mjs`](../stadt-zuerich-next/scripts/check-prozess-regression.mjs)),
CI-Job `prozess-regression` (nur auf Pull Requests).

Prozessdaten werden von Hand mehrsprachig angereichert; automatisierte
Extraktoren (z. B. tessera) liefern oft nur `de` mit leeren `en/fr/it`. Damit ein
ungeprüfter Merge die reicheren Handdaten nicht durch die ärmere Extraktion
**überschreibt**, vergleicht der Guard jede bestehende Datei feldweise (über
stabile Schlüssel `step_id`/`reference_id`/`actor.id`) **und** in der
Locale-Gesamtabdeckung gegen die Basis-Version (`origin/<base>`):

- Verliert ein zuvor nicht-leerer lokalisierter Text seine Sprache (leer oder
  entfernt) oder sinkt die Abdeckung einer Locale, schlägt CI fehl — mit
  feldgenauem Zeiger auf den verlorenen Text.
- **Gelöschte oder umbenannte Prozessdateien** (in der Basis vorhanden, im PR
  nicht mehr) sind ebenfalls eine Regression — der Guard vergleicht gegen die
  Dateiliste der Basis (`git ls-tree`), nicht nur den Working-Tree.
- **`source_quote`-Erosion:** verliert eine bestehende Reference ihr belegtes
  Zitat (auch via Downgrade auf `unverifiziert` + Leeren) oder sinkt die
  Gesamtzahl belegter Zitate einer Datei, schlägt CI fehl.
- Neue Dateien (keine Basis) werden übersprungen.
- Ist eine Reduktion **wirklich** beabsichtigt: `ALLOW_PROZESS_SHRINK=1` schaltet
  den Guard auf Warnung herab.

> Der eigentliche Fix gehört in den Extraktor (tessera `pr.py`: bei bestehender
> Handdatei feldweise mergen statt per PUT überschreiben). Dieser Guard ist das
> repo-seitige Sicherheitsnetz, das die Regression unabhängig davon abfängt.

---

## Abbildung auf den tessera-Entwurf

Der Vertragskern ist feldgleich mit dem tessera-Entwurf. Abweichungen und
Erweiterungen:

| tessera-Entwurf | kanonisch (dieses Repo) | Anmerkung |
|---|---|---|
| `title.leichte_sprache` | `title.ls` | kanonischer Locale-Key ist `ls` |
| `depends_on: integer[]` | `(integer \| {step_id, condition?})[]` | additive Objekt-Variante für Bedingungs-Kanten; auf `step_id` reduzierbar |
| `retrieved_at` (Timestamp) | ISO-8601-**Datum** | Tagesgenauigkeit reicht für Quell-Snapshots |
| — | `city` | Erweiterung, aber **Pflichtfeld** (Schema-`required`): bestimmt Dateiablage und URL-Slug `<city>/<id>`. Produzenten, die Dateien für dieses Repo erzeugen, MÜSSEN es setzen; die CI prüft, dass es zum Ablage-Verzeichnis passt. Nur reine *Lese*-Konsumenten dürfen es ignorieren. |
| — | `description`, `actors`, `legal_basis`, `sources`, `reife`, `bewertung`, `meta`, Step-`type`/`description`/`documents`/`source_id`/`loops_back_to`, Reference-`status` | dokumentierte additive Erweiterungen, ignorierbar |

Rücksprünge realer Verfahren (Nachbesserung, Rekurs) sind **nicht** Teil des
`depends_on`-DAG; sie leben ausschliesslich im Rendering-Hinweis
`loops_back_to` an explizit markierten `loop`-Schritten.

---

## Herkunft & Pflege

- Prozessdaten werden **von Hand** geschrieben (kein Scraping, keine
  LLM-Generierung, keine automatische Übersetzung).
- Jede Reference braucht einen Deep-Link auf eine amtliche Quelle und — sobald
  verifiziert — die wörtliche Belegstelle. Nichts erfinden.
- `id == lebenslage_ref` bedeutet: pro Lebenslage genau ein kanonischer
  Prozess. Braucht eine Lebenslage später mehrere Verfahren, wird der Vertrag
  per MAJOR-Bump erweitert — nicht stillschweigend aufgeweicht.
- Schema-Änderungen: MAJOR-Bump + Migrationsskript
  (`scripts/migrate-prozesse-*.mjs`), dann dieses Dokument aktualisieren.
  Bei Konflikten zwischen diesem Dokument und dem JSON-Schema gilt: erst
  klären, dann ändern — nicht raten.
