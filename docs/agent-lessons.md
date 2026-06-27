# Lektionen für einen autonomen Recherche- & Publikations-Agenten

> Retrospektive aus einer realen Arbeitssession an `maschinerie-zuerich`:
> Doku-Korrekturen, flächige Link-Rot-Bereinigung, Aufbau zweier Werkzeuge
> (Live-Link-Check, Belegstellen-Extraktor) und das erstmalige wörtliche
> Belegen bindender Rechtswerte (Fristen, Gebühren, Gültigkeiten).
>
> Zweck dieses Dokuments: die **Hürden, Sackgassen und Designprinzipien**
> festhalten, die beim Bau eines Agenten zählen, der Informationen und Prozesse
> selbständig sucht, Vorschläge macht und sie in dieses Repo publiziert
> (Kontext: `tessera`). Es ist bewusst lösungs-, nicht datenstand-bezogen —
> der konkrete Stand einzelner References veraltet, die Lektionen nicht.

## TL;DR — die Meta-Lektion

Der gefährlichste Output ist **nicht** der sichtbare Fehlschlag, sondern der
**plausibel-aber-falsche Treffer**: richtige Seite, falscher Paragraph; eine
30-Tage-Frist, die zur Bezahlung statt zur Einsprache gehört; ein Gebührenbetrag,
der dem falschen Ausweis zugeordnet ist. Ein Agent in einem rechtlich sensiblen
Feld muss zu **verbatim-Grounding und Abstinenz** tendieren, nicht zu Abdeckung.
«Link, don't assert» ist nicht nur eine Repo-Regel, sondern das richtige
Grundprinzip.

---

## A. Der bewährte Workflow (vier getrennte Stufen)

Für jeden bindenden Wert (Gebühr, Frist, Gültigkeit) liefen real vier getrennte
Schritte — und an deren Nahtstellen passieren die Fehler:

1. **Discovery** — die korrekte amtliche URL finden und auf HTTP 200 verifizieren.
2. **Fetch/Render** — den Seiteninhalt als lesbaren Text beschaffen.
3. **Extraktion** — die belegende Passage kandidieren.
4. **Urteil** — entscheiden, ob die Passage **genau** den im Label genannten
   Wert belegt; sonst abstinieren.

Schritt 4 ist der gefährlichste und am wenigsten automatisierbare. Diese vier
Stufen im Agenten sauber trennen — sie haben verschiedene Fehlermodi und
verschiedene Vertrauensniveaus.

---

## B. Hürden & Sackgassen (mit Ursache)

### 1. Link-Rot ist der Normalzustand, nicht die Ausnahme
- `stadt-zuerich.ch` hat komplett umstrukturiert
  (`/fd|pd|sd|ssd|ted/de/index/…` → `/de/lebenslagen/…`), `zh.ch`-Seiten
  verschoben, `zhlaw.ch` liefert 410, `ch.ch`-Slugs änderten sich **innerhalb
  weniger Tage** (eine URL war erst 200, dann 404).
- Der erste Live-Check fand **25 tote Links** im bestehenden, vermeintlich
  fertigen Datenbestand.
- **Konsequenz:** Gespeicherte URLs sind flüchtig. Re-Verifikation muss laufend
  passieren, nicht einmalig.

### 2. «Text im HTML» ist gemischt — SSR vs. echte SPA
- `stadt-zuerich.ch`/`zh.ch` (neu) sind serverseitig gerendert → `curl`/`fetch`
  genügt.
- `fedlex.admin.ch`/`ch.ch` sind echte JS-SPAs → ohne Browser nur eine leere
  Hülle (fedlex: 1197 Zeichen Hülle vs. 682 037 Zeichen gerendert).
- **Sackgasse:** Die pauschale Annahme «alle sind SPAs» führte zu unnötigem
  Headless-Browser-Zwang. Erst SSR per HTTP versuchen, SPA nur als Fallback.

### 3. Die Ausführungsumgebung ist browser-feindlich und variabel
- In der Cloud-Session: `admin.ch` per Netzpolicy gesperrt; der Egress-Proxy
  tunnelt Chromium gar nicht (`ERR_CONNECTION_CLOSED` — auch mit Proxy-Option,
  `--ignore-certificate-errors`, `--disable-http2`; vier Versuche, alle tot).
  TLS-Interception → Chromium-Cert-Fehler.
- Aber: `curl`/Node-`fetch` gehen durch den Proxy (mit `NODE_USE_ENV_PROXY=1`).
- **Konsequenz:** Headless-Browsing kann dort, wo der Agent läuft, unmöglich
  sein. Der Agent muss seine Fähigkeiten erkennen und degradieren — oder das
  Rendering dorthin verlagern, wo es geht (lokal/CI).

### 4. Keyword-Ranking bricht auf riesigen Einzelseiten zusammen
- Das ganze ZGB liegt auf einer fedlex-Seite. Stichwort- plus
  Bindewert-Ranking schwemmte falsche Artikel nach oben (Erbausschlagung statt
  Ehefähigkeit). Der gesuchte Art. 94 tauchte trotz Stichwortfilter über
  mehrere Iterationen nie auf (falsch geratene Wendungen, Segment-Längen-Cap,
  Überschrift/Artikel-Verklebung).
- **Sackgasse:** «grep-Roulette» — mehrere Runden mit geratenen Begriffen, am
  Ende manuelle Copy nötig.
- **Konsequenz:** Für grosse Rechtskorpora braucht es strukturbewusste
  Extraktion (nach Artikel-Nummer/Anker), nicht Bag-of-Words.

### 5. Richtige Seite, falscher Wert — der gefährlichste Fehler
- Beispiel Steuer-Einsprache: Das Label meinte die Einsprache **gegen die
  Veranlagung** (§ 140 StG); die verlinkte Seite handelte von der **Bezahlung**
  (§ 178) — eine andere 30-Tage-Frist. Alle Kandidaten waren «innert 30 Tagen
  zu bezahlen» und hätten das Label plausibel-aber-falsch belegt.
- **Konsequenz:** Nicht «irgendeine bindende Zahl» finden, sondern den
  spezifischen Wert des Labels (Einsprache ≠ Zahlung; Pass ≠ Identitätskarte;
  Erwachsene ≠ Kinder). Plausibel-falsch ist schlimmer als ein sichtbarer
  Fehlschlag.

### 6. Tarife stehen in Tabellen-Widgets, nicht in Sätzen
- Abfall- und Pass-/ID-Gebühren liegen als eingebettetes JSON in JS-Tabellen —
  kein sauberer verbatim Satz «X kostet Y Fr.»; zudem Mehrdeutigkeit (welcher
  Betrag = welche Leistung). Eine zu dünne Bürgerseite (Bundesportal) renderte
  selbst im Browser nur ~900 Zeichen.
- **Konsequenz:** Tabellarische Bindewerte brauchen eine andere
  Extraktion/Darstellung als Prosa-Zitate; bei unklarer Zuordnung abstinieren.
  (Der gerenderte Tabellentext liess sich später lokal als verbatim Block
  belegen — aber erst, als Browser-Rendering **und** offener Netzzugang da waren.)

### 7. Tooling-Fallen (kosten still Zeit)
- `npm run script -- --flag` verschluckt die Flags (Windows/PowerShell) → das
  Skript lief im falschen Modus, ohne Fehlermeldung. Fix: `node script.mjs`
  direkt aufrufen.
- Bibliotheks-APIs ändern zwischen Major-Versionen (z. B. der PDF-Parser).
- **Konsequenz:** Agent-Aufrufe müssen robust und selbstprüfend sein (Annahmen
  verifizieren, nicht blind iterieren).

### 8. Verbatim-Treue ist fragil
- HTML→Text-Normalisierung (Whitespace, `&nbsp;`, Entities), Satztrennung an
  Ordinalzahlen («30. Juni»), abschneidende Schlusszeichen → der Drift-Check
  meldete sogar bereits verifizierte Zitate als «nicht verbatim» (meist
  Formatierungs-Artefakte, Werte aber unverändert).
- **Konsequenz:** Identische Normalisierung bei Speichern und Re-Check; robuste
  Substring-Prüfung.

### 9. Quellen driften über die Zeit
- Schon verifizierte Zitate können still verrutschen (Seitenedits). Der
  Drift-Check über alle References ist Pflicht-Hygiene, kein Luxus.

---

## C. Designprinzipien für den Agenten

1. **Discovery → Fetch → Extraktion → Urteil als getrennte Stufen** mit je
   eigener Konfidenz und eigenem Abbruch. Das Urteil ist der Gate für
   Publikation.

2. **Multi-modaler Fetch mit Auto-Erkennung:** HTTP + HTML→Text zuerst; SPA
   erkennen (geringe Textlänge, App-Shell-Marker wie `window.__NUXT__` /
   `__NEXT_DATA__`) → Headless-Fallback; für Gesetze maschinenlesbare Form
   bevorzugen (PDF/XML/Akoma Ntoso). Gesetzes-PDFs sind oft der zuverlässigste,
   paragraphen-adressierbare Pfad.

3. **Strukturbewusste Extraktion für Recht:** nicht das ganze Gesetzbuch
   durchsuchen, sondern per Erlass + §/Art-Nummer/Anker navigieren. Ein
   «Artikel-Fetcher» (Eingang: Erlass + Paragraph) schlägt Bag-of-Words.

4. **Label↔Wert-Abgleich als konservativer Pflicht-Gate:** Der Kandidat muss
   (a) den Werttyp des Labels enthalten (Frist/Gebühr/Gültigkeit) und (b) das
   richtige Subjekt betreffen. Bei Mehrdeutigkeit nicht publizieren, sondern als
   offen mit Begründung markieren. **Default = Abstinenz.**

5. **Verbatim-Vertrag + periodische Re-Verifikation:** Zitat exakt wie gerendert
   speichern; vor Publikation per Re-Fetch und identischer Normalisierung als
   Substring bestätigen; Drift-Check als Cron/CI.

6. **Link-Rot-Resilienz:** keiner gespeicherten URL trauen; vor Nutzung
   HTTP-Status prüfen; bei 404/410 Re-Discovery auslösen (offizielle Domain nach
   der aktuellen Seite durchsuchen) und neue URL vorschlagen, nicht still
   ersetzen.

7. **Umgebungs-Bewusstsein & Degradation:** Fähigkeiten erkennen (Quelle
   erreichbar? Browser durch Proxy?) und abstufen. Unerreichbares ehrlich als
   «braucht Umgebung mit X» melden — nie faken. Schweres Fetching dort
   ausführen, wo es geht (lokal/CI).

8. **Tabellarische Bindewerte gesondert behandeln:** als Tabelle/Widget
   erkennen; entweder aus der zugrundeliegenden Datenstruktur mit explizitem
   Feld→Label-Mapping extrahieren, oder abstinieren. Ggf. den Datenvertrag um
   tabellarische Gebühren erweitern (oder konsequent nur verlinken).

9. **Risiko-kalibrierte Autonomie + Human-in-the-Loop:** Hochrisiko (bindende
   Rechtswerte; `baugesuch`/`sozialhilfe`/`veranstaltung`) → immer nur
   vorschlagen, nie auto-publizieren. Strukturelle/Übersetzungs-Lücken → mehr
   Autonomie. Jeder Vorschlag trägt Konfidenz + Provenienz.

10. **Die repo-eigenen Guards als Agent-Leitplanken nutzen:** Der Agent soll PRs
    erzeugen, die `validate:prozesse` (Grounding-Gate + Kardinalregel-Lint),
    `check:regression` (keine kuratierten Daten schrumpfen) und `check:links`
    bestehen. **Rotes CI = harter Stopp.** Diese mechanischen Gates sind
    verlässlicher als das Sprachmodell-Urteil — den Agenten so entwerfen, dass
    er sie erfüllt, statt sie zu umgehen.

11. **Tri-State statt binär bei Erreichbarkeit:** «tot (404/410)» ≠ «blockiert
    (403/Policy)» ≠ «Netzfehler». Diese Unterscheidung verhindert, dass
    umgebungsbedingte Fehler als Datenfehler erscheinen.

12. **Deterministische, selbstprüfende Schritte statt blinder Iteration:**
    Werkzeuge direkt aufrufen, Lib-APIs inspizieren, eigene Annahmen
    verifizieren, bevor ein Mensch involviert wird. Jede Iteration mit
    Mensch-im-Loop ist teuer.

---

## D. Was gut funktioniert hat (beibehalten)

- **Propose-don't-write:** Das Extraktions-Werkzeug schreibt nie in die Daten —
  ein Mensch bzw. ein Gate publiziert. Genau richtig für bindende Werte.
- **URL-vor-Adoption auf HTTP 200 prüfen** (Doppel-Check, nicht einer
  Recherche-Quelle blind vertrauen).
- **Subagent-Fan-out** für URL-Recherche (Dutzende tote Links) — gut
  parallelisierbar, liefert nur die geprüfte Zuordnung zurück.
- **Bestehende Vertrags-Infrastruktur** (JSON-Schema, Grounding-Gate,
  Kardinalregel-Lint, Regression-Guard, Link-Check): ungewöhnlich gutes Gerüst.
  Der Agent soll sich darauf stützen, nicht daneben bauen.
- **Konservative Abstinenz:** Lieber wenige sauber belegte References als viele
  mit einem falschen Gebührenbetrag. Der Wert des Systems steht und fällt mit
  der Vertrauenswürdigkeit der bindenden Werte.

---

## E. Werkzeuge, die in dieser Session entstanden sind

Beide leben unter `stadt-zuerich-next/scripts/` und sind Vorlagen, an die ein
Agent andocken kann:

- **`check-links.mjs`** — struktureller Link-Check (CI-Gate, netzfrei) plus
  Live-HTTP-Modus (`--online`), der tote Links kategorisiert (tot / blockiert /
  netzfehler) und pro Befund die betroffenen Dateien nennt. Zeitgesteuert im
  Workflow `.github/workflows/link-rot.yml`.
- **`extract-quotes.mjs`** — schlägt verbatim `source_quote`-Kandidaten vor,
  rendert via HTTP (`--fetch`, für SSR) oder Headless-Browser (für SPAs),
  grenzt grosse Seiten mit `--grep` ein und prüft bestehende Zitate gegen die
  Live-Seite (`--all-refs`, Drift-Check). Schreibt nie in die Daten.

Beide spiegeln die Prinzipien oben: Tri-State-Erreichbarkeit, multi-modaler
Fetch, Propose-don't-write, Drift-Verifikation.
