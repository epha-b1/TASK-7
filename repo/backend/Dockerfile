FROM node:20-bookworm-slim
# Debian-slim base: avoids the Alpine-on-some-hosts npm "Exit handler never
# called" intermittent failure that leaves devDeps partially installed.
WORKDIR /app

COPY package*.json ./
# Retry npm install a few times and verify a known binary is present — npm
# sometimes exits 0 despite partially installing devDependencies on flaky
# networks, so we check explicitly.
RUN set -eu; \
    npm config set fetch-retries 5; \
    npm config set fetch-retry-mintimeout 20000; \
    npm config set fetch-retry-maxtimeout 120000; \
    for i in 1 2 3; do \
      rm -rf node_modules; \
      npm install --no-audit --no-fund --loglevel=error || true; \
      if [ -x node_modules/.bin/tsc ] && [ -x node_modules/.bin/ts-node ]; then \
        echo "npm install succeeded (tsc+ts-node present on attempt $i)"; break; \
      fi; \
      echo "attempt $i did not install devDependencies; retrying"; \
      sleep 5; \
    done; \
    test -x node_modules/.bin/tsc; \
    test -x node_modules/.bin/ts-node

COPY . .
RUN npm run build

EXPOSE 4000

CMD ["sh", "-c", "until npm run db:migrate; do echo 'Waiting for database...'; sleep 2; done && npm run db:seed && npm run start"]
