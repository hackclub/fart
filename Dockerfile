# syntax=docker/dockerfile:1

FROM docker.io/library/node:24-bookworm-slim AS base

# OpenCascade is built from occt/ (the pinned release plus our patches) and linked statically into step2glb,
# so the runtime image carries no OpenCascade, image or font libraries. This stage only reruns when occt/ or
# vendor/step2glb changes.
FROM base AS occt
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y g++ make cmake curl ca-certificates patch && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives
WORKDIR /app
COPY occt/source.env occt/fetch.sh occt/build.sh occt/
COPY occt/patches occt/patches
RUN occt/fetch.sh && occt/build.sh native && rm -rf occt/work/occt occt/work/native/build occt/.cache
COPY vendor/step2glb vendor/step2glb
RUN sh vendor/step2glb/build.sh /usr/local/bin/step2glb

FROM base AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY patches patches
RUN npm ci
COPY . .
RUN npm run build

FROM base
# The server only needs node; the bundled package managers are dead weight with their own CVEs.
RUN rm -rf /usr/local/lib/node_modules /opt/yarn-* \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=occt /usr/local/bin/step2glb /usr/local/bin/step2glb
COPY --from=build /app/package.json ./
COPY --from=build /app/server server
COPY --from=build /app/dist dist
USER node
EXPOSE 3000
CMD ["node", "server/index.ts"]
