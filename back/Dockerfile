FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

FROM node:20-alpine AS production
WORKDIR /app
COPY --from=build /app ./
ENV NODE_ENV=production
EXPOSE 8000
CMD ["node", "index.js"]

