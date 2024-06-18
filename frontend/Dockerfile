##### DEPENDENCIES

FROM --platform=linux/amd64 node:20-alpine AS deps
ARG OGMA_KEY

RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Install Prisma Client - remove if not using Prisma

COPY prisma ./

# Install dependencies based on the preferred package manager

COPY package.json env-dependencies.js yarn.lock* package-lock.json* pnpm-lock.yaml\* ./

RUN \
    if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    elif [ -f pnpm-lock.yaml ]; then yarn global add pnpm && pnpm i; \
    else echo "Lockfile not found." && exit 1; \
    fi

##### BUILDER

FROM --platform=linux/amd64 node:20-alpine AS builder
ARG DATABASE_URL
ARG NEO4J_URL
ARG DFO_NEO4J_URL
ARG NEO4J_USERNAME
ARG NEO4J_PASSWORD
ARG QA_SERVICE_URL
ARG NEXT_PUBLIC_GOOGLE_API_KEY

ENV NEXT_PUBLIC_GOOGLE_API_KEY ${NEXT_PUBLIC_GOOGLE_API_KEY}

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# ENV NEXT_TELEMETRY_DISABLED 1

RUN \
    if [ -f yarn.lock ]; then SKIP_ENV_VALIDATION=1 yarn build; \
    elif [ -f package-lock.json ]; then SKIP_ENV_VALIDATION=1 npm run build; \
    elif [ -f pnpm-lock.yaml ]; then yarn global add pnpm && SKIP_ENV_VALIDATION=1 pnpm run build; \
    else echo "Lockfile not found." && exit 1; \
    fi

ENV DATABASE_URL file:/tmp/db.sqlite
RUN npm run db:push && npm run db:seed
##### RUNNER

FROM --platform=linux/amd64 gcr.io/distroless/nodejs20-debian12 AS runner
WORKDIR /app

ARG NEO4J_URL
ARG DFO_NEO4J_URL
ARG NEO4J_USERNAME
ARG NEO4J_PASSWORD
ARG QA_SERVICE_URL

ARG GITHUB_CLIENT_ID
ARG GITHUB_CLIENT_SECRET
ARG GITHUB_ALLOWED_USERS
ARG NEXTAUTH_SECRET
ARG NEXTAUTH_URL
ARG DATABASE_URL


ENV NODE_ENV production
ENV NEO4J_URL ${NEO4J_URL}
ENV DFO_NEO4J_URL=${DFO_NEO4J_URL}
ENV NEO4J_USERNAME ${NEO4J_USERNAME}
ENV NEO4J_PASSWORD ${NEO4J_PASSWORD}
ENV QA_SERVICE_URL ${QA_SERVICE_URL}
ENV GITHUB_CLIENT_ID ${GITHUB_CLIENT_ID}
ENV GITHUB_CLIENT_SECRET ${GITHUB_CLIENT_SECRET}
ENV GITHUB_ALLOWED_USERS ${GITHUB_ALLOWED_USERS}
ENV NEXTAUTH_SECRET ${NEXTAUTH_SECRET}
ENV NEXTAUTH_URL ${NEXTAUTH_URL}
ENV DATABASE_URL ${DATABASE_URL}

ENV NEXT_TELEMETRY_DISABLED 1

COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

COPY --from=builder /tmp/db.sqlite /tmp/db.sqlite

EXPOSE 3000
ENV PORT 3000

ENV NODE_OPTIONS="--max-old-space-size=35000"

CMD ["server.js"]