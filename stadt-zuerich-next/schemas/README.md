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
   - `id == lebenslage_ref` (Vertrag); Dateiname = `<id>.json`
   - `step_id` eindeutig; `depends_on` verweist nur auf existierende
     `step_id`s; kein Selbstbezug; mindestens ein Start-Schritt
     (leeres `depends_on`); Graph über `depends_on` ist azyklisch (DAG)
   - `loops_back_to` nur an `type: "loop"`-Schritten (Rendering-Hinweis,
     fliesst nicht in den DAG-Check ein)
   - `reference_id` eindeutig; `reference_ids` verweisen auf existierende
     `references`; `steps[].actor` referenziert `actors[].id`
   - Grounding-Gate: Reference mit `status: "verifiziert"` braucht ein
     nicht-leeres `source_quote` (Fehler); `unverifiziert` ohne Zitat → Warnung
   - Kardinalregel-Lint: Zahl + bindende Einheit (CHF, Fr., Franken, %,
     Tag(e), Woche(n), Monat(e), Jahr(e)) in gerenderten Texten → Fehler
   - `lebenslage_ref` existiert in den Lebenslagen der Stadt und verlinkt zurück
   - Unerreichbare Schritte → Warnung (kein Fehler)

Der Validator läuft auch in CI als eigener Job `prozesse-validation`
(siehe `.github/workflows/ci.yml`).

## Struktur-Cheatsheet

```jsonc
{
  "schema_version": "0.1.0",                 // SemVer der Vertragsversion
  "id": "baugesuch",                         // [a-z0-9-]+, == lebenslage_ref
  "lebenslage_ref": "baugesuch",             // ID in data/<city>/lebenslagen.json
  "city": "zh",                              // Erweiterung: Kennung, Slug <city>/<id>
  "title": { "de": "...", "en": "...", "ls": "..." },  // i18n; de Pflicht
  "target_audience": "bevoelkerung",         // eCH-0073: bevoelkerung|wirtschaft|behoerden
  "preconditions": [ { "de": "..." } ],
  "source_url": "https://…",                 // primäre amtliche Quelle
  "retrieved_at": "2026-06-10",
  "disclaimer_key": "Prozesse.disclaimer",
  "references": [                            // bindende Werte NUR hier (Kardinalregel)
    { "reference_id": 1, "label": { "de": "Gebühr für …" },  // ohne Zahl!
      "source_url": "https://…", "source_quote": "wörtliche Belegstelle",
      "status": "verifiziert", "retrieved_at": "2026-06-10" }
  ],
  "actors": [                                // Erweiterung: Swimlanes + Org-Chart-Brücke
    { "id": "bauherr", "label": {...}, "type": "antragsteller" },
    { "id": "amt",     "label": {...}, "type": "behoerde", "einheit_ref": "u-afb" }
  ],
  "steps": [
    { "step_id": 1, "actor": "bauherr", "label": {...}, "depends_on": [],
      "type": "start" },
    { "step_id": 2, "actor": "amt", "label": {...},
      "depends_on": [ 1, { "step_id": 1, "condition": { "de": "ja" } } ],
      "reference_ids": [1],
      "type": "input|prozess|entscheidung|loop|warten|ende" }
  ]
}
```

## Neuen Prozess anlegen

1. Neue Datei `data/prozesse/<city>/<id>.json` erzeugen.
   `city` = Stadt-/Gemeindekennung (`zh`, `be`, `basel`, …); `<id>` =
   `lebenslage_ref` der zugehörigen Lebenslage (Vertrag: `id == lebenslage_ref`).
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

### Bisherige Migrationen

- `scripts/migrate-prozesse-schema-v2.mjs` — Generation 1 → 2 (Kardinalregel:
  `dauer_est` entfernt, `kosten_chf` → Referenzen mit `status:
  "unverifiziert"`).
- `scripts/migrate-prozesse-contract.mjs` — Generation 2 → kanonischer
  Vertrag (englische Feldnamen, Integer-IDs, `flow` → `depends_on` +
  `loops_back_to`, `id == lebenslage_ref` inkl. Datei-Umbenennung). Läuft
  bewusst nicht über `_migrate-lib.mjs`, weil das Versionsfeld selbst
  umbenannt wird.

Für künftige Migrationen die Checkliste oben abarbeiten.
