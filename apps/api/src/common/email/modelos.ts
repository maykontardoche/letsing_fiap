/**
 * Modelos de e-mail. HTML com estilo **inline** e tabelas — é o que os clientes
 * de e-mail (Outlook, Gmail) renderizam de forma previsível. CSS externo e
 * flexbox não sobrevivem ao Outlook.
 *
 * ⚠️ Todo texto vindo de usuário passa por `escapar` antes de entrar no HTML: o
 * título de um documento é entrada livre, e sem isso viraria injeção de HTML no
 * e-mail de outra pessoa.
 */

export interface AnexoDeEmail {
  readonly nome: string;
  readonly conteudoBase64: string;
  readonly tipo: string;
}

export interface MensagemDeEmail {
  readonly para: string;
  readonly assunto: string;
  readonly html: string;
  readonly texto: string;
  readonly anexos?: readonly AnexoDeEmail[];
}

export function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface Corpo {
  readonly previa: string;
  readonly titulo: string;
  readonly paragrafos: readonly string[];
  readonly botao?: { readonly rotulo: string; readonly url: string };
  readonly destaque?: string;
  readonly rodape?: string;
}

function layout(corpo: Corpo): string {
  const paragrafos = corpo.paragrafos
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4a5470;">${p}</p>`)
    .join('');

  const destaque = corpo.destaque
    ? `<div style="margin:8px 0 24px;padding:18px;border-radius:14px;background:#eef0ff;text-align:center;font-family:'JetBrains Mono',Consolas,monospace;font-size:30px;letter-spacing:10px;font-weight:700;color:#3f37c9;">${corpo.destaque}</div>`
    : '';

  const botao = corpo.botao
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 24px;"><tr><td style="border-radius:12px;background:#4f46e5;background-image:linear-gradient(135deg,#4338ca,#6d28d9);"><a href="${corpo.botao.url}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${corpo.botao.rotulo}</a></td></tr></table>
       <p style="margin:0 0 16px;font-size:12px;line-height:1.5;color:#6b7390;">Se o botão não funcionar, copie e cole no navegador:<br><span style="color:#4f46e5;word-break:break-all;">${corpo.botao.url}</span></p>`
    : '';

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${corpo.titulo}</title></head>
<body style="margin:0;padding:0;background:#f6f7fb;font-family:Inter,'Segoe UI',Arial,sans-serif;">
<span style="display:none;max-height:0;overflow:hidden;">${corpo.previa}</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7fb;padding:32px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;">
<tr><td style="padding:0 8px 20px;font-size:20px;font-weight:800;color:#0f1629;">Lets<span style="color:#4f46e5;">Sign</span></td></tr>
<tr><td style="background:#ffffff;border:1px solid #e4e7f0;border-radius:20px;padding:36px 32px;">
<h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;color:#0f1629;">${corpo.titulo}</h1>
${paragrafos}${destaque}${botao}
</td></tr>
<tr><td style="padding:20px 8px;font-size:12px;line-height:1.5;color:#6b7390;">${corpo.rodape ?? 'Você recebeu este e-mail porque alguém usou o LetsSign para falar com você. Se não esperava por ele, pode ignorá-lo com segurança.'}</td></tr>
</table></td></tr></table></body></html>`;
}

export const modelos = {
  conviteParaAssinar(dados: {
    para: string;
    nome: string;
    remetente: string;
    organizacao: string;
    titulo: string;
    mensagem: string | null;
    url: string;
    prazo: string | null;
  }): MensagemDeEmail {
    const titulo = escapar(dados.titulo);
    const paragrafos = [
      `Olá, ${escapar(dados.nome)}.`,
      `<strong>${escapar(dados.remetente)}</strong>, de ${escapar(dados.organizacao)}, pediu sua assinatura no documento <strong>“${titulo}”</strong>.`,
      ...(dados.mensagem ? [`<em>“${escapar(dados.mensagem)}”</em>`] : []),
      ...(dados.prazo ? [`Prazo para assinar: <strong>${escapar(dados.prazo)}</strong>.`] : []),
    ];

    return {
      para: dados.para,
      assunto: `Assinatura solicitada: ${dados.titulo}`,
      html: layout({
        previa: `${dados.remetente} pediu sua assinatura em ${dados.titulo}`,
        titulo: 'Você tem um documento para assinar',
        paragrafos,
        botao: { rotulo: 'Revisar e assinar', url: dados.url },
        rodape:
          'Este link é pessoal e intransferível — não o encaminhe. Ele dá acesso à sua assinatura neste documento.',
      }),
      texto: `${dados.remetente} pediu sua assinatura em "${dados.titulo}". Acesse: ${dados.url}`,
    };
  },

  codigoDeVerificacao(dados: {
    para: string;
    nome: string;
    codigo: string;
    titulo: string;
  }): MensagemDeEmail {
    return {
      para: dados.para,
      assunto: `${dados.codigo} é o seu código de verificação LetsSign`,
      html: layout({
        previa: `Seu código é ${dados.codigo}`,
        titulo: 'Seu código de verificação',
        paragrafos: [
          `Olá, ${escapar(dados.nome)}. Use o código abaixo para confirmar sua identidade e assinar <strong>“${escapar(dados.titulo)}”</strong>.`,
        ],
        destaque: dados.codigo,
        rodape:
          'O código vale por 10 minutos. Ninguém do LetsSign vai pedir este código por telefone ou mensagem.',
      }),
      texto: `Seu código de verificação LetsSign: ${dados.codigo} (vale por 10 minutos).`,
    };
  },

  documentoConcluido(dados: {
    para: string;
    nome: string;
    titulo: string;
    url: string;
    codigo: string;
  }): MensagemDeEmail {
    return {
      para: dados.para,
      assunto: `Concluído: ${dados.titulo}`,
      html: layout({
        previa: 'Todas as assinaturas foram coletadas',
        titulo: 'Documento assinado por todos ✓',
        paragrafos: [
          `Olá, ${escapar(dados.nome)}. Todas as assinaturas de <strong>“${escapar(dados.titulo)}”</strong> foram coletadas.`,
          `O PDF final tem o manifesto de assinaturas, o selo criptográfico e o código de validação <strong>${escapar(dados.codigo)}</strong>.`,
        ],
        botao: { rotulo: 'Ver e baixar o documento', url: dados.url },
      }),
      texto: `"${dados.titulo}" foi assinado por todos. Veja em: ${dados.url}`,
    };
  },

  documentoRecusado(dados: {
    para: string;
    nome: string;
    titulo: string;
    quem: string;
    motivo: string;
    url: string;
  }): MensagemDeEmail {
    return {
      para: dados.para,
      assunto: `Recusado: ${dados.titulo}`,
      html: layout({
        previa: `${dados.quem} recusou a assinatura`,
        titulo: 'Uma assinatura foi recusada',
        paragrafos: [
          `Olá, ${escapar(dados.nome)}. <strong>${escapar(dados.quem)}</strong> recusou assinar <strong>“${escapar(dados.titulo)}”</strong>.`,
          `Motivo informado: <em>“${escapar(dados.motivo)}”</em>`,
        ],
        botao: { rotulo: 'Abrir o documento', url: dados.url },
      }),
      texto: `${dados.quem} recusou assinar "${dados.titulo}". Motivo: ${dados.motivo}`,
    };
  },

  conviteParaEquipe(dados: {
    para: string;
    nome: string;
    quem: string;
    organizacao: string;
    url: string;
  }): MensagemDeEmail {
    return {
      para: dados.para,
      assunto: `${dados.quem} convidou você para o LetsSign`,
      html: layout({
        previa: `Entre para ${dados.organizacao} no LetsSign`,
        titulo: `Você foi convidado para ${escapar(dados.organizacao)}`,
        paragrafos: [
          `Olá, ${escapar(dados.nome)}. <strong>${escapar(dados.quem)}</strong> adicionou você à equipe de <strong>${escapar(dados.organizacao)}</strong> no LetsSign.`,
          'Para começar, defina a sua senha. O link vale por 72 horas.',
        ],
        botao: { rotulo: 'Definir minha senha', url: dados.url },
      }),
      texto: `Você foi convidado para ${dados.organizacao} no LetsSign. Defina sua senha: ${dados.url}`,
    };
  },

  redefinirSenha(dados: { para: string; nome: string; url: string }): MensagemDeEmail {
    return {
      para: dados.para,
      assunto: 'Redefinição de senha do LetsSign',
      html: layout({
        previa: 'Crie uma nova senha',
        titulo: 'Redefinir sua senha',
        paragrafos: [
          `Olá, ${escapar(dados.nome)}. Recebemos um pedido para redefinir a senha da sua conta.`,
          'O link vale por 1 hora e só pode ser usado uma vez. Se não foi você, ignore este e-mail — sua senha continua a mesma.',
        ],
        botao: { rotulo: 'Criar nova senha', url: dados.url },
      }),
      texto: `Redefina sua senha do LetsSign: ${dados.url} (vale por 1 hora).`,
    };
  },
};
