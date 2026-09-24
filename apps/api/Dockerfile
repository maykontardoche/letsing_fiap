# API do LetsSign — imagem de produção. Contexto de build: a RAIZ do monorepo.
#   docker build -f apps/api/Dockerfile -t letssign-api .

# ---- dependências (workspace inteiro, para usar o lockfile da raiz) --------
FROM node:22-alpine AS dependencias
# O engine de migração do Prisma depende do OpenSSL.
RUN apk add --no-cache openssl
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/
# Com scripts: o postinstall baixa o engine de migração e roda o `prisma generate`.
RUN npm ci --workspace apps/api --include-workspace-root=false

# ---- build ------------------------------------------------------------------
FROM dependencias AS build
WORKDIR /repo/apps/api
COPY apps/api/ ./
RUN npx nest build \
 # ⚠️ Asserção de build: se o layout do dist mudar, falha AQUI — e não em crashloop em produção.
 && test -f dist/main.js

# ---- execução ---------------------------------------------------------------
FROM node:22-alpine AS execucao
RUN apk add --no-cache openssl
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=dependencias /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma
COPY --from=build /repo/apps/api/prisma.config.ts ./apps/api/
COPY apps/api/package.json ./apps/api/
WORKDIR /repo/apps/api
# Usuário sem privilégio: um RCE na API não vira root no container.
RUN mkdir -p storage && chown -R node:node storage
USER node
EXPOSE 3020
# Migrations pendentes são aplicadas antes de subir (`migrate deploy` só aplica o que está versionado).
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
