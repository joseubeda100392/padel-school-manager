FROM node:20-alpine
WORKDIR /app

# Las NEXT_PUBLIC_* se incrustan en el código al construir: si no se declaran
# aquí, el navegador las recibe vacías aunque existan en Railway (pasó con la
# clave de avisos: nadie podía activar las notificaciones).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

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
