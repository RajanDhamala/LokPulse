FROM node:24.22.1-alpine3.24

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.25.0 --activate

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile --prod

COPY --chown=node:node . .

RUN chown -R node:node /app

USER node

EXPOSE 8000

CMD ["pnpm", "start"]
