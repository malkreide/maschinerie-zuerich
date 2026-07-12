# Geo-Snapshots (Stadt Zürich)

Dieses Verzeichnis enthält die committe-baren GeoJSON-Snapshots der Geo-Layer
für die Territory-Ansicht (`/api/geo`).

## Erzeugen / Aktualisieren

```bash
npm run data:fetch-geo
```

Das Skript (`scripts/fetch-geo.mjs`) liest `config/geo-layers.json`, lädt je
Layer das GeoJSON von Open Data Zürich, normalisiert es und schreibt hierher
`<layer>.geojson` (z. B. `schools.geojson`, `recycling.geojson`,
`playgrounds.geojson`) inklusive Provenance (`_meta`: Quelle, Lizenz, Stand).

## Verhalten

- **Snapshot vorhanden** → `/api/geo` liefert echte Daten, das Frontend zeigt
  das Badge **„Publiziert"** mit Quelle/Stand.
- **Snapshot fehlt** → der Layer fällt auf zufällige Demo-Punkte zurück, Badge
  **„Demodaten"**.

## Hinweise

- Die Stadt-Zürich-Hosts (`data`/`ogd`/`gis.stadt-zuerich.ch`) müssen für den
  Abruf netzwerkseitig erreichbar sein (Allowlist). In abgeschotteten CI-/
  Sandbox-Umgebungen schlägt der Abruf bewusst fehl.
- Die `datasetUrl`-Slugs sind verifiziert; der `typename` in `geojsonUrl` ist
  eine Annahme (`verifiziert: false`). Den exakten Layernamen aus der
  `capabilitiesUrl` (WFS `GetCapabilities`) übernehmen und `verifiziert: true`
  setzen.
- Die `geojsonUrl` enthält bereits `srsName=EPSG:4326` → Antwort in WGS84.
  Liefert ein Dienst dennoch LV95 (EPSG:2056), warnt das Skript bei
  LV95-artigen Koordinaten; dann Reprojektion ergänzen.
- Lizenz der Quelldaten: **CC-BY**, Attribution „Open Data Zürich, Stadt Zürich".

## Stadtkreis-Ansicht (`/quartier`)

Die Quartier-Ansicht berechnet Fläche und Standort-Zahlen je Stadtkreis aus
`public/data/stadtkreise.geojson`. Enthält die Datei noch **Platzhalter-
Rechtecke**, erkennt die Ansicht das automatisch und zeigt ein „Demodaten"-Badge.

Echte Grenzen holen:

```bash
npm run data:fetch-stadtkreise
```

Das Skript (`scripts/fetch-stadtkreise.mjs`) lädt die amtlichen Stadtkreis-
Polygone via WFS aus [`geo_stadtkreise`](https://data.stadt-zuerich.ch/dataset/geo_stadtkreise),
mappt die Properties auf `kname`/`knr` und schreibt `public/data/stadtkreise.geojson`.
Danach werden Fläche und Standort-Zählung ohne Code-Änderung real (Badge wechselt
auf „aggregiert"). Voraussetzung wie bei `data:fetch-geo`: ODZ-Hosts erreichbar.
