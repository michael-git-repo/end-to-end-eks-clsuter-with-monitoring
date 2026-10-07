FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY public ./public
COPY scripts/build.mjs ./scripts/build.mjs
RUN npm run build
RUN mkdir -p /app/data && chown 65532:65532 /app/data

# Chainguard Node is a minimal Wolfi-based runtime, not Debian-based.
FROM cgr.dev/chainguard/node:latest AS runtime
ENV NODE_ENV=production PORT=8080 DATA_DIR=/app/data
WORKDIR /app
COPY --from=build --chown=65532:65532 /app/dist ./dist
COPY --from=build --chown=65532:65532 /app/data ./data
COPY --chown=65532:65532 server.mjs ./server.mjs
COPY --chown=65532:65532 stream-check.mjs ./stream-check.mjs
COPY --chown=65532:65532 visitors.mjs ./visitors.mjs
COPY --chown=65532:65532 metrics.mjs ./metrics.mjs
USER 65532:65532
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD ["/usr/bin/node", "-e", "fetch('http://127.0.0.1:8080/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["server.mjs"]
