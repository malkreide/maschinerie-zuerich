# v0-Gate: Nutzennachweis erbracht, tessera v1 freigegeben

**Status:** Abgenommen — 2026-06-29. Entscheid des Maintainers (`malkreide`).
Dieses Dokument hält die in `CLAUDE.md` («Baureihenfolge ist ein Gate»)
geforderte explizite Abnahme fest: ab wann die von Hand modellierten
v0-Prozesse als Nutzennachweis gelten und damit die Automatisierung durch
`tessera` (v1) freigeben.

> **Cardinal Rule bleibt:** Bindende Werte (Fristen, Gebühren, Rekursfristen)
> erscheinen weiterhin nur als belegte Reference (Label + Deep-Link +
> `source_quote`), nie als gerenderter Wert. Das Gate lockert diese Regel
> nicht — es bestätigt sie als erfüllt.

## Worum es beim Gate geht

v0 = einige von Hand modellierte Verwaltungsprozesse, die im öffentlichen
Vercel-Preview **beweisen**, dass Prozess-Graphen Bürger:innen helfen. Erst
wenn dieser Nutzen belegt ist, automatisiert `tessera` die Extraktion (v1).
Sinn des Gates: nichts auf Automatisierung stützen, bevor der Nachweis steht,
dass das Format überhaupt trägt.

## Abnahmekriterien

Das Gate gilt als bestanden, wenn v0 folgende Punkte materiell erfüllt:

1. **Mehrere echte Prozesse modelliert** (Ziel war 2–3 als Beweis).
2. **Bürgerverständlich und mehrsprachig** dargestellt (de Pflicht, plus
   en/fr/it und Leichte Sprache).
3. **Rechtlich sauber:** Kardinalregel eingehalten, bindende Werte belegt;
   Hochrisiko-Fälle mit sichtbarem Hochrisiko-Disclaimer.
4. **Im Preview live und benutzbar** (Detailseiten, Graph, ohne JS nutzbar).
5. **Datenintegrität maschinell abgesichert** (Validatoren + Regression-Guard
   grün).
6. **Rückkanal vorhanden:** Bürger:innen können Feedback geben, der Status
   ist öffentlich nachvollziehbar.
7. **Kanonischer Datenvertrag steht** als Schnittstelle, an die sich
   `tessera` angleicht.

## Belege (Stand 2026-06-29)

| Kriterium | Beleg |
|---|---|
| Prozesse modelliert | **17** Prozesse unter `stadt-zuerich-next/data/prozesse/zh/` (Ziel 2–3 deutlich übererfüllt) |
| Mehrsprachig | Alle 17 Prozesse durchgängig **de/en/fr/it/ls** auf Schritt-Ebene (FR/IT zuletzt via #170); UI in 5 Sprachen inkl. Leichter Sprache |
| Rechtlich sauber | Kardinalregel-Lint grün; bindende Werte nur als belegte `source_quote`; Hochrisiko-Fälle `baugesuch`, `sozialhilfe`, `veranstaltung` tragen `disclaimer_key: Prozesse.disclaimerHochrisiko` (sichtbar rot gerendert) |
| Live & benutzbar | Prozess-Detailseiten unter `/prozesse/[city]/[id]`, DAG-Graph, Progressive Enhancement; öffentlicher Preview (maschinerie-zuerich.ch) |
| Datenintegrität | `validate:prozesse`, `check:regression`, `validate:org`, `validate:catalog`, `check:portfolio`, `typecheck` und Unit-Tests grün in CI |
| Rückkanal | `/api/feedback` (datensparsam) + öffentliche Roadmap `/roadmap` (statusbasiert aus kuratierten GitHub-Issues, ohne Personendaten) |
| Datenvertrag | `docs/process-data-contract.md` kanonisch, `schema_version 0.1.0`; JSON-Schema `schemas/opengov-process-schema.json` |

## Entscheid

Die Abnahmekriterien sind erfüllt. **v0 erbringt den Nutzennachweis.**
Damit ist das Gate passiert und `tessera` (v1) ist freigegeben, struktur-only
Prozess-Extraktionen als Pull Requests an dieses Repo zu liefern.

Faktisch hat die Freigabe bereits begonnen: mehrere `tessera v1`-PRs sind
gemergt (struktur-only, Handdaten erhalten), feldweise integriert über den
Regression-Guard. Dieses Dokument macht den Schritt nachträglich explizit.

## Was nach dem Gate weiterhin gilt (Leitplanken)

Die Freigabe von v1 hebt die Schutzregeln **nicht** auf:

- **Kein automatischer Merge nach `main`.** Jede Änderung an Prozessdaten wird
  von einem Menschen reviewt (Human-in-the-Loop) — besonders bindende Werte
  und die Hochrisiko-Fälle.
- **Regression-Guard schützt die Handdaten:** eingehende Extraktion darf
  belegte i18n-/`description`-Texte nicht leeren; gemergt wird feldweise.
- **Kardinalregel und Hochrisiko-Disclaimer** bleiben für alle Prozesse
  verbindlich — auch für automatisch extrahierte.
- **Bei Abweichung gilt dieses Repo:** der kanonische Datenvertrag hier ist
  massgeblich, `tessera` gleicht sich daran an.

## Verweise

- `CLAUDE.md` — «Baureihenfolge ist ein Gate», «Eingehende tessera-PRs»,
  «Hochrisiko-Rechtsfälle», «Human-in-the-Loop»
- `docs/process-data-contract.md` — kanonischer Datenvertrag (Schnittstelle zu v1)
- Native-Speaker-Review der FR/IT-Erstbefüllung weiterhin offen: #100 (FR), #101 (IT)
