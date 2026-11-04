# syntax=docker/dockerfile:1

FROM docker.io/library/node:24-bookworm-slim AS base
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y $(apt-cache search --names-only '^libocct-(data-exchange|ocaf)-[0-9.]+$' | cut -d' ' -f1) && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

FROM base AS build
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y g++ libocct-data-exchange-dev libocct-ocaf-dev && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives
WORKDIR /app
COPY vendor/step2glb vendor/step2glb
RUN sh vendor/step2glb/build.sh /usr/local/bin/step2glb
COPY package.json package-lock.json ./
COPY patches patches
RUN npm ci
COPY . .
RUN npm run build

FROM base
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=build /usr/local/bin/step2glb /usr/local/bin/step2glb
COPY --from=build /app/package.json ./
COPY --from=build /app/server server
COPY --from=build /app/dist dist
USER node
EXPOSE 3000
CMD ["node", "server/index.ts"]
