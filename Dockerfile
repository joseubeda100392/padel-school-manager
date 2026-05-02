FROM node:20-alpine
WORKDIR /app
RUN npm install -g pnpm@9
COPY . .
RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter web build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "--filter", "web", "start"]
