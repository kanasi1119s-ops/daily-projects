# Reference Dockerfile for PulseBoard.
# NOTE: this is prepared as deploy config only — the automated pipeline that
# generated this project does NOT build, push, or run this image anywhere.
# A human should build/test it locally before using it to deploy.

FROM node:20-alpine AS base
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY public ./public

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# PulseBoard persists monitors/checks/incidents/plan to a JSON file under
# /app/data (see server/persistence.js). Mount a volume here
# (`docker run -v pulseboard-data:/app/data ...`) so data survives the
# container being removed and recreated, not just an in-process restart.
VOLUME ["/app/data"]

# Basic container healthcheck against the public status API.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/status').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
