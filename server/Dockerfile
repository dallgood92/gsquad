FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate

FROM build AS production-dependencies
RUN npm prune --omit=dev --omit=optional

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache dumb-init
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY middleware ./middleware
COPY routes ./routes
COPY validation ./validation
COPY index.js redis.js storage.js websocket.js ./
USER node
EXPOSE 3001
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "index.js"]

FROM build AS migration
ENV NODE_ENV=production
ENTRYPOINT ["npx", "prisma"]
CMD ["migrate", "deploy"]
