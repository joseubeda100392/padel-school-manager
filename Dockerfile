FROM node:20-alpine
WORKDIR /app

# Build-time args — all vars needed by Next.js static generation
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG SUPABASE_SERVICE_ROLE_KEY
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ARG VAPID_PRIVATE_KEY
ARG DATABASE_URL
ARG REDSYS_ENV=test
ARG REDSYS_MERCHANT_CODE
ARG REDSYS_SECRET_KEY
ARG REDSYS_TERMINAL=001
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG CRON_SECRET

# Expose as ENV so Next.js build and runtime can read them
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY \
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY \
    VAPID_PRIVATE_KEY=$VAPID_PRIVATE_KEY \
    DATABASE_URL=$DATABASE_URL \
    REDSYS_ENV=$REDSYS_ENV \
    REDSYS_MERCHANT_CODE=$REDSYS_MERCHANT_CODE \
    REDSYS_SECRET_KEY=$REDSYS_SECRET_KEY \
    REDSYS_TERMINAL=$REDSYS_TERMINAL \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    CRON_SECRET=$CRON_SECRET

RUN npm install -g pnpm@9

# Copy manifests + prisma schema — this layer is cached when only source code changes
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json packages/db/schema.prisma ./packages/db/
COPY packages/types/package.json ./packages/types/
COPY packages/stripe/package.json ./packages/stripe/

RUN pnpm install --no-frozen-lockfile
RUN cd packages/db && pnpm exec prisma generate

# Copy source and build (always runs when code changes)
COPY . .
RUN pnpm --filter web build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "--filter", "web", "start"]
