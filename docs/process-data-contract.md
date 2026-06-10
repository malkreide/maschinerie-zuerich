# Prozess-Datenvertrag (kanonische Fassung)

**Status:** Kanonisch. Dieses Dokument ist die Single Source of Truth für das
Prozess-Schema. Der Entwurf im Repo `tessera` (`docs/data-contract.md`,
`docs/process.schema.json`) ist ausdrücklich nicht-kanonisch und wird an diese
Fassung angeglichen.

**Schema-Generation:** 2 (Dateien tragen `version: "2.x.y"`).
**Maschinenlesbare Definition:** [`stadt-zuerich-next/schemas/opengov-process-schema.json`](../stadt-zuerich-next/schemas/opengov-process-schema.json)
**TypeScript-Typen:** [`stadt-zuerich-next/types/prozess.ts`](../stadt-zuerich-next/types/prozess.ts)
**Validator (CI):** `npm run validate:prozesse` ([`scripts/validate-prozesse.mjs`](../stadt-zuerich-next/scripts/validate-prozesse.mjs))

---

## Kardinalregel

> **Bindende Werte (Fristen, Gebühren, Steuern, Prozentsätze, Rekursfristen)
> erscheinen NUR als Referenz — Label + Deep-Link + wörtliche Belegstelle —
> nie als gerenderter Wert in einem Schritt-Label, einer Beschreibung oder
> einer Kennzahl.**

Es gibt bewusst kein Klartextfeld für eine Frist oder Gebühr als Zahl.
Der Validator lintet dagegen (siehe [Kardinalregel-Lint](#kardinalregel-lint)).
Die Zahl selbst darf ausschliesslich im Feld `zitat` einer Referenz stehen —
als wörtliches Zitat der verlinkten amtlichen Quelle, nicht als eigene
Behauptung.

---

## Datenmodell

Ein Prozess ist ein gerichteter Graph aus typisierten Schritten mit klaren
Akteuren (Swimlanes). Eine Datei pro Prozess unter
`stadt-zuerich-next/data/prozesse/<city>/<id>.json`.

### Prozess

| Feld | Typ | Pflicht | Bedeutung |
|---|---|---|---|
| `id` | string, kebab-case | ✓ | Stabile Prozess-ID, z. B. `hund-anmelden` |
| `version` | string, SemVer | ✓ | Version der Prozessbeschreibung. MAJOR = Schema-Generation (aktuell `2`) |
| `city` | string | ✓ | Stadt-Kennung (`zh`, …) |
| `titel` | i18n | ✓ | Titel (`de` Pflicht) |
| `kurzbeschreibung` | i18n | – | Kurztext |
| `lebenslage_ref` | string, kebab-case | ✓ | ID der Lebenslage in `data/<city>/lebenslagen.json`, die zu diesem Prozess führt |
| `zielgruppe` | enum | ✓ | `bevoelkerung` \| `wirtschaft` \| `behoerden` (nach eCH-0073) |
| `voraussetzungen` | i18n[] | – | Voraussetzungen, bevor der Prozess startet |
| `rechtsgrundlagen` | { bezeichnung, url? }[] | – | Gesetze/Verordnungen |
| `quellen` | Quelle[] | ✓ (≥ 1) | Belegquellen des Gesamtprozesses; jede mit `url` **und** `abgerufen` |
| `referenzen` | Referenz[] | – | Bindende Werte als Link, siehe unten |
| `akteure` | Akteur[] | ✓ | Rollen/Organisationen (Swimlanes), optional `einheit_ref` ins Org-Chart |
| `schritte` | Schritt[] | ✓ | Knoten des Graphen |
| `flow` | Kante[] | ✓ | Kanten (`von`/`nach`, optional `bedingung` + `label`) |
| `reife` | Reife | – | Digitale Reife & Vereinfachungspotenzial |
| `disclaimer_key` | string | – | i18n-Key des Inoffiziell-Hinweises; Default `Prozesse.disclaimer` |
| `meta` | { erstellt?, aktualisiert?, maintainer?, lizenz? } | – | Metadaten |

### Schritt

| Feld | Typ | Pflicht | Bedeutung |
|---|---|---|---|
| `id` | string, kebab-case | ✓ | Eindeutig je Prozess |
| `typ` | enum | ✓ | `start` \| `input` \| `prozess` \| `entscheidung` \| `loop` \| `warten` \| `ende` |
| `akteur` | string | ✓ | ID aus `akteure` — bestimmt die Swimlane |
| `label` | i18n | ✓ | **Keine bindenden Zahlen** (Kardinalregel-Lint) |
| `beschreibung` | i18n | – | dito |
| `unterlagen` | { label, url?, pflicht? }[] | – | Benötigte Dokumente (für `input`-Schritte) |
| `quelle` | string | – | ID einer Quelle aus `quellen` |
| `referenzen` | string[] | – | IDs aus `referenzen` — bindende Werte dieses Schritts |

Die Felder `dauer_est` und `kosten_chf` der Schema-Generation 1 sind
**ersatzlos entfernt** — geschätzte Dauern waren unbelegte Behauptungen,
Kosten gehören als Referenz belegt.

### Referenz

Hier — und nur hier — leben Fristen, Gebühren, Steuern, Rekursfristen.

| Feld | Typ | Pflicht | Bedeutung |
|---|---|---|---|
| `id` | string, kebab-case | ✓ | Eindeutig je Prozess, Konvention `r-…` |
| `label` | i18n | ✓ | z. B. „Höhe der jährlichen Hundesteuer" — **ohne die Zahl als behaupteten Fakt** |
| `url` | string (http/https) | ✓ | Deep-Link auf die exakte Stelle der amtlichen Quelle |
| `zitat` | string | ✓* | **Wörtliche** Belegstelle von der verlinkten Seite (Grounding-Gate) |
| `status` | enum | – | `verifiziert` (Default) \| `unverifiziert` |
| `abgerufen` | string (ISO-8601-Datum) | ✓ | Abrufdatum der Quelle |

\* Grounding-Gate: bei `status: "verifiziert"` (oder fehlendem `status`) ist
ein nicht-leeres `zitat` Pflicht (CI-Fehler). `status: "unverifiziert"` mit
leerem `zitat` ist erlaubt, erzeugt aber eine CI-Warnung und wird in der UI
nicht als Faktum gerendert — nur Label + Link. Unverifizierte Referenzen sind
Altbestand bzw. Arbeitsstand; neue Referenzen sollen verifiziert angelegt
werden.

### Quelle

`{ id, titel, url, abgerufen }` — Belegquellen des Gesamtprozesses. In
Generation 2 sind `url` und `abgerufen` Pflicht; sie speisen den sichtbaren
Quell-Link + Abrufdatum pro Prozess (Definition of Done des Disclaimers).

### i18n

- Objektform `{ de, en?, fr?, it?, ls? }`; `de` ist Pflicht.
- `ls` = Leichte Sprache (Repo-Konvention; entspricht `leichte_sprache` im
  tessera-Entwurf).
- Fehlende Locales werden **nicht maschinell geraten**. Das Frontend fällt auf
  `de` zurück und kennzeichnet die Seite als „Übersetzung ausstehend".

---

## Validierungsregeln (kanonisch, CI-bindend)

1. `id` kebab-case; `version` SemVer; `quellen[].abgerufen` /
   `referenzen[].abgerufen` ISO-8601-Datum; alle `url` http(s).
2. `lebenslage_ref` existiert in `data/<city>/lebenslagen.json` **und** die
   Lebenslage verlinkt zurück (`prozesse[]` enthält `<city>/<id>`).
   Für Städte ohne Lebenslagen-Datei wird der Check mit Warnung übersprungen.
3. `titel.de` und jedes `label.de` sind Pflicht; weitere Locales optional.
4. `schritte[].id` eindeutig; `flow.von`/`flow.nach` verweisen nur auf
   existierende Schritte; kein Selbstbezug (`von != nach`).
5. Mindestens ein `start`-Schritt; `ende`-Schritte ohne ausgehende Kanten;
   jeder Schritt vom Start erreichbar (Warnung).
6. **Azyklisch bis auf Rücksprünge:** Nach Entfernen aller Kanten, die von
   einem Schritt mit `typ: "loop"` ausgehen, muss der Graph ein DAG sein
   (CI-Fehler bei sonstigen Zyklen). Rücksprünge (Nachbesserung, Nachfristen)
   sind nur über explizit markierte `loop`-Schritte erlaubt.
7. `referenzen[].id` eindeutig; `schritte[].referenzen` verweisen auf
   existierende Referenzen; Grounding-Gate gemäss Tabelle oben.
8. **Kardinalregel-Lint** (CI-Fehler), siehe unten.
9. `akteure[].einheit_ref` existiert im Org-Chart der Stadt (Cross-Check).

### Kardinalregel-Lint

Eine Zahl in Verbindung mit einer bindenden Einheit — `CHF`, `Fr.`, `Franken`,
`%`, `Tag(e/en)`, `Woche(n)`, `Monat(e/en)`, `Jahr(e/en)`, sowie
`Frist` mit Zahl im selben Text — ist ein **Fehler** in folgenden Feldern
(alle Locales):

- `titel`, `kurzbeschreibung`
- `schritte[].label`, `schritte[].beschreibung`, `schritte[].unterlagen[].label`
- `flow[].label`
- `voraussetzungen[]`
- `referenzen[].label`
- `reife.onceOnlyPotenzial`, `reife.nutzergruppen[]`, `reife.painPoints[]`,
  `reife.improvementIdeas[]`, `reife.wirkungKpi[].label` und `.wert`

Erlaubt sind solche Angaben ausschliesslich im Feld `zitat` einer Referenz.

---

## Abbildung auf den tessera-Entwurf

Der tessera-Entwurf (nicht-kanonisch) wird wie folgt auf diese Fassung
abgebildet. Feldnamen folgen hier den Konventionen der bestehenden
Datendateien dieses Repos (deutsch, `ls`-Locale):

| tessera-Entwurf | kanonisch (dieses Repo) | Anmerkung |
|---|---|---|
| `schema_version` | `version` | SemVer; MAJOR = Schema-Generation |
| `title` | `titel` | |
| `target_audience` | `zielgruppe` | gleiche eCH-0073-Werte |
| `preconditions` | `voraussetzungen` | |
| `steps` / `Step` | `schritte` / `Schritt` | |
| `step_id` (integer) | `id` (string, kebab-case) | Repo-Konvention: sprechende String-IDs |
| `actor` (string) | `akteur` → `akteure[]` | Akteure sind eigene Entitäten (Swimlanes, `einheit_ref` ins Org-Chart) |
| `depends_on` (DAG) | `flow` (Kanten) | Kanten tragen zusätzlich `bedingung`/`label`. Ableitung: `depends_on(s) = { von | (von→s) ∈ flow ohne loop-Kanten }` |
| `references` / `Reference` | `referenzen` / `Referenz` | |
| `reference_id` (integer) | `id` (string) | |
| `source_url` | `url` | |
| `source_quote` | `zitat` | |
| `retrieved_at` | `abgerufen` | Datum statt Timestamp |
| `reference_ids` | `referenzen` (am Schritt) | |
| `source_url`/`retrieved_at` (Prozess) | `quellen[]` (je `url` + `abgerufen`) | mehrere Quellen möglich |
| `lebenslage_ref` | `lebenslage_ref` | **Abweichung:** `id == lebenslage_ref` ist NICHT gefordert — eine Lebenslage kann auf mehrere Prozesse zeigen (N:M, z. B. Lebenslage `baugesuch` → Prozess `baubewilligung-ordentlich`). Bidirektionale Integrität prüft die CI |
| `title.leichte_sprache` | `titel.ls` | Locale-Key-Konvention des Repos |
| `disclaimer_key` | `disclaimer_key` | identisch |
| — (strikt azyklisch) | azyklisch bis auf `loop`-Kanten | **Abweichung:** reale Verfahren enthalten Nachbesserungs-Rücksprünge; diese sind als `loop`-Schritte explizit markiert und werden bei der DAG-Ableitung entfernt |

Nicht im tessera-Entwurf enthaltene, hier kanonische Erweiterungen:
`kurzbeschreibung`, `rechtsgrundlagen`, `unterlagen`, `reife` (digitale
Reife/Medienbrüche), `meta`, Schritt-`typ`-Taxonomie, `bedingung`-Kanten.

---

## Herkunft & Pflege

- Prozessdaten werden **von Hand** geschrieben (kein Scraping, keine
  LLM-Generierung, keine automatische Übersetzung).
- Jede Referenz braucht einen Deep-Link auf eine amtliche Quelle und — sobald
  verifiziert — die wörtliche Belegstelle. Nichts erfinden.
- Schema-Änderungen: MAJOR-Bump + Migrationsskript
  (`scripts/migrate-prozesse-schema-v<N>.mjs`), dann dieses Dokument
  aktualisieren. Bei Konflikten zwischen diesem Dokument und dem JSON-Schema
  gilt: erst klären, dann ändern — nicht raten.
