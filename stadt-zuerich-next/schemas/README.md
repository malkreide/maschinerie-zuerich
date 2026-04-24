# OpenGov-Process-Schema

Portables JSON-Schema (Draft-07) zur Beschreibung von Verwaltungsprozessen.
Jede Datei in `../data/prozesse/<city>/*.json` wird gegen
[`opengov-process-schema.json`](./opengov-process-schema.json) validiert.

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
   - `flow.von` / `flow.nach` müssen in `schritte[].id` existieren
   - `schritt.quelle` muss in `quellen[].id` existieren
   - `ende`-Knoten dürfen keine ausgehenden Kanten haben
   - Unerreichbare Knoten / fehlender Start → Warnung (kein Fehler)
   - Entscheidungsknoten mit <2 Ausgängen oder ohne `bedingung`-Label → Warnung

Der Validator läuft auch in CI als eigener Job `prozesse-validation`
(siehe `.github/workflows/ci.yml`).

## Struktur-Cheatsheet

```jsonc
{
  "id": "baubewilligung-ordentlich",        // [a-z0-9-]+
  "version": "0.1.0",                        // SemVer
  "city": "zh",                              // ISO-ähnliche Kennung
  "titel": {                                 // i18n-String: string oder Objekt
    "de": "...",  "en": "...",  "ls": "..."
  },
  "akteure": [
    { "id": "bauherr", "label": {...}, "typ": "antragsteller" },
    { "id": "amt",     "label": {...}, "typ": "behoerde", "einheit_ref": "u-afb" }
  ],
  "schritte": [
    { "id": "start", "typ": "start", "akteur": "bauherr", "label": {...} },
    { "id": "...",   "typ": "input|prozess|entscheidung|loop|warten|ende",
                     "akteur": "...", "label": {...},
                     "dauer_est": { "min": 4, "max": 12, "einheit": "wochen" } }
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

### Das v2-Template

`scripts/migrate-prozesse-schema-v2.mjs` existiert bereits — als dormantes
Template mit 5 kommentierten Beispiel-Patterns (Feld umbenennen, Default
setzen, Enum splitten, Datums-Format konvertieren, Block hinzufügen). Bis
das Schema wirklich v2 braucht, steht `fromVersion: '1.'` — passt auf keine
heutige Datei, Script ist ein No-Op.
