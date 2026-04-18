FROM node:20-bookworm-slim AS build
# Debian-slim: avoids flaky Alpine/musl npm issues.
WORKDIR /app

COPY package*.json ./
RUN set -eu; \
    npm config set fetch-retries 5; \
    npm config set fetch-retry-mintimeout 20000; \
    npm config set fetch-retry-maxtimeout 120000; \
    for i in 1 2 3; do \
      rm -rf node_modules; \
      npm install --legacy-peer-deps --no-audit --no-fund --loglevel=error || true; \
      if [ -x node_modules/.bin/vite ] && [ -x node_modules/.bin/vue-tsc ]; then \
        echo "npm install succeeded (vite+vue-tsc present on attempt $i)"; break; \
      fi; \
      echo "attempt $i did not install devDependencies; retrying"; \
      sleep 5; \
    done; \
    test -x node_modules/.bin/vite; \
    test -x node_modules/.bin/vue-tsc

COPY . .
ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
