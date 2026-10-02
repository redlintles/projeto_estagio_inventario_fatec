FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY backend/package.json backend/package.json
COPY web/package.json web/package.json
RUN npm ci
COPY backend backend
RUN npm run build -w backend
FROM node:24-alpine
WORKDIR /app
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/backend backend
RUN mkdir /app/uploads && chown -R node:node /app
USER node
WORKDIR /app/backend
EXPOSE 3000
CMD ["node", "dist/main.js"]
