Você é um assistente IA responsável por implementar as tarefas de forma correta.

<critical>Ative e siga a skill `executar-task` para conduzir todo o processo de implementação. A skill contém o procedimento completo de configuração, análise, planejamento, implementação e revisão.</critical>

<critical>Identifique e carregue as skills necessárias para que a tarefa seja executada com base nas tecnologias utilizadas</critical>

<critical>**VOCÊ DEVE** iniciar a implementação logo após o planejamento.</critical>

<critical>Utilize o Context7 MCP para analisar a documentação da linguagem, frameworks e bibliotecas envolvidas na implementação</critical>

<critical>**ESTE PROJETO NÃO USA LINEAR NEM NENHUM RASTREADOR EXTERNO.** O estado do
trabalho vive no repositório: `tasks/prd-<slug>/tasks.md` para a tarefa e `docs/status.md`
para o épico. Antes de escrever código, marque a tarefa como em andamento no `tasks.md`; ao
terminar, marque como concluída e escreva o `## Log de execução` no `[num]_task.md`.</critical>

<critical>O projeto de destino é definido por **onde o código é escrito**
(`apps/api`, `apps/web` ou `docs`), não por quem pediu a funcionalidade. O
`.claude/stack-profile.md` tem uma seção por app — leia a da app certa e rode os comandos a
partir do diretório dela. Tarefa que toca as duas apps é executada em duas passadas, uma por
app.</critical>

<critical>Após completar a tarefa, marque como completa em tasks.md **e** registre o log de
execução no arquivo da tarefa. Código pronto com o `tasks.md` desatualizado conta como NÃO
concluído.</critical>

<critical>**MANTENHA O CONTRATO E A ARQUITETURA EM DIA.** Endpoint criado ou alterado entra
no `docs/arquitetura/api-contract.md` na mesma passada. Convenção de arquitetura alterada
entra no `.claude/stack-profile.md` e na documentação de `docs/`; decisão nova vira registro
em `docs/decisoes/`. Documentação desatualizada mente com autoridade.</critical>

<critical>**ATUALIZE O `docs/status.md` AO FECHAR UM ÉPICO**, não a cada tarefa. Quando todas
as tarefas do `tasks.md` estiverem concluídas, mova o épico para *Concluído* com a data, e
reveja as tabelas de *Bloqueado* e *Planejado* — um épico que fecha costuma destravar outro.</critical>

<critical>SEMPRE EXECUTE O @task-reviewer no final</critical>

## Referências

- Skill: `executar-task`
- Stack profile: `.claude/stack-profile.md` (seção `apps/api` ou `apps/web`, conforme o
  projeto de destino)
- PRD: `tasks/prd-[nome-funcionalidade]/prd.md`
- Tech Spec: `tasks/prd-[nome-funcionalidade]/techspec.md`
- Tasks: `tasks/prd-[nome-funcionalidade]/tasks.md`
- Status do projeto: `docs/status.md`
