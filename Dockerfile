FROM node:22-alpine AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S fft && adduser -S fft -G fft \
  && mkdir -p /app/data /app/.cache \
  && chown -R fft:fft /app/data /app/.cache
COPY --from=builder --chown=fft:fft /app/.next/standalone ./
COPY --from=builder --chown=fft:fft /app/.next/static ./.next/static
COPY --from=builder --chown=fft:fft /app/public ./public
USER fft
VOLUME ["/app/data", "/app/.cache"]
EXPOSE 3000
CMD ["node", "server.js"]
