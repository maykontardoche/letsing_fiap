-- CreateEnum
CREATE TYPE "papel" AS ENUM ('proprietario', 'administrador', 'membro', 'auditor');

-- CreateEnum
CREATE TYPE "plano" AS ENUM ('basico', 'profissional', 'empresarial');

-- CreateEnum
CREATE TYPE "status_do_documento" AS ENUM ('rascunho', 'em_andamento', 'concluido', 'cancelado', 'recusado', 'expirado');

-- CreateEnum
CREATE TYPE "status_do_signatario" AS ENUM ('pendente', 'visualizado', 'assinado', 'recusado');

-- CreateEnum
CREATE TYPE "nivel_de_verificacao" AS ENUM ('simples', 'biometrico', 'completo');

-- CreateEnum
CREATE TYPE "tipo_de_verificacao" AS ENUM ('codigo_email', 'facial', 'voz', 'gestos');

-- CreateEnum
CREATE TYPE "tipo_de_assinatura" AS ENUM ('desenhada', 'digitada');

-- CreateEnum
CREATE TYPE "tipo_de_ator" AS ENUM ('usuario', 'signatario', 'sistema');

-- CreateTable
CREATE TABLE "organizacoes" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "plano" "plano" NOT NULL DEFAULT 'basico',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "organizacao_id" INTEGER NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "email" VARCHAR(180) NOT NULL,
    "senha_hash" TEXT,
    "papel" "papel" NOT NULL DEFAULT 'membro',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "mfa_segredo" TEXT,
    "mfa_ativado_em" TIMESTAMP(3),
    "mfa_codigos" TEXT,
    "ultimo_acesso_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessoes" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "organizacao_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "sessao_hash" TEXT NOT NULL,
    "ip" VARCHAR(64),
    "user_agent" VARCHAR(500),
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultima_atividade_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revogada_em" TIMESTAMP(3),

    CONSTRAINT "sessoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens_de_senha" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "finalidade" VARCHAR(20) NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "usado_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_de_senha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "organizacao_id" INTEGER NOT NULL,
    "criado_por_id" INTEGER NOT NULL,
    "titulo" VARCHAR(160) NOT NULL,
    "mensagem" VARCHAR(1000),
    "status" "status_do_documento" NOT NULL DEFAULT 'rascunho',
    "nivel_verificacao" "nivel_de_verificacao" NOT NULL DEFAULT 'simples',
    "ordem_sequencial" BOOLEAN NOT NULL DEFAULT false,
    "codigo" VARCHAR(20) NOT NULL,
    "nome_arquivo" VARCHAR(200) NOT NULL,
    "tamanho_bytes" INTEGER NOT NULL,
    "paginas" INTEGER NOT NULL,
    "arquivo_original" TEXT NOT NULL,
    "hash_original" CHAR(64) NOT NULL,
    "arquivo_assinado" TEXT,
    "hash_assinado" CHAR(64),
    "carga_do_selo" TEXT,
    "selo" TEXT,
    "prazo" TIMESTAMP(3),
    "enviado_em" TIMESTAMP(3),
    "concluido_em" TIMESTAMP(3),
    "cancelado_em" TIMESTAMP(3),
    "motivo_cancelamento" VARCHAR(500),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signatarios" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "organizacao_id" INTEGER NOT NULL,
    "documento_id" INTEGER NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "email" VARCHAR(180) NOT NULL,
    "cpf_cifrado" TEXT,
    "cpf_final" VARCHAR(2),
    "ordem" INTEGER NOT NULL,
    "status" "status_do_signatario" NOT NULL DEFAULT 'pendente',
    "token_hash" TEXT,
    "token_expira_em" TIMESTAMP(3),
    "visualizado_em" TIMESTAMP(3),
    "assinado_em" TIMESTAMP(3),
    "recusado_em" TIMESTAMP(3),
    "motivo_recusa" VARCHAR(500),
    "ip" VARCHAR(64),
    "user_agent" VARCHAR(500),
    "tipo_assinatura" "tipo_de_assinatura",
    "imagem_assinatura" TEXT,
    "carga_assinada" TEXT,
    "assinatura_digital" TEXT,
    "lembrete_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signatarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "desafios_de_verificacao" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "organizacao_id" INTEGER NOT NULL,
    "signatario_id" INTEGER NOT NULL,
    "tipo" "tipo_de_verificacao" NOT NULL,
    "desafio" JSONB NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "concluido_em" TIMESTAMP(3),
    "aprovado" BOOLEAN,
    "pontuacao" DOUBLE PRECISION,
    "resultado" JSONB,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "desafios_de_verificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_de_auditoria" (
    "id" SERIAL NOT NULL,
    "organizacao_id" INTEGER NOT NULL,
    "cadeia" VARCHAR(80) NOT NULL,
    "sequencia" INTEGER NOT NULL,
    "documento_id" INTEGER,
    "tipo_ator" "tipo_de_ator" NOT NULL,
    "ator_id" INTEGER,
    "ator_nome" VARCHAR(120),
    "acao" VARCHAR(60) NOT NULL,
    "resumo" VARCHAR(500) NOT NULL,
    "dados" JSONB,
    "ip" VARCHAR(64),
    "user_agent" VARCHAR(500),
    "hash_anterior" CHAR(64) NOT NULL,
    "hash" CHAR(64) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_de_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacoes" (
    "id" SERIAL NOT NULL,
    "organizacao_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "titulo" VARCHAR(160) NOT NULL,
    "mensagem" VARCHAR(500) NOT NULL,
    "link" VARCHAR(300),
    "lida_em" TIMESTAMP(3),
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizacoes_uuid_key" ON "organizacoes"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "organizacoes_slug_key" ON "organizacoes"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_uuid_key" ON "usuarios"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_organizacao_id_idx" ON "usuarios"("organizacao_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessoes_uuid_key" ON "sessoes"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "sessoes_sessao_hash_key" ON "sessoes"("sessao_hash");

-- CreateIndex
CREATE INDEX "sessoes_organizacao_id_usuario_id_idx" ON "sessoes"("organizacao_id", "usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_de_senha_token_hash_key" ON "tokens_de_senha"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "documentos_uuid_key" ON "documentos"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "documentos_codigo_key" ON "documentos"("codigo");

-- CreateIndex
CREATE INDEX "documentos_organizacao_id_status_idx" ON "documentos"("organizacao_id", "status");

-- CreateIndex
CREATE INDEX "documentos_organizacao_id_criado_em_idx" ON "documentos"("organizacao_id", "criado_em");

-- CreateIndex
CREATE INDEX "documentos_hash_original_idx" ON "documentos"("hash_original");

-- CreateIndex
CREATE INDEX "documentos_hash_assinado_idx" ON "documentos"("hash_assinado");

-- CreateIndex
CREATE UNIQUE INDEX "signatarios_uuid_key" ON "signatarios"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "signatarios_token_hash_key" ON "signatarios"("token_hash");

-- CreateIndex
CREATE INDEX "signatarios_organizacao_id_email_idx" ON "signatarios"("organizacao_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "signatarios_documento_id_email_key" ON "signatarios"("documento_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "desafios_de_verificacao_uuid_key" ON "desafios_de_verificacao"("uuid");

-- CreateIndex
CREATE INDEX "desafios_de_verificacao_signatario_id_tipo_idx" ON "desafios_de_verificacao"("signatario_id", "tipo");

-- CreateIndex
CREATE INDEX "eventos_de_auditoria_organizacao_id_criado_em_idx" ON "eventos_de_auditoria"("organizacao_id", "criado_em");

-- CreateIndex
CREATE INDEX "eventos_de_auditoria_documento_id_idx" ON "eventos_de_auditoria"("documento_id");

-- CreateIndex
CREATE UNIQUE INDEX "eventos_de_auditoria_cadeia_sequencia_key" ON "eventos_de_auditoria"("cadeia", "sequencia");

-- CreateIndex
CREATE INDEX "notificacoes_usuario_id_lida_em_idx" ON "notificacoes"("usuario_id", "lida_em");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_organizacao_id_fkey" FOREIGN KEY ("organizacao_id") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_organizacao_id_fkey" FOREIGN KEY ("organizacao_id") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens_de_senha" ADD CONSTRAINT "tokens_de_senha_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_organizacao_id_fkey" FOREIGN KEY ("organizacao_id") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatarios" ADD CONSTRAINT "signatarios_organizacao_id_fkey" FOREIGN KEY ("organizacao_id") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatarios" ADD CONSTRAINT "signatarios_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "documentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "desafios_de_verificacao" ADD CONSTRAINT "desafios_de_verificacao_organizacao_id_fkey" FOREIGN KEY ("organizacao_id") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "desafios_de_verificacao" ADD CONSTRAINT "desafios_de_verificacao_signatario_id_fkey" FOREIGN KEY ("signatario_id") REFERENCES "signatarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_de_auditoria" ADD CONSTRAINT "eventos_de_auditoria_organizacao_id_fkey" FOREIGN KEY ("organizacao_id") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_organizacao_id_fkey" FOREIGN KEY ("organizacao_id") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
