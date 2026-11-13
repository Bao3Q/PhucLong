FROM node:22-bookworm-slim

WORKDIR /workspace

# Install workspace dependencies before copying the application source.
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN npm ci

COPY . .

EXPOSE 3000 4000

CMD ["npm", "run", "dev"]
