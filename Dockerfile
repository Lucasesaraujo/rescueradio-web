FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist/web/browser /usr/share/nginx/html
COPY docker-entrypoint.d/40-rescueradio-config.sh /docker-entrypoint.d/40-rescueradio-config.sh

RUN chmod +x /docker-entrypoint.d/40-rescueradio-config.sh

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
