# SPA do LetsSign — build estático servido por nginx. Contexto: a RAIZ do monorepo.
#   docker build -f apps/web/Dockerfile -t letssign-web .

FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace apps/web --include-workspace-root=false --ignore-scripts
COPY apps/web/ apps/web/
WORKDIR /repo/apps/web
RUN npx vite build

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
