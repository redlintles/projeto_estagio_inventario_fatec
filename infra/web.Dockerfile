FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY backend/package.json backend/package.json
COPY web/package.json web/package.json
RUN npm ci
COPY web web
ENV VITE_API_URL=/api
RUN npm run build -w web
FROM nginx:1.28-alpine
COPY --from=build /app/web/dist /usr/share/nginx/html
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
