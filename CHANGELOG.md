# Changelog

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
