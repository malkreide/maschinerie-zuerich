# OpenGov-Process-Schema

Portables JSON-Schema (Draft-07) zur Beschreibung von Verwaltungsprozessen.
Jede Datei in `../data/prozesse/<city>/*.json` wird gegen
[`opengov-process-schema.json`](./opengov-process-schema.json) validiert.

**Kanonische Vertragsfassung:** [`docs/process-data-contract.md`](../../docs/process-data-contract.md)
im Repo-Root — dort stehen Kardinalregel, Validierungsregeln und die
Abbildung auf den (nicht-kanonischen) tessera-Entwurf. Bei Konflikt gilt
der Vertrag.

## Stabile URL (für andere Städte / externe Tools)

Das Schema liegt unter einer raw-fetchbaren URL — identisch mit dem `$id`
im Schema selbst:

```
https://raw.githubusercontent.com/malkreide/maschinerie-zuerich/main/stadt-zuerich-next/schemas/opengov-process-schema.json
```

Andere Städte, die unsere „Maschinerie"-Visualisierung nutzen wollen,
referenzieren diese URL als `$schema` in ihren Prozess-Dateien und können
ihre Daten mit `ajv -s <URL> -d '<datei>.json' --strict=false` validieren,
ohne den Repo klonen zu müssen. Die URL folgt dem `main`-Branch; wer
Version-Stabilität will, pinnt einen Commit-SHA statt `main`.

Schema-Referenz im Code (ajv kompiliert von der lokalen Datei): der `$id`
ist nur Metadaten, der tatsächliche Load-Pfad steht in
`scripts/validate-prozesse.mjs`. Schema-Content und URL müssen daher nur
bei MAJOR-Bumps zueinander passen.

## Validieren

```bash
cd stadt-zuerich-next
npm run validate:prozesse
```

Prüft zwei Stufen:

1. **Formale Validierung** via [ajv](https://ajv.js.org/) gegen das
   JSON-Schema (Typen, Enums, Pflichtfelder, `format: uri/date`).
2. **Semantische Validierung** (Referenz- und Graph-Konsistenz):
   - `schritt.akteur` muss in `akteure[].id` existieren
   - `flow.von` / `flow.nach` müssen in `schritte[].id` existieren, kein Selbstbezug
   - `schritt.quelle` muss in `quellen[].id` existieren
   - `schritt.referenzen` müssen in `referenzen[].id` existieren; IDs eindeutig
   - Grounding-Gate: Referenz mit `status: "verifiziert"` braucht ein
     nicht-leeres `zitat` (Fehler); `unverifiziert` ohne Zitat → Warnung
   - Azyklisch bis auf Rücksprünge: ohne die Kanten aus `typ: "loop"`-Schritten
     muss der Graph ein DAG sein
   - Kardinalregel-Lint: Zahl + bindende Einheit (CHF, Fr., Franken, %,
     Tag(e), Woche(n), Monat(e), Jahr(e)) in gerenderten Texten → Fehler
   - `lebenslage_ref` existiert in den Lebenslagen der Stadt und verlinkt zurück
   - `ende`-Knoten dürfen keine ausgehenden Kanten haben
   - Unerreichbare Knoten / fehlender Start → Warnung (kein Fehler)
   - Entscheidungsknoten mit <2 Ausgängen oder ohne `bedingung`-Label → Warnung

Der Validator läuft auch in CI als eigener Job `prozesse-validation`
(siehe `.github/workflows/ci.yml`).

## Struktur-Cheatsheet

```jsonc
{
  "id": "baubewilligung-ordentlich",        // [a-z0-9-]+
  "version": "2.0.0",                        // SemVer; MAJOR = Schema-Generation
  "city": "zh",                              // ISO-ähnliche Kennung
  "titel": {                                 // i18n-String: string oder Objekt
    "de": "...",  "en": "...",  "ls": "..."
  },
  "lebenslage_ref": "baugesuch",             // ID in data/<city>/lebenslagen.json
  "zielgruppe": "bevoelkerung",              // eCH-0073: bevoelkerung|wirtschaft|behoerden
  "quellen": [
    { "id": "q-x", "titel": "...", "url": "https://…", "abgerufen": "2026-06-10" }
  ],
  "referenzen": [                            // bindende Werte NUR hier (Kardinalregel)
    { "id": "r-gebuehr", "label": { "de": "Gebühr für …" },  // ohne Zahl!
      "url": "https://…", "zitat": "wörtliche Belegstelle",
      "status": "verifiziert", "abgerufen": "2026-06-10" }
  ],
  "akteure": [
    { "id": "bauherr", "label": {...}, "typ": "antragsteller" },
    { "id": "amt",     "label": {...}, "typ": "behoerde", "einheit_ref": "u-afb" }
  ],
  "schritte": [
    { "id": "start", "typ": "start", "akteur": "bauherr", "label": {...} },
    { "id": "...",   "typ": "input|prozess|entscheidung|loop|warten|ende",
                     "akteur": "...", "label": {...},
                     "referenzen": ["r-gebuehr"] }
  ],
  "flow": [
    { "von": "start", "nach": "..." },
    { "von": "entscheidung-x", "nach": "...", "bedingung": "ja" }
  ]
}
```

## Neuen Prozess anlegen

1. Neue Datei `data/prozesse/<city>/<prozess-id>.json` erzeugen.
   `city` = Stadt-/Gemeindekennung (`zh`, `be`, `basel`, …); `<prozess-id>`
   eindeutig innerhalb der Stadt.
2. Als erste Zeile `"$schema": "../../../schemas/opengov-process-schema.json"`
   eintragen — dann erkennt VS Code / WebStorm das Schema automatisch.
3. `npm run validate:prozesse` ausführen bis alles grün.
4. In `data/prozesse/<city>/README.md` (falls vorhanden) Quelle + Stand
   dokumentieren — die CC-BY-Lizenz des Prozesses greift nur, wenn die
   Quelle nachvollziehbar ist.

## Schema-Änderungen

Breaking Changes am Schema → MAJOR-Bump + Migrations-Skript.

### Konvention

- `scripts/migrate-prozesse-schema-v<N>.mjs` — migriert _zu_ Schema-MAJOR `N`.
- `scripts/_migrate-lib.mjs` — geteiltes Plumbing (File-Walk, Version-Guard,
  Dry-Run, atomares Schreiben, Diff-Log). Konkrete Migrationen liefern nur
  die pure `transform(prozess, ctx) → prozess`-Funktion.

### Ablauf einer Migration (Checkliste)

1. `cp scripts/migrate-prozesse-schema-v2.mjs scripts/migrate-prozesse-schema-v<N>.mjs`
2. `fromVersion` / `toVersion` setzen, `transform()` mit den echten
   Transformationen befüllen.
3. Script-Alias in `package.json` ergänzen: `"migrate:schema:v<N>": "node scripts/migrate-prozesse-schema-v<N>.mjs"`.
4. `npm run migrate:schema:v<N>` → Dry-Run prüfen.
5. `npm run migrate:schema:v<N> -- --write` → tatsächlich anwenden.
6. `schemas/opengov-process-schema.json` auf die neue Struktur anheben
   (nur jetzt, nicht vorher — sonst scheitert Schritt 4 an `validate:prozesse`).
7. `npm run validate:prozesse` → alle Dateien valide gegen neues Schema.
8. `npm run typecheck && npm run build`.
9. Commit mit `chore(schema): bump to v<N>`.

### Die v2-Migration

`scripts/migrate-prozesse-schema-v2.mjs` wurde für die Generation 2
ausgeführt (Kardinalregel: `dauer_est` entfernt, `kosten_chf` → Referenzen
mit `status: "unverifiziert"`, neue Pflichtfelder `lebenslage_ref` /
`zielgruppe`). Für künftige Migrationen die Datei nach
`migrate-prozesse-schema-v<N>.mjs` kopieren und die Checkliste oben abarbeiten.
