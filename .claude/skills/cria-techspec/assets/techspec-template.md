# Template de Especificação Técnica

## Resumo Executivo

[Forneça uma breve visão técnica da abordagem de solução. Resuma as decisões arquiteturais principais e a estratégia de implementação em 1-2 parágrafos.]

## Arquitetura do Sistema

### Visão Geral dos Componentes

[Breve descrição dos componentes principais e suas responsabilidades:

- Nomes dos componentes e funções primárias **Não deixe de listar cada um dos componentes novos ou que serão modificados**, indicando a app de cada um (`apps/api` ou `apps/web`)
- Relacionamentos principais entre componentes
- Visão geral do fluxo de dados]

## Design de Implementação

### Interfaces Principais

[Defina interfaces/contratos de serviço principais (≤20 linhas por exemplo).
Use a linguagem e as convenções do projeto (ver `.claude/stack-profile.md`):

```ts
// Exemplo de contrato de serviço — identificadores de domínio em português
interface DocumentosService {
  enviar(entrada: EntradaDeEnvio, ator: UsuarioAutenticado): Promise<DocumentoEnviado>;
}
```

]

### Modelos de Dados

[Defina estruturas de dados essenciais:

- Entidades de domínio principais (se aplicável)
- Tipos de requisição/resposta (DTOs — campo não declarado é rejeitado)
- Esquemas de banco de dados (se aplicável) — indique quais models têm `organizacaoId` e entram em `apps/api/src/common/tenancy/models-escopados.ts`]

### Endpoints de API

[Liste endpoints de API se aplicável:

- Método e caminho (ex: `POST /api/documentos`)
- Breve descrição
- Proteção: `@Publico()` ou a permissão exigida (`@ExigePermissao(...)`)
- Evento de auditoria gerado (ação em `snake_case`), quando for mutação
- Referências de formato requisição/resposta]

## Pontos de Integração

[Inclua apenas se a funcionalidade requer integrações externas:

- Serviços ou APIs externos (e-mail via SMTP/Mailpit, fila BullMQ, bibliotecas de visão computacional no navegador)
- Requisitos de autenticação
- Abordagem de tratamento de erros]

## Abordagem de Testes

### Testes Unidade

[Descreva estratégia de testes unidade:

- Componentes principais a testar (`*.spec.ts` na API; `*.test.ts(x)` no SPA)
- Requisitos de mock (apenas serviços externos)
- Cenários de teste críticos]

### Testes de Integração

[Se necessário, descreva testes de integração:

- Componentes a testar juntos (`apps/api/test/*.integration.spec.ts`, contra Postgres e Redis reais)
- Casos de isolamento entre organizações e de rota fechada
- Requisitos de dados de teste]

### Testes de E2E

[Se necessário, descreva testes E2E usando a estratégia de QA da stack
(ver seção `QA Strategy` em `.claude/stack-profile.md` — checagens de request/response nos
testes de integração da API; Playwright MCP, opcional, para o SPA, com WCAG 2.2 AA)]

## Sequenciamento de Desenvolvimento

### Ordem de Construção

[Defina sequência de implementação:

1. Primeiro componente/funcionalidade (por que primeiro)
2. Segundo componente/funcionalidade (dependências)
3. Componentes subsequentes
4. Integração e testes]

### Dependências Técnicas

[Liste quaisquer dependências bloqueantes:

- Infraestrutura requerida
- Disponibilidade de serviço externo]

## Monitoramento e Observabilidade

[Defina abordagem de monitoramento usando a stack de observabilidade do projeto
(ver `.claude/stack-profile.md`):

- Métricas a expor (no formato/ferramenta da stack)
- Logs principais e níveis de log (campos sensíveis novos entram na redaction)
- Eventos de auditoria (separados do log)
- Integração com health checks existentes (`/api/saude`, `/api/saude/pronto`)]

## Considerações Técnicas

### Decisões Principais

[Documente decisões técnicas importantes:

- Escolha de abordagem e justificativa
- Trade-offs considerados
- Alternativas rejeitadas e por quê
- Decisões que merecem registro próprio em `docs/decisoes/`]

### Riscos Conhecidos

[Identifique riscos técnicos:

- Desafios potenciais
- Abordagens de mitigação
- Áreas precisando pesquisa]

### Conformidade com Skills Padrões

[Pesquisa as skills na pasta @.claude/skills que se encaixam e se apliquem nesta techspec e liste-as abaixo:]

### Arquivos relevantes e dependentes

[Liste aqui arquivos relevantes e dependentes]
