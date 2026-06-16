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

## Checklist de primeiro deploy

1. Criar o secret `SSH_PRIVATE_KEY` no GitHub.
2. Criar o `.env` na VPS com o `DISCORD_TOKEN`.
3. Fazer push na branch `main` para acionar o workflow.
4. Verificar com `pm2 logs ernas-helper-bot` se o bot iniciou.
5. No Discord, rodar `/configurar logs` e `/configurar tickets`.
6. Publicar o painel com `/painel-ticket`.

## Troubleshooting

| Problema | Solução |
|----------|---------|
| Bot não inicia | Verificar `pm2 logs ernas-helper-bot` para ver o erro |
| "DISCORD_TOKEN nao configurado" | Verificar se `.env` existe em `/home/dev/bot-ernas-helper/.env` |
| Comandos slash não aparecem | Aguardar até 1h para propagação ou verificar permissões do bot |
| Workflow falha no SCP | Verificar se a chave SSH está correta no secret |
| Bot online mas sem resposta | Verificar se intents estão ativadas no Developer Portal |
| Tickets não criam | Rodar `/configurar status` e verificar se tudo está configurado |
