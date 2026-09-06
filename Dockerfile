# syntax=docker/dockerfile:1
# AutoStock — image de production (Next.js + base SQLite embarquée).
#   docker build -t autostock . && docker run -p 3000:3000 -v autostock-data:/app/data autostock

# ---- Étape 1 : dépendances + build --------------------------------------------
FROM node:22-bookworm-slim AS builder
WORKDIR /app
# Outils de compilation : utilisés uniquement si un binaire précompilé (better-sqlite3, sharp) n'est pas disponible.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- Étape 2 : image d'exécution ----------------------------------------------
FROM node:22-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends tzdata ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    TZ=Africa/Algiers \
    DATABASE_PATH=/app/data/autostock.db \
    UPLOAD_DIR=/app/data/uploads \
    SEED_DEMO_DATA=true \
    PORT=3000
COPY --from=builder /app ./
# Données persistantes (base SQLite, images, imports) : à monter sur un volume / disque.
RUN mkdir -p /app/data/uploads /app/data/ocr-cache
VOLUME ["/app/data"]
EXPOSE 3000
# Les hébergeurs (Render, Railway, Fly…) injectent la variable PORT.
CMD ["sh", "-c", "node_modules/.bin/next start -H 0.0.0.0 -p ${PORT:-3000}"]
