# bot-ernas-helper

Bot administrativo para o Discord da Ernas.

## Funcionalidades

| Recurso | Descrição |
|---------|-----------|
| Sistema de tickets | Abertura via painel com botão, canal privado por ticket, numeração sequencial |
| Gerenciamento de tickets | Assumir, fechar, reabrir, excluir (com confirmação), adicionar/remover membros |
| Transcripts | Histórico das últimas 100 mensagens salvo automaticamente ao fechar ticket |
| Logs administrativos | Entrada/saída de membros, mensagens apagadas e editadas |
| Configuração flexível | Canais, cargos e categorias configuráveis via slash commands |

## Comandos

| Comando | Descrição | Permissão |
|---------|-----------|-----------|
| `/configurar logs canal:#canal` | Define o canal de logs | Administrador |
| `/configurar tickets categoria:Tickets cargo_suporte:@Equipe` | Configura sistema de tickets | Administrador |
| `/configurar status` | Mostra a configuração atual | Administrador |
| `/painel-ticket` | Publica o painel de abertura de tickets | Administrador |
| `/ticket adicionar usuario:@User` | Adiciona membro ao ticket atual | Equipe |
| `/ticket remover usuario:@User` | Remove membro do ticket atual | Equipe |
| `/sobre` | Informações sobre o bot | Todos |

## Estrutura

```
bot-ernas-helper/
├── commands/
│   ├── configurar.js    # Configuração do bot
│   ├── painel-ticket.js # Painel de abertura de tickets
│   ├── sobre.js         # Informações do bot
│   └── ticket.js        # Sistema de tickets
├── utils/
│   ├── branding.js      # Cores, símbolos e helpers visuais
│   ├── logging.js       # Envio de logs ao canal configurado
│   ├── permissions.js   # Verificação de permissões
│   └── storage.js       # Persistência em JSON
├── scripts/
│   └── check-commands.js # Validação de comandos
├── data/                # Dados persistidos (gitignored)
├── index.js             # Entry point
├── package.json
└── .env                 # Token do bot (gitignored)
```

## Pré-requisitos

- Node.js 18+
- Token de bot do Discord com as intents `Server Members` e `Message Content`

## Configuração local

1. Instale as dependências:

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

## Configuração no Discord

No Developer Portal, configure o aplicativo `bot-ernas-helper`:

- **Bot > Token:** gere/copie o token e use como `DISCORD_TOKEN`.
- **Bot > Privileged Gateway Intents:** ative `Server Members Intent` e `Message Content Intent`.
- **Installation > Guild Install:** habilite `bot` e `applications.commands`.
- **OAuth2 > Scopes:** marque `bot` e `applications.commands`.
- **Bot Permissions:** `Administrator` ou granular: `Manage Channels`, `Manage Roles`, `Manage Messages`, `View Channels`, `Send Messages`, `Read Message History`, `Use Slash Commands`, `Attach Files`.

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

Veja [DEPLOY_GUIDE.md](DEPLOY_GUIDE.md) para mais detalhes.
