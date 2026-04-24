# syntax=docker/dockerfile:1.7
#
# Multi-Stage-Build für die Maschinerie-App.
#
# Stages:
#   deps    → installiert nur package.json (Layer-Cache für schnelle Rebuilds)
#   builder → kompiliert Next.js mit output=standalone
#   runner  → schlanker Runtime (~150 MB), läuft als non-root user
#
# Die Node-Version kommt aus dem Alpine-Image. Sie muss mit der CI-
# Version (.github/workflows/ci.yml → node-version) übereinstimmen,
# sonst löst der npm-Resolver unterschiedliche Peer-Dep-Versionen auf
# und `npm ci` bricht ab mit "Missing: X from lock file".
#
# Aktuell: Node 24-alpine (matcht CI + lokales Dev-Setup).
# package.json → engines.node >=20.20.2 bleibt absichtlich permissiv,
# damit Downstream-Forks auch auf Node 20 bauen können.

ARG NODE_VERSION=24-alpine

# ─── Stage 1: deps ──────────────────────────────────────────────────────────
# Installiert nur die Abhängigkeiten. Eigener Stage, damit `npm ci` nur
# neu läuft, wenn sich package*.json geändert hat — Source-Änderungen
# triggern keinen Dependency-Download.
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# libc6-compat: Next.js benötigt glibc-kompatible Binaries für manche
# Native-Module (sharp etc.). Schadet auch ohne nicht.
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline --no-audit --fund=false

# ─── Stage 2: builder ───────────────────────────────────────────────────────
# Baut die App. Bekommt die fertigen node_modules aus deps.
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js sammelt im Build Telemetrie. Abschalten — Image soll reproduzierbar
# und offline-baubar bleiben.
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build: `output: 'standalone'` in next.config.ts erzeugt
# .next/standalone/ mit einem eigenständigen Node-Server.
RUN npm run build

# ─── Stage 3: runner ────────────────────────────────────────────────────────
# Minimaler Runtime-Image — nur was zum Laufen nötig ist.
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user. Next.js sucht automatisch nach `nextjs:nodejs`, kein
# Magic-Name — wir folgen nur der Dockerfile-Convention aus den offiziellen
# Next.js-Examples, damit Ownership-Commands einheitlich sind.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Public-Assets (SVG-Brand-Glyph etc.) separat, weil sie nicht im
# standalone-Bundle landen.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Standalone-Server + gestatic-Assets. standalone/ enthält einen eigenen
# server.js, der statt `next start` aufgerufen wird.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Org-Chart + Lebenslagen werden vom Server zur Laufzeit gelesen
# (fs.readFile auf city.orgChartPath / lebenslagenPath). standalone/
# traced diese Imports NICHT automatisch mit, weil der Pfad dynamisch
# aus der Config kommt — also explizit mitkopieren.
COPY --from=builder --chown=nextjs:nodejs /app/data ./data
COPY --from=builder --chown=nextjs:nodejs /app/config ./config

# LICENSE ins Image mitnehmen — MIT verlangt, dass die Copyright-Notice
# "in all copies or substantial portions of the Software" enthalten ist,
# und ein verteiltes Docker-Image zählt als Kopie.
COPY --from=builder --chown=nextjs:nodejs /app/LICENSE ./LICENSE

USER nextjs

EXPOSE 3000

# Healthcheck: /robots.txt ist statisch und immer verfügbar, belastet
# den Server nicht. wget ist in alpine bereits drin.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q --spider http://localhost:3000/robots.txt || exit 1

CMD ["node", "server.js"]
