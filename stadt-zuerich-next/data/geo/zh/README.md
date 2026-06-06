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
- `geojsonUrl`/`typename` in der Config sind als Best-Effort hinterlegt
  (`verifiziert: false`) — vor dem ersten echten Abruf gegen die jeweilige
  Dataset-Seite (`datasetUrl`) prüfen.
- ODZ-WFS liefert teils LV95 (EPSG:2056); GeoJSON verlangt WGS84. Das Skript
  warnt bei LV95-artigen Koordinaten — ggf. Reprojektion ergänzen.
- Lizenz der Quelldaten: **CC-BY**, Attribution „Open Data Zürich, Stadt Zürich".
