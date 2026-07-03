# Changelog

## 2.0.2

### Correções
- Select menu do painel de tickets agora é roteado para o handler de componentes (antes exibia "Esta interação falhou" ao selecionar uma opção).
- Abertura de ticket via modal usa `deferReply` para evitar timeout em criação de canal/envio de mensagens demorada.

## 2.0.1

### Correções
- Checagem de equipe agora ocorre antes de confirmar/cancelar exclusão de ticket, impedindo que usuários comuns excluam tickets.
- `/ticket adicionar|remover` valida se o canal atual é um ticket antes de alterar permissões.
- Log de mensagem editada não quebra mais em mensagens parciais (autor opcional).
- `ticketCounter` é revertido se a criação do canal de ticket falhar.

### Infra
- `storage.js` com cache em memória e escrita atômica (temp + rename), reduzindo I/O e evitando corrupção do `config.json`.
- Handlers globais para `unhandledRejection`, `uncaughtException` e erros de shard/cliente.
- Removidos símbolos mortos (`LOCK`/`UNLOCK`) e `getGuildConfig` redundante em `configurar tickets`.
- Opções do painel de tickets sem o sufixo "(Placeholder)".

## 2.0.0

### Visual
- Sistema de design centralizado (`utils/branding.js`) com paleta de cores e símbolos minimalistas.
- Todas as embeds agora têm footer, timestamp e cores consistentes.
- Painel de tickets redesenhado com descrição estruturada e avatar do bot.
- Embeds de ticket com campos organizados (Autor, Status, Motivo).
- Respostas de ação em embed (assumir, fechar, reabrir) em vez de texto puro.
- Logs com campos estruturados (Canal, Autor, Conteúdo separados).

### Funcionalidades
- Numeração sequencial de tickets (`ticket-0001`, `ticket-0002`, ...).
- Mensagem de boas-vindas ao abrir ticket.
- Confirmação antes de excluir ticket (botão de confirmação).
- Novo comando `/configurar status` — exibe a configuração atual com indicadores visuais.
- Novo comando `/sobre` — versão, uptime, servidores, estatísticas de tickets.
- Transcript com header contendo metadados do ticket.
- Cálculo e exibição de duração do ticket ao fechar.
- Log de membro entrou mostra idade da conta com timestamp do Discord.
- Atividade do bot definida como "Watching tickets".

### Correções
- Bug no `storage.js`: `updateGuildConfig` chamava `getGuildConfig` causando escrita redundante.
- Erros do bot agora respondem com embed em vez de texto puro.

### Infra
- Console logging estruturado com prefixos (`[BOT]`, `[CMD]`, `[COMMANDS]`, `[ERRO]`).
- `ticketCounter` persistido na configuração do guild.

## 1.0.0

- Versão inicial com tickets, logs e deploy automatizado.
