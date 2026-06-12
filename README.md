# bot-ernas-helper

Bot administrativo para o Discord da Ernas.

## Funcoes iniciais

- Painel de abertura de tickets com botao.
- Canal privado por ticket.
- Cargo de suporte com acesso automatico.
- Fechar, reabrir, assumir e excluir tickets.
- Transcript simples das ultimas 100 mensagens.
- Logs de entrada/saida de membros e mensagens apagadas/editadas.

## Configuracao local

1. Instale as dependencias:

```bash
npm install
```

2. Crie `.env` a partir de `.env.example`:

```env
DISCORD_TOKEN=token_do_bot
```

3. Inicie:

```bash
npm start
```

## Configuracao no Discord

No Developer Portal, configure o aplicativo `bot-ernas-helper`:

- **Bot > Token:** gere/copiei o token e use como `DISCORD_TOKEN` na VPS.
- **Bot > Privileged Gateway Intents:** ative `Server Members Intent` e `Message Content Intent`.
- **Installation > Guild Install:** habilite `bot` e `applications.commands`.
- **OAuth2/Installation ou OAuth2 URL Generator > Scopes:** marque `bot` e `applications.commands`.
- **Bot Permissions:** use `Administrator` no inicio, ou permissao granular com `Manage Channels`, `Manage Roles`, `Manage Messages`, `View Channels`, `Send Messages`, `Read Message History`, `Use Slash Commands`, `Attach Files`.

Depois de adicionar ao servidor:

```text
/configurar logs canal:#logs-admin
/configurar tickets categoria:"Tickets" cargo_suporte:@Equipe canal_transcripts:#transcripts
/painel-ticket
```

## Deploy

O workflow em `.github/workflows/deploy.yml` envia o bot para `/home/dev/bot-ernas-helper` e usa o processo PM2 `ernas-helper-bot`.

Configure estes secrets no GitHub:

- `SSH_PRIVATE_KEY`: chave privada SSH da VPS.

Na VPS, crie o `.env` em `/home/dev/bot-ernas-helper/.env` com `DISCORD_TOKEN`.
