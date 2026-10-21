# syntax=docker/dockerfile:1
# Base images are pinned by digest. Official images are rebuilt for OS patches, so they are
# exempt from the 7-day minimum age that applies to dependencies.
FROM node:24.22.0-alpine3.24@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f AS build
# CI passes its npm registry. The lockfile's integrity hashes still verify every package.
ARG NPM_CONFIG_REGISTRY=https://registry.npmjs.org/
# npm reads npm_config_registry; pnpm 11 reads only pnpm_config_registry.
ENV npm_config_registry=${NPM_CONFIG_REGISTRY} pnpm_config_registry=${NPM_CONFIG_REGISTRY}
RUN npm install --global pnpm@11.5.2
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY tsconfig.json vite.config.ts postcss.config.js ./
COPY src ./src
ARG JELLYFIN_VERSION=Release
ARG COMMIT_SHA=
ENV JELLYFIN_VERSION=${JELLYFIN_VERSION} COMMIT_SHA=${COMMIT_SHA}
RUN pnpm build:production

FROM nginxinc/nginx-unprivileged:1.30.6-alpine3.24@sha256:f5116ed4606f3eb015dd4a8e28cb9b351476dc0ad4bc6e9f93b19cec130cdf03
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html/web
EXPOSE 8080
