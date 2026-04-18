FROM node:20-alpine

# Force IPv4-first DNS resolution so `npm install` doesn't stall on the
# 20-second IPv6 timeout in environments where the v6 route is black-holed
# (e.g. sandboxes / some CI networks).
ENV NODE_OPTIONS="--dns-result-order=ipv4first"

WORKDIR /app

# Network-resilient npm config: retry transient DNS / socket failures
# several times before giving up so builds don't fail on flaky networks.
RUN npm config set fetch-retries 8 \
 && npm config set fetch-retry-factor 2 \
 && npm config set fetch-retry-mintimeout 10000 \
 && npm config set fetch-retry-maxtimeout 180000

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 4000

CMD ["sh", "-c", "until npm run db:migrate; do echo 'Waiting for database...'; sleep 2; done && npm run db:seed && npm run start"]
