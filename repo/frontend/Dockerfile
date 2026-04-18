FROM node:20-alpine AS build

# Force IPv4-first DNS so npm install doesn't stall on IPv6 blackholes.
ENV NODE_OPTIONS="--dns-result-order=ipv4first"

WORKDIR /app

# Network-resilient npm config: retry transient DNS / socket failures
# several times before giving up.
RUN npm config set fetch-retries 8 \
 && npm config set fetch-retry-factor 2 \
 && npm config set fetch-retry-mintimeout 10000 \
 && npm config set fetch-retry-maxtimeout 180000

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
ARG VITE_API_BASE_URL=http://localhost:4000
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
