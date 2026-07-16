# Remediation-Plan: maschinerie-zuerich — Stand 2026-07-15

**Basis:** [Audit-Report 2026-07-15](reports/2026-07-15-audit.md) · Score: 89/100 · Ziel: ≥ 90, null offene critical/high

Gute Nachricht: Alle drei Findings haben Effort **S–M**. Welle 1 (zwei S-Fixes) hebt die Lösung auf release-ready.

## Spielregeln

- Ein Finding = ein Commit, Format: `fix(<kategorie>): <beschreibung> [<CHECK-ID>]`
- Nach jedem Fix: Checkbox abhaken, Finding-Status auf `in-remediation`

## Welle 1 — Release-Blocker (high, Effort S)

- [x] **A11Y-009** prefers-reduced-motion fehlt (high, S) — [Finding](findings/2026-07-15-A11Y-009.md) ✅ Commit `0e621f8`
      Globale `@media (prefers-reduced-motion: reduce)`-Regel in `app/globals.css` + Beacon-Stopp. Lokal verifiziert (`reducedMotionCSS: true`).
- [x] **A11Y-004** Heading-Sprung h1→h4 (high/partial, S) — [Finding](findings/2026-07-15-A11Y-004.md) ✅ Commit `0e621f8`
      `<h4>` → `<h2>` in `components/Legend.tsx` (Heading-Komponente). Lokal verifiziert (0×h4, `maxLevelJump: 1`).

## Welle 2 — Inhalt/Verständlichkeit (medium)

- [ ] **USE-002** Fachjargon für public (medium/partial, S–M) — [Finding](findings/2026-07-15-USE-002.md)
      Erster Schritt: Info-Popover für «Nettoaufwand», «FTE», «Kürzel» + Klartext-Zeile in der Marker-Legende (i18n-Strings existieren bereits).

## Welle 3 — Polish (low, Backlog)

- [ ] Statuszeile «Datenstand …» von 10px auf ≥ 12px anheben (A11Y-005/Lesbarkeit)
- [ ] Header-Toggles auf 44px Zielhöhe via Padding (A11Y-010 Best-Practice)
- [ ] Prüfen, ob Finanz-/Marker-Datenschicht in eine optionale «Fachansicht» gehört (USE-008, koppelt an USE-002)

## Nicht angegangen (accepted-risk)

| Check | Begründung | Entschieden von | Datum |
|---|---|---|---|
| — | | | |

---

**Nach Welle 1:** Re-Audit auslösen (Phase C). Erwarteter Score danach ~97, release-ready.
