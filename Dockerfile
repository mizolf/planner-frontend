# --- Build stage: Node builda Angular u statičke fajlove ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG BUILD_CONFIG=production
RUN npm run build -- --configuration=$BUILD_CONFIG

# --- Serve stage: nginx servira statiku ---
FROM nginx:alpine
COPY --from=build /app/dist/planner-frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
# nginx:alpine već pokreće nginx u foregroundu — CMD nije potreban
