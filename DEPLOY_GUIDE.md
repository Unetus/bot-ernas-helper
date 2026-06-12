# Deploy do bot-ernas-helper

## VPS

- Host usado no workflow: `212.38.89.129`
- Usuario SSH usado no workflow: `dev`
- Diretorio do bot: `/home/dev/bot-ernas-helper`
- Processo PM2: `ernas-helper-bot`

## Secrets do GitHub

Em `Unetus/bot-ernas-helper` > **Settings** > **Secrets and variables** > **Actions**, crie:

- `SSH_PRIVATE_KEY`: conteudo completo da chave privada SSH da VPS.

## Variaveis na VPS

No servidor, crie `/home/dev/bot-ernas-helper/.env`:

```env
DISCORD_TOKEN=token_do_bot_helper
```

## Comandos uteis

```bash
pm2 status
pm2 logs ernas-helper-bot
pm2 restart ernas-helper-bot
```
